import { describe, expect, it } from "vitest";
import {
  type FriendshipRow,
  otherPartyId,
  toShellFriends,
  toShellLinks,
  toShellTokens,
  toShellVillages,
  type VillageRow,
} from "./shell-data";

function village(over: Partial<VillageRow> & { id: string; owner_id: string }): VillageRow {
  return {
    name: `Dorf ${over.id}`,
    owner: { username: `u-${over.owner_id}`, display_name: `Name ${over.owner_id}` },
    houses: [],
    ...over,
  };
}

describe("toShellVillages", () => {
  it("stellt das eigene Dorf an den Anfang", () => {
    const rows = [
      village({ id: "v1", owner_id: "a" }),
      village({ id: "v2", owner_id: "me" }),
      village({ id: "v3", owner_id: "b" }),
    ];
    const out = toShellVillages(rows, "me");
    expect(out.map((v) => v.id)).toEqual(["v2", "v1", "v3"]);
    expect(out.map((v) => v.mine)).toEqual([true, false, false]);
  });

  it("lässt Dörfer ohne sichtbaren Besitzer weg", () => {
    const rows = [village({ id: "v1", owner_id: "a", owner: null })];
    expect(toShellVillages(rows, "me")).toEqual([]);
  });

  it("zählt Häuser ohne Zentrale und alle Objekte, letzte Änderung ist das jüngste Datum", () => {
    const rows = [
      village({
        id: "v1",
        owner_id: "me",
        houses: [
          { id: "h0", kind: "zentrale", created_at: "2026-10-01", artifacts: [] },
          {
            id: "h1",
            kind: "modul",
            created_at: "2026-10-02",
            artifacts: [{ created_at: "2026-10-05" }, { created_at: "2026-10-03" }],
          },
          { id: "h2", kind: "thema", created_at: "2026-10-04", artifacts: [] },
        ],
      }),
    ];
    const [v] = toShellVillages(rows, "me");
    expect(v.houseCount).toBe(2);
    expect(v.objectCount).toBe(2);
    expect(v.last).toBe("2026-10-05");
    expect(v.ownerUsername).toBe("u-me");
    expect(v.ownerName).toBe("Name me");
  });

  it("liefert last = null ohne Häuser", () => {
    const [v] = toShellVillages([village({ id: "v1", owner_id: "me" })], "me");
    expect(v.last).toBeNull();
    expect(v.houseCount).toBe(0);
  });
});

describe("toShellFriends", () => {
  const row = (over: Partial<FriendshipRow> & { id: string }): FriendshipRow => ({
    requester_id: "me",
    addressee_id: "x",
    status: "pending",
    created_at: "2026-10-01",
    responded_at: null,
    ...over,
  });
  const profiles = [
    { id: "x", username: "xx", display_name: "X Person" },
    { id: "y", username: "yy", display_name: "Y Person" },
  ];

  it("erkennt die andere Person unabhängig von der Richtung", () => {
    expect(otherPartyId(row({ id: "f1", requester_id: "me", addressee_id: "x" }), "me")).toBe("x");
    expect(otherPartyId(row({ id: "f2", requester_id: "y", addressee_id: "me" }), "me")).toBe("y");
  });

  it("leitet den Status aus Richtung und Annahme ab", () => {
    const rows = [
      row({ id: "f1", addressee_id: "x" }),
      row({ id: "f2", requester_id: "y", addressee_id: "me" }),
      row({ id: "f3", addressee_id: "x", status: "accepted" }),
    ];
    const out = toShellFriends(rows, profiles, "me");
    expect(out.map((f) => f.status)).toEqual(["ausgehend", "eingehend", "freund"]);
    expect(out[1]).toMatchObject({ friendshipId: "f2", otherId: "y", username: "yy" });
    expect(out[1].displayName).toBe("Y Person");
  });

  it("nimmt responded_at als Zeitpunkt, sonst created_at", () => {
    const out = toShellFriends(
      [
        row({ id: "f1", status: "accepted", responded_at: "2026-10-09" }),
        row({ id: "f2", addressee_id: "y" }),
      ],
      profiles,
      "me",
    );
    expect(out.map((f) => f.since)).toEqual(["2026-10-09", "2026-10-01"]);
  });

  it("lässt Einträge ohne sichtbares Profil weg", () => {
    const out = toShellFriends([row({ id: "f1", addressee_id: "unbekannt" })], profiles, "me");
    expect(out).toEqual([]);
  });
});

describe("toShellLinks und toShellTokens", () => {
  it("wandelt Linkzeilen um", () => {
    expect(toShellLinks([{ id: "l1", expires_at: "2026-11-01", max_uses: 3, uses: 1 }])).toEqual([
      { id: "l1", expiresAt: "2026-11-01", maxUses: 3, uses: 1 },
    ]);
  });

  it("wandelt Tokenzeilen um und setzt fehlendes last_used_at auf null", () => {
    const out = toShellTokens([
      { id: "t1", label: "Claude", created_at: "2026-10-01", last_used_at: "2026-10-02" },
      { id: "t2", label: "Neu", created_at: "2026-10-03", last_used_at: null },
    ]);
    expect(out).toEqual([
      { id: "t1", label: "Claude", createdAt: "2026-10-01", lastUsedAt: "2026-10-02" },
      { id: "t2", label: "Neu", createdAt: "2026-10-03", lastUsedAt: null },
    ]);
  });
});

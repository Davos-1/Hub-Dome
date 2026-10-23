import { describe, expect, it } from "vitest";
import { generateWorld } from "./generate";
import { pruneDoc, toLayoutHouses, type ArtifactRow, type HouseRow } from "./layout-houses";
import type { WorldDoc } from "./doc";

const house = (id: string, created_at: string, extra: Partial<HouseRow> = {}): HouseRow => ({
  id,
  kind: "modul",
  module_code: "BAUSTATIK1",
  created_at,
  ...extra,
});
const art = (
  id: string,
  house_id: string,
  sort: number,
  created_at: string,
  kind: ArtifactRow["kind"] = "quiz",
): ArtifactRow => ({
  id,
  house_id,
  kind,
  sort,
  created_at,
});

describe("toLayoutHouses", () => {
  it("vergibt den Rang nach created_at, nicht nach der Reihenfolge der Eingabe", () => {
    const rows = [
      house("c", "2026-10-03T10:00:00+00:00"),
      house("a", "2026-10-01T10:00:00+00:00"),
      house("b", "2026-10-02T10:00:00+00:00"),
    ];
    const out = toLayoutHouses(rows, []);
    // Ausgabe folgt der Eingabe, `order` dem Alter
    expect(out.map((h) => h.id)).toEqual(["c", "a", "b"]);
    expect(Object.fromEntries(out.map((h) => [h.id, h.order]))).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("liest Zeitstempel mit Mikrosekunden wie Postgres sie liefert", () => {
    const out = toLayoutHouses(
      [
        house("neu", "2026-10-21T12:00:00.500000+00:00"),
        house("alt", "2026-10-21T12:00:00.100000+00:00"),
      ],
      [],
    );
    expect(out.find((h) => h.id === "alt")!.order).toBeLessThan(
      out.find((h) => h.id === "neu")!.order,
    );
  });

  it("entscheidet gleiche Zeitstempel nach position_index, dann nach Id", () => {
    const t = "2026-10-21T12:00:00+00:00";
    const out = toLayoutHouses(
      [
        house("z", t, { position_index: 0 }),
        house("y", t, { position_index: 2 }),
        house("x", t, { position_index: 2 }),
      ],
      [],
    );
    const order = Object.fromEntries(out.map((h) => [h.id, h.order]));
    expect(order).toEqual({ z: 0, x: 1, y: 2 });
  });

  it("bildet den Fachbereich über fachbereichOf und behält die Zentrale", () => {
    const out = toLayoutHouses(
      [
        { id: "z", kind: "zentrale", module_code: null, created_at: "2026-10-01T00:00:00Z" },
        house("m", "2026-10-02T00:00:00Z", { module_code: "NABA" }),
        { id: "t", kind: "thema", module_code: null, created_at: "2026-10-03T00:00:00Z" },
        house("u", "2026-10-04T00:00:00Z", { module_code: "UNBEKANNT" }),
      ],
      [],
    );
    expect(out.map((h) => [h.id, h.kind, h.fach])).toEqual([
      ["z", "zentrale", "weitere"],
      ["m", "modul", "umwelt"],
      ["t", "thema", "weitere"],
      ["u", "modul", "weitere"],
    ]);
  });

  it("ordnet Objekte pro Haus nach sort, dann created_at, und ignoriert fremde Häuser", () => {
    const out = toLayoutHouses(
      [
        house("h1", "2026-10-01T00:00:00Z"),
        house("h2", "2026-10-02T00:00:00Z"),
        house("leer", "2026-10-03T00:00:00Z"),
      ],
      [
        art("a3", "h1", 1, "2026-10-05T00:00:00Z", "tool"),
        art("a1", "h1", 0, "2026-10-07T00:00:00Z", "rechner"),
        art("a2", "h1", 1, "2026-10-04T00:00:00Z", "quiz"),
        art("b1", "h2", 0, "2026-10-01T00:00:00Z"),
        art("x", "gibt-es-nicht", 0, "2026-10-01T00:00:00Z"),
      ],
    );
    expect(out[0].items).toEqual([
      { id: "a1", kind: "rechner" },
      { id: "a2", kind: "quiz" },
      { id: "a3", kind: "tool" },
    ]);
    expect(out[1].items).toEqual([{ id: "b1", kind: "quiz" }]);
    expect(out[2].items).toEqual([]);
  });

  it("ergibt unabhängig von der Eingabereihenfolge dieselbe Welt", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      house(`h${i}`, `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`, {
        module_code: ["BAUSTATIK1", "NABA", "ET", "MATH1A"][i % 4],
      }),
    );
    const arts = rows.flatMap((h, i) =>
      [
        art(`${h.id}-a`, h.id, 0, "2026-10-01T00:00:00Z"),
        art(`${h.id}-b`, h.id, 1, "2026-10-02T00:00:00Z"),
      ].slice(0, 1 + (i % 2)),
    );
    const zentrale: HouseRow = {
      id: "z",
      kind: "zentrale",
      module_code: null,
      created_at: "2026-09-30T00:00:00Z",
    };
    const a = generateWorld({
      seed: "abcd1234",
      houses: toLayoutHouses([zentrale, ...rows], arts),
    });
    const b = generateWorld({
      seed: "abcd1234",
      houses: toLayoutHouses([...rows].reverse().concat(zentrale), arts),
    });
    expect(b.layout.houses).toEqual(a.layout.houses);
    expect(b.layout.paths).toEqual(a.layout.paths);
  });
});

describe("pruneDoc", () => {
  const doc: WorldDoc = {
    v: 1,
    quartiere: { tragwerk: [2] },
    haeuser: { h1: { r: 2, s: "p0" }, weg: { r: 1, s: "g0" } },
    deko: [{ id: "d1", typ: "bank", x: 1, z: 2, r: 0 }],
    varianten: { h1: { farbe: 1 }, weg: { dach: 2 } },
  };

  it("entfernt Fixierungen und Varianten unbekannter Häuser, lässt den Rest unverändert", () => {
    expect(pruneDoc(doc, new Set(["h1", "h2"]))).toEqual({
      v: 1,
      quartiere: { tragwerk: [2] },
      haeuser: { h1: { r: 2, s: "p0" } },
      deko: doc.deko,
      varianten: { h1: { farbe: 1 } },
    });
  });

  it("legt fehlende Felder nicht an", () => {
    expect(pruneDoc({ v: 1 }, new Set(["h1"]))).toEqual({ v: 1 });
    expect(Object.keys(pruneDoc({ v: 1, deko: [] }, new Set()))).toEqual(["v", "deko"]);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` wirft ausserhalb von Server Components; der Service-Role-Client wird durch einen Fake ersetzt.
vi.mock("server-only", () => ({}));
const admin = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));

import {
  isMissingTable,
  loadOwnWorld,
  loadVillageWorld,
  loadWorldRow,
  worldFromRow,
  writeWorld,
} from "./server-data";
import { legacySeed } from "./seed.server";

type Res = { data?: unknown; error?: { code?: string; message?: string } | null };
type Call = [method: string, args: unknown[]];

/** Fake für den Supabase-Abfrageaufbau: zeichnet jeden Aufruf auf und ist selbst «await»-bar. */
function builder(res: Res, calls: Call[]) {
  const b: unknown = new Proxy(
    {},
    {
      get(_, method: string) {
        if (method === "then") {
          return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
            Promise.resolve({ data: res.data ?? null, error: res.error ?? null }).then(ok, ko);
        }
        return (...args: unknown[]) => {
          calls.push([method, args]);
          return b;
        };
      },
    },
  );
  return b;
}

/** Antworten pro Tabelle in der Reihenfolge der Aufrufe; `log[tabelle]` enthält die aufgezeichneten Aufrufe. */
function fakeClient(tables: Record<string, Res[]>) {
  const log: Record<string, Call[][]> = {};
  const queue = Object.fromEntries(Object.entries(tables).map(([t, r]) => [t, [...r]]));
  const from = vi.fn((table: string) => {
    const calls: Call[] = [];
    (log[table] ??= []).push(calls);
    const res = queue[table]?.shift() ?? {
      data: null,
      error: { code: "XX000", message: `unerwartete Abfrage: ${table}` },
    };
    return builder(res, calls);
  });
  return { client: { from } as unknown as SupabaseClient, from, log };
}

const has = (calls: Call[], method: string, ...args: unknown[]) =>
  calls.some(([m, a]) => m === method && args.every((x, i) => a[i] === x));

const VILLAGE = "3f2b8c1e-9a47-4d6b-8e35-1c7a5d02b9f4";
const missing = {
  code: "PGRST205",
  message: "Could not find the table 'public.village_worlds' in the schema cache",
};

describe("isMissingTable", () => {
  it("erkennt die Fehlercodes von Postgres und PostgREST", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
  });

  it("erkennt die Meldungen ohne Code", () => {
    expect(isMissingTable({ message: 'relation "public.village_worlds" does not exist' })).toBe(
      true,
    );
    expect(
      isMissingTable({
        message: "Could not find the table 'public.village_worlds' in the schema cache",
      }),
    ).toBe(true);
  });

  it("hält andere Fehler nicht für eine fehlende Tabelle", () => {
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable(undefined)).toBe(false);
    expect(
      isMissingTable({ code: "42501", message: "permission denied for table village_worlds" }),
    ).toBe(false);
    expect(isMissingTable({ message: 'relation "public.anderes" does not exist' })).toBe(false);
  });
});

describe("worldFromRow", () => {
  it("ersetzt eine fehlende Zeile durch den Ersatz-Seed ohne Platzierungen", () => {
    expect(worldFromRow(VILLAGE, null)).toEqual({
      seed: legacySeed(VILLAGE),
      version: 1,
      doc: { v: 1 },
      stored: false,
    });
  });

  it("ersetzt auch eine Zeile mit ungültigem Seed", () => {
    const w = worldFromRow(VILLAGE, { seed: "ZU KURZ", generator_version: 1, placements: {} });
    expect(w.stored).toBe(false);
    expect(w.seed).toBe(legacySeed(VILLAGE));
  });

  it("übernimmt Seed, Version und gelesene Platzierungen", () => {
    const deko = { id: "d1", typ: "bank", x: 3, z: 4, r: 90 };
    const w = worldFromRow(VILLAGE, {
      seed: "abcd1234",
      generator_version: 1,
      placements: { v: 1, deko: [deko] },
    });
    expect(w).toEqual({ seed: "abcd1234", version: 1, doc: { v: 1, deko: [deko] }, stored: true });
  });

  it("liest die Standardzeile der Migration (placements = {}) als leeres Dokument", () => {
    const w = worldFromRow(VILLAGE, { seed: "abcd1234", generator_version: 1, placements: {} });
    expect(w.stored).toBe(true);
    expect(w.doc.deko ?? []).toEqual([]);
    expect(w.doc.haeuser).toBeUndefined();
  });
});

describe("loadWorldRow / loadVillageWorld", () => {
  it("fragt die Welt des Dorfs ab", async () => {
    const { client, log } = fakeClient({
      village_worlds: [{ data: { seed: "abcd1234", generator_version: 1, placements: { v: 1 } } }],
    });
    const res = await loadWorldRow(client, VILLAGE);
    expect(res).toEqual({
      ok: true,
      row: { seed: "abcd1234", generator_version: 1, placements: { v: 1 } },
    });
    expect(has(log.village_worlds[0], "eq", "village_id", VILLAGE)).toBe(true);
  });

  it("meldet eine fehlende Tabelle getrennt von anderen Fehlern", async () => {
    const a = fakeClient({ village_worlds: [{ error: missing }] });
    expect(await loadWorldRow(a.client, VILLAGE)).toEqual({ ok: false, reason: "no-table" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const b = fakeClient({
      village_worlds: [{ error: { code: "08006", message: "connection failure" } }],
    });
    expect(await loadWorldRow(b.client, VILLAGE)).toEqual({ ok: false, reason: "error" });
    spy.mockRestore();
  });

  it("liefert für die Anzeige den Ersatz, wenn Zeile oder Tabelle fehlen", async () => {
    const fallback = { seed: legacySeed(VILLAGE), version: 1, doc: { v: 1 }, stored: false };
    expect(
      await loadVillageWorld(fakeClient({ village_worlds: [{ data: null }] }).client, VILLAGE),
    ).toEqual(fallback);
    expect(
      await loadVillageWorld(fakeClient({ village_worlds: [{ error: missing }] }).client, VILLAGE),
    ).toEqual(fallback);
    expect(
      await loadVillageWorld(
        fakeClient({ village_worlds: [{ error: { code: "42P01" } }] }).client,
        VILLAGE,
      ),
    ).toEqual(fallback);
  });

  it("wirft nie, auch wenn der Client wirft", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      from: () => {
        throw new Error("Netzwerk");
      },
    } as unknown as SupabaseClient;
    expect((await loadVillageWorld(client, VILLAGE)).stored).toBe(false);
    spy.mockRestore();
  });

  it("liefert die gespeicherte Welt", async () => {
    const { client } = fakeClient({
      village_worlds: [{ data: { seed: "q1w2e3r4", generator_version: 1, placements: { v: 1 } } }],
    });
    expect(await loadVillageWorld(client, VILLAGE)).toEqual({
      seed: "q1w2e3r4",
      version: 1,
      doc: { v: 1 },
      stored: true,
    });
  });
});

describe("loadOwnWorld", () => {
  const houseRows = [
    {
      id: "z",
      kind: "zentrale",
      module_code: null,
      position_index: 0,
      created_at: "2026-10-01T00:00:00+00:00",
    },
    {
      id: "h2",
      kind: "modul",
      module_code: "NABA",
      position_index: 2,
      created_at: "2026-10-03T00:00:00+00:00",
    },
    {
      id: "h1",
      kind: "modul",
      module_code: "BAUSTATIK1",
      position_index: 1,
      created_at: "2026-10-02T00:00:00+00:00",
    },
  ];
  const artifactRows = [
    { id: "a2", house_id: "h1", kind: "quiz", sort: 1, created_at: "2026-10-05T00:00:00+00:00" },
    { id: "a1", house_id: "h1", kind: "rechner", sort: 0, created_at: "2026-10-06T00:00:00+00:00" },
  ];

  it("lädt nur das Dorf des Users samt Häusern, Objekten und Welt", async () => {
    const { client, log } = fakeClient({
      villages: [{ data: { id: VILLAGE } }],
      houses: [{ data: houseRows }],
      artifacts: [{ data: artifactRows }],
      village_worlds: [{ data: { seed: "abcd1234", generator_version: 1, placements: { v: 1 } } }],
    });
    const res = await loadOwnWorld(client, "user-1");
    expect(has(log.villages[0], "eq", "owner_id", "user-1")).toBe(true);
    expect(has(log.houses[0], "eq", "village_id", VILLAGE)).toBe(true);
    expect(has(log.artifacts[0], "in", "house_id")).toBe(true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.villageId).toBe(VILLAGE);
    expect(res.world).toEqual({ seed: "abcd1234", version: 1, doc: { v: 1 }, stored: true });
    expect(res.houses.map((h) => [h.id, h.fach, h.order])).toEqual([
      ["z", "weitere", 0],
      ["h2", "umwelt", 2],
      ["h1", "tragwerk", 1],
    ]);
    expect(res.houses[2].items).toEqual([
      { id: "a1", kind: "rechner" },
      { id: "a2", kind: "quiz" },
    ]);
  });

  it("nimmt bei fehlender Zeile den Ersatz-Seed (stored: false)", async () => {
    const { client } = fakeClient({
      villages: [{ data: { id: VILLAGE } }],
      houses: [{ data: houseRows }],
      artifacts: [{ data: [] }],
      village_worlds: [{ data: null }],
    });
    const res = await loadOwnWorld(client, "user-1");
    expect(res.ok && res.world).toEqual({
      seed: legacySeed(VILLAGE),
      version: 1,
      doc: { v: 1 },
      stored: false,
    });
  });

  it("überspringt die Objektabfrage in einem Dorf ohne Häuser", async () => {
    const { client, from } = fakeClient({
      villages: [{ data: { id: VILLAGE } }],
      houses: [{ data: [] }],
      village_worlds: [{ data: null }],
    });
    const res = await loadOwnWorld(client, "user-1");
    expect(res.ok && res.houses).toEqual([]);
    expect(from).not.toHaveBeenCalledWith("artifacts");
  });

  it("meldet fehlendes Dorf, fehlende Tabelle und Abfragefehler", async () => {
    expect(await loadOwnWorld(fakeClient({ villages: [{ data: null }] }).client, "u")).toEqual({
      ok: false,
      reason: "no-village",
    });
    expect(
      await loadOwnWorld(
        fakeClient({
          villages: [{ data: { id: VILLAGE } }],
          houses: [{ data: houseRows }],
          artifacts: [{ data: [] }],
          village_worlds: [{ error: missing }],
        }).client,
        "u",
      ),
    ).toEqual({ ok: false, reason: "no-table" });
    // Fehlt ein Teil der Häuser oder Objekte, wird nichts gerechnet
    expect(
      await loadOwnWorld(
        fakeClient({
          villages: [{ data: { id: VILLAGE } }],
          houses: [{ error: { code: "08006", message: "x" } }],
        }).client,
        "u",
      ),
    ).toEqual({ ok: false, reason: "error" });
    expect(
      await loadOwnWorld(
        fakeClient({
          villages: [{ data: { id: VILLAGE } }],
          houses: [{ data: houseRows }],
          artifacts: [{ error: { code: "08006", message: "x" } }],
        }).client,
        "u",
      ),
    ).toEqual({ ok: false, reason: "error" });
  });
});

describe("writeWorld", () => {
  const doc = { v: 1 as const, deko: [{ id: "d1", typ: "bank" as const, x: 1, z: 2, r: 0 }] };

  /** Admin-Fake: Antworten für `update` und `insert` in der Reihenfolge der Aufrufe. */
  function adminWith(...responses: Res[]) {
    const log: Call[][] = [];
    const queue = [...responses];
    admin.from.mockImplementation(() => {
      const calls: Call[] = [];
      log.push(calls);
      return builder(queue.shift() ?? { data: null }, calls);
    });
    return log;
  }

  beforeEach(() => admin.from.mockReset());

  it("aktualisiert mit beiden Filtern und fügt nichts ein, wenn die Zeile existiert", async () => {
    const log = adminWith({ data: [{ village_id: VILLAGE }] });
    expect(await writeWorld(VILLAGE, "user-1", { placements: doc })).toEqual({ ok: true });
    expect(log).toHaveLength(1);
    expect(has(log[0], "update")).toBe(true);
    expect(has(log[0], "eq", "village_id", VILLAGE)).toBe(true);
    expect(has(log[0], "eq", "owner_id", "user-1")).toBe(true);
  });

  it("schreibt Seed und Version nur, wenn sie mitgegeben werden", async () => {
    const log = adminWith({ data: [{ village_id: VILLAGE }] });
    await writeWorld(VILLAGE, "user-1", {
      placements: doc,
      seed: "neuerseed",
      generator_version: 1,
    });
    const update = log[0].find(([m]) => m === "update")!;
    expect(update[1][0]).toEqual({ placements: doc, seed: "neuerseed", generator_version: 1 });
    const log2 = adminWith({ data: [{ village_id: VILLAGE }] });
    await writeWorld(VILLAGE, "user-1", { placements: doc });
    expect(log2[0].find(([m]) => m === "update")![1][0]).toEqual({ placements: doc });
  });

  it("fügt bei fehlender Zeile mit Ersatz-Seed ein", async () => {
    const log = adminWith({ data: [] }, { data: null });
    expect(await writeWorld(VILLAGE, "user-1", { placements: doc })).toEqual({ ok: true });
    expect(log).toHaveLength(2);
    expect(log[1].find(([m]) => m === "insert")![1][0]).toEqual({
      village_id: VILLAGE,
      owner_id: "user-1",
      seed: legacySeed(VILLAGE),
      generator_version: 1,
      placements: doc,
    });
  });

  it("fügt bei fehlender Zeile mit dem neuen Seed ein, wenn er mitgegeben wird", async () => {
    const log = adminWith({ data: [] }, { data: null });
    await writeWorld(VILLAGE, "user-1", {
      placements: doc,
      seed: "neuerseed",
      generator_version: 1,
    });
    expect((log[1].find(([m]) => m === "insert")![1][0] as { seed: string }).seed).toBe(
      "neuerseed",
    );
  });

  it("meldet eine fehlende Tabelle und andere Fehler", async () => {
    adminWith({ error: missing });
    expect(await writeWorld(VILLAGE, "user-1", { placements: doc })).toEqual({
      ok: false,
      reason: "no-table",
    });
    adminWith({ data: [] }, { error: { code: "42P01", message: "x" } });
    expect(await writeWorld(VILLAGE, "user-1", { placements: doc })).toEqual({
      ok: false,
      reason: "no-table",
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    adminWith({ error: { code: "23514", message: "check violation" } });
    expect(await writeWorld(VILLAGE, "user-1", { placements: doc })).toEqual({
      ok: false,
      reason: "error",
    });
    spy.mockRestore();
  });
});

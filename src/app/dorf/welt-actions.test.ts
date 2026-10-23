import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateWorld } from "@/lib/world/generate";
import { toLayoutHouses, type HouseRow } from "@/lib/world/layout-houses";
import { checkDeko } from "@/lib/world/rules";
import type { DekoItem, WorldDoc } from "@/lib/world/doc";
import type { OwnWorld } from "@/lib/world/server-data";
import { GENERATOR_VERSION } from "@/lib/world/seed";

// Die Aktionen laufen hier ohne Datenbank: Sitzung, Laden und Schreiben sind Fakes, die Welt rechnet echt.
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  loadOwnWorld: vi.fn(),
  writeWorld: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/world/server-data", () => ({
  loadOwnWorld: mocks.loadOwnWorld,
  writeWorld: mocks.writeWorld,
}));

import { rerollWorld, saveWorld } from "./welt-actions";

const VILLAGE = "3f2b8c1e-9a47-4d6b-8e35-1c7a5d02b9f4";
const USER = "user-1";

const rows: HouseRow[] = [
  { id: "z", kind: "zentrale", module_code: null, created_at: "2026-10-01T00:00:00Z" },
  ...["BAUSTATIK1", "NABA", "ET", "MATH1A", "DATA1_MM", "BRE"].map((code, i) => ({
    id: `h${i + 1}`,
    kind: "modul" as const,
    module_code: code,
    created_at: `2026-10-0${i + 2}T00:00:00Z`,
  })),
];
const houses = toLayoutHouses(rows, []);

const own = (
  seed: string,
  doc: WorldDoc = { v: 1 },
  stored = true,
  version: number = GENERATOR_VERSION,
): OwnWorld => ({
  ok: true,
  villageId: VILLAGE,
  houses,
  world: { seed, version, doc, stored },
});

const bank = (id: string, x: number, z: number): DekoItem => ({ id, typ: "bank", x, z, r: 0 });

/**
 * Raster von Bank-Positionen (5 m Abstand), die der Server in der Welt des Seeds annimmt. Eigene Deko wird vor
 * den automatisch gesetzten Häusern eingetragen (die Häuser weichen aus); deshalb zählt nur die Karte mit
 * der Zentrale, nicht die fertige Siedlung.
 */
function validSpots(seed: string): Set<string> {
  const space = generateWorld({
    seed,
    houses: houses.filter((h) => h.kind === "zentrale"),
  }).editSpace;
  const out = new Set<string>();
  for (let x = -45; x <= 45; x += 5) {
    for (let z = -45; z <= 45; z += 5) if (!checkDeko(space, bank("t", x, z))) out.add(`${x},${z}`);
  }
  return out;
}
const spot = (key: string, id: string): DekoItem => {
  const [x, z] = key.split(",").map(Number);
  return bank(id, x, z);
};

/** Zwei Seeds, in denen manche Positionen nur im ersten gültig sind und andere in beiden (einmal berechnet). */
let pair: ReturnType<typeof findSeedPair> | undefined;
const seedPair = () => (pair ??= findSeedPair());
function findSeedPair() {
  const a = "abcd1234";
  const va = validSpots(a);
  for (const b of [
    "wxyz5678",
    "q1w2e3r4",
    "zz99aa11",
    "hubdome1",
    "m0n1b2v3",
    "k8j7h6g5",
    "ab12cd34",
  ]) {
    const vb = validSpots(b);
    const both = [...va].filter((k) => vb.has(k));
    const onlyA = [...va].filter((k) => !vb.has(k));
    if (both.length >= 1 && onlyA.length >= 2) return { a, b, both, onlyA };
  }
  throw new Error("Kein passendes Seed-Paar gefunden");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ supabase: {}, user: { id: USER } });
  mocks.writeWorld.mockResolvedValue({ ok: true });
  mocks.loadOwnWorld.mockResolvedValue(own("abcd1234"));
});

describe("saveWorld", () => {
  it("lehnt ungültige Eingaben ab, ohne etwas zu laden", async () => {
    for (const bad of [
      null,
      "x",
      { v: 2 },
      { v: 1, deko: [{ id: "d", typ: "ufo", x: 0, z: 0, r: 0 }] },
      { v: 1, deko: [bank("d", 0, 0.1)].map((d) => ({ ...d, r: 7 })) },
    ]) {
      expect(await saveWorld(bad)).toEqual({ error: "Die Platzierungen sind ungültig." });
    }
    expect(mocks.loadOwnWorld).not.toHaveBeenCalled();
    expect(mocks.writeWorld).not.toHaveBeenCalled();
  });

  it("speichert gültige Platzierungen mit dem Besitzer aus der Sitzung", async () => {
    const [k] = [...validSpots("abcd1234")];
    const doc: WorldDoc = { v: 1, deko: [spot(k, "d1")], varianten: { h1: { farbe: 2 } } };
    expect(await saveWorld(doc)).toEqual({ ok: true });
    expect(mocks.loadOwnWorld).toHaveBeenCalledWith(expect.anything(), USER);
    expect(mocks.writeWorld).toHaveBeenCalledWith(VILLAGE, USER, { placements: doc });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rechnet mit dem gespeicherten Seed: dieselbe Deko ist im einen gültig, im anderen nicht", async () => {
    const { a, b, onlyA } = seedPair();
    const doc: WorldDoc = { v: 1, deko: [spot(onlyA[0], "d1")] };
    mocks.loadOwnWorld.mockResolvedValue(own(a));
    expect(await saveWorld(doc)).toEqual({ ok: true });
    mocks.loadOwnWorld.mockResolvedValue(own(b));
    const res = await saveWorld(doc);
    expect(res).toMatchObject({ error: "Einige Elemente passen nicht an ihren Platz." });
    expect("abgewiesen" in res && res.abgewiesen?.map((r) => r.id)).toEqual(["d1"]);
  });

  it("speichert nichts, wenn Deko abgewiesen wird, und nennt Element und Grund", async () => {
    const [k] = [...validSpots("abcd1234")];
    const res = await saveWorld({ v: 1, deko: [spot(k, "gut"), bank("schlecht", 0, 0)] });
    expect(res).toMatchObject({ error: "Einige Elemente passen nicht an ihren Platz." });
    const list = "abgewiesen" in res ? res.abgewiesen : undefined;
    expect(list).toHaveLength(1);
    expect(list![0].id).toBe("schlecht");
    expect(list![0].grund.length).toBeGreaterThan(3);
    expect(mocks.writeWorld).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("speichert nichts bei ungültigen Fixierungen (Haus und Quartier)", async () => {
    // Quartier «umwelt» (h2) auf Ausgang 3 fixiert, aber Haus h1 (tragwerk) auf einen Platz, den es dort nicht gibt
    const res = await saveWorld({ v: 1, haeuser: { h1: { r: 5, s: "g0" } } });
    expect(res).toMatchObject({ error: "Einige Elemente passen nicht an ihren Platz." });
    expect("abgewiesen" in res && res.abgewiesen?.map((r) => r.id)).toEqual(["h1"]);
    const q = await saveWorld({ v: 1, quartiere: { tragwerk: [1, 1] } });
    expect("abgewiesen" in q && q.abgewiesen?.[0].id).toBe("tragwerk:1");
    expect("abgewiesen" in q && q.abgewiesen?.[0].grund).toContain("Tragwerk & Bau");
    expect(mocks.writeWorld).not.toHaveBeenCalled();
  });

  it("entfernt Einträge zu Häusern, die es nicht gibt", async () => {
    await saveWorld({
      v: 1,
      haeuser: { fremd: { r: 1, s: "p0" } },
      varianten: { fremd: { farbe: 1 }, h2: { farbe: 3 } },
    });
    expect(mocks.writeWorld).toHaveBeenCalledWith(VILLAGE, USER, {
      placements: { v: 1, haeuser: {}, varianten: { h2: { farbe: 3 } } },
    });
  });

  it("entfernt erfundene Einträge, bevor die Grösse des Dokuments geprüft wird", async () => {
    const haeuser = Object.fromEntries(
      Array.from({ length: 1500 }, (_, i) => [`x${i}`, { r: 1, s: "p0" }]),
    );
    expect(await saveWorld({ v: 1, haeuser })).toEqual({ ok: true });
    expect(mocks.writeWorld).toHaveBeenCalledWith(VILLAGE, USER, {
      placements: { v: 1, haeuser: {} },
    });
  });

  it("meldet freundlich, wenn die Tabelle fehlt", async () => {
    mocks.loadOwnWorld.mockResolvedValue({ ok: false, reason: "no-table" });
    expect(await saveWorld({ v: 1 })).toEqual({
      error: "Speichern ist erst nach dem Datenbank-Update möglich.",
    });
    mocks.loadOwnWorld.mockResolvedValue(own("abcd1234"));
    mocks.writeWorld.mockResolvedValue({ ok: false, reason: "no-table" });
    expect(await saveWorld({ v: 1 })).toEqual({
      error: "Speichern ist erst nach dem Datenbank-Update möglich.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("meldet fehlendes Dorf, Ladefehler und Schreibfehler", async () => {
    mocks.loadOwnWorld.mockResolvedValue({ ok: false, reason: "no-village" });
    expect(await saveWorld({ v: 1 })).toEqual({ error: "Dorf nicht gefunden." });
    mocks.loadOwnWorld.mockResolvedValue({ ok: false, reason: "error" });
    expect(await saveWorld({ v: 1 })).toEqual({ error: "Das Dorf konnte nicht geladen werden." });
    mocks.loadOwnWorld.mockResolvedValue(own("abcd1234"));
    mocks.writeWorld.mockResolvedValue({ ok: false, reason: "error" });
    expect(await saveWorld({ v: 1 })).toEqual({
      error: "Die Welt konnte nicht gespeichert werden.",
    });
  });
});

describe("rerollWorld", () => {
  it("lehnt ungültige Eingaben ab", async () => {
    for (const bad of [
      null,
      {},
      { seed: "kurz", resetPlacements: true },
      { seed: "abcd1234" },
      { seed: "ABCD1234", resetPlacements: false },
      { seed: "abcd1234", resetPlacements: "ja" },
    ]) {
      expect(await rerollWorld(bad)).toEqual({ error: "Ungültige Eingabe." });
    }
    expect(mocks.loadOwnWorld).not.toHaveBeenCalled();
  });

  it("setzt mit resetPlacements alles zurück und speichert den gezeigten Seed", async () => {
    const { a } = seedPair();
    mocks.loadOwnWorld.mockResolvedValue(
      own(a, {
        v: 1,
        deko: [bank("d1", 0, 0)],
        haeuser: { h1: { r: 1, s: "p0" } },
        varianten: { h1: { farbe: 1 } },
      }),
    );
    expect(await rerollWorld({ seed: "wxyz5678", resetPlacements: true })).toEqual({
      ok: true,
      entfernt: 0,
    });
    expect(mocks.writeWorld).toHaveBeenCalledWith(VILLAGE, USER, {
      placements: { v: 1 },
      seed: "wxyz5678",
      generator_version: GENERATOR_VERSION,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("behält Deko und Varianten, entfernt aber fixierte Quartiere und Häuser", async () => {
    const { b, both } = seedPair();
    const deko = [spot(both[0], "d1")];
    mocks.loadOwnWorld.mockResolvedValue(
      own("abcd1234", {
        v: 1,
        quartiere: { tragwerk: [2] },
        haeuser: { h1: { r: 2, s: "p0" } },
        deko,
        varianten: { h1: { dach: 1 }, fremd: { dach: 2 } },
      }),
    );
    expect(await rerollWorld({ seed: b, resetPlacements: false })).toEqual({
      ok: true,
      entfernt: 0,
    });
    expect(mocks.writeWorld).toHaveBeenCalledWith(VILLAGE, USER, {
      placements: { v: 1, deko, varianten: { h1: { dach: 1 } } },
      seed: b,
      generator_version: GENERATOR_VERSION,
    });
  });

  it("verwirft Deko nie stillschweigend: Fehler mit Liste, nichts gespeichert", async () => {
    const { a, b, both, onlyA } = seedPair();
    mocks.loadOwnWorld.mockResolvedValue(
      own(a, {
        v: 1,
        deko: [spot(both[0], "bleibt"), spot(onlyA[0], "weg1"), spot(onlyA[1], "weg2")],
      }),
    );
    const res = await rerollWorld({ seed: b, resetPlacements: false });
    expect(res).toMatchObject({
      error: "Einige Elemente passen in der neuen Landschaft nicht an ihren Platz.",
    });
    const ids = "abgewiesen" in res ? res.abgewiesen?.map((r) => r.id).sort() : undefined;
    expect(ids).toEqual(["weg1", "weg2"]);
    expect(mocks.writeWorld).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("entfernt mit dropInvalid genau die ungültigen Elemente und meldet die Anzahl", async () => {
    const { a, b, both, onlyA } = seedPair();
    const keep = spot(both[0], "bleibt");
    mocks.loadOwnWorld.mockResolvedValue(
      own(a, { v: 1, deko: [keep, spot(onlyA[0], "weg1"), spot(onlyA[1], "weg2")] }),
    );
    expect(await rerollWorld({ seed: b, resetPlacements: false, dropInvalid: true })).toEqual({
      ok: true,
      entfernt: 2,
    });
    const [, , patch] = mocks.writeWorld.mock.calls[0];
    expect(patch).toEqual({
      placements: { v: 1, deko: [keep] },
      seed: b,
      generator_version: GENERATOR_VERSION,
    });
    // Das gespeicherte Dokument ist in der neuen Welt vollständig gültig
    const again = generateWorld({ seed: b, houses, doc: patch.placements });
    expect(again.rejected).toEqual([]);
    expect(again.deko).toEqual([keep]);
  });

  it("aktualisiert ein v1-Dorf mit gleichem Seed auf v2: Deko, Varianten und Hausplätze bleiben, alles fixiert", async () => {
    const seed = "abcd1234";
    const v1 = generateWorld({ seed, version: 1, houses });
    const pins = Object.fromEntries(
      Object.values(v1.settlement.houses).map((h) => [h.id, { r: h.dir, s: h.slot }]),
    );
    mocks.loadOwnWorld.mockResolvedValue(
      own(seed, { v: 1, haeuser: pins, varianten: { h1: { farbe: 2 } } }, true, 1),
    );
    expect(await rerollWorld({ seed, resetPlacements: false })).toEqual({ ok: true, entfernt: 0 });
    const [, , patch] = mocks.writeWorld.mock.calls[0];
    expect(patch.seed).toBe(seed);
    expect(patch.generator_version).toBe(GENERATOR_VERSION);
    expect(patch.placements.varianten).toEqual({ h1: { farbe: 2 } });
    // Jedes Haus ist fixiert; die gespeicherte Welt rechnet ohne Abweisungen
    expect(Object.keys(patch.placements.haeuser).sort()).toEqual(
      houses
        .filter((h) => h.kind !== "zentrale")
        .map((h) => h.id)
        .sort(),
    );
    const again = generateWorld({
      seed,
      version: GENERATOR_VERSION,
      houses,
      doc: patch.placements,
    });
    expect(again.settlement.droppedPins).toEqual([]);
    expect(again.settlement.unplaced).toEqual([]);
  });

  it("meldet freundlich, wenn die Tabelle fehlt, und andere Fehler", async () => {
    mocks.loadOwnWorld.mockResolvedValue({ ok: false, reason: "no-table" });
    expect(await rerollWorld({ seed: "abcd1234", resetPlacements: true })).toEqual({
      error: "Neu würfeln ist erst nach dem Datenbank-Update möglich.",
    });
    mocks.loadOwnWorld.mockResolvedValue({ ok: false, reason: "no-village" });
    expect(await rerollWorld({ seed: "abcd1234", resetPlacements: true })).toEqual({
      error: "Dorf nicht gefunden.",
    });
    mocks.loadOwnWorld.mockResolvedValue(own("abcd1234"));
    mocks.writeWorld.mockResolvedValue({ ok: false, reason: "error" });
    expect(await rerollWorld({ seed: "abcd1234", resetPlacements: true })).toEqual({
      error: "Die Welt konnte nicht gespeichert werden.",
    });
  });
});

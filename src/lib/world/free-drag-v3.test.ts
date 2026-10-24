import { describe, expect, it } from "vitest";
import { FACH_ORDER, type FachbereichId } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { seededRandom } from "../random";
import type { WorldDoc } from "./doc";
import { dragBase, houseGhost, quarterDeko, quarterMove } from "./free-drag";
import { generateWorld, type World } from "./generate";
import type { QuarterRoad } from "./roads";
import { makeSeed } from "./seed";
import { pinsFromSettlement } from "./settlement";
import { DISTS, village, violations } from "./test-world";

/**
 * Generator v3: Häuser ziehen und Quartiere verschieben auch bei Ring, Halbkreis und Intelligent. Was gültig
 * ist, steht nach dem Speichern genau dort, ohne dass sonst etwas wandert; sonst gibt es einen Grund.
 */
const SEEDS = Array.from({ length: 16 }, (_, i) => makeSeed(seededRandom(`frei3-${i}`)));
const FORMS: QuarterRoad[] = [
  { form: "gasse" },
  { form: "ring", radius: 6 },
  { form: "halbkreis", radius: 7 },
  { form: "intelligent", curve: 1 },
];

function setup(seed: string, i: number) {
  const q = FACH_ORDER[i % FACH_ORDER.length] as FachbereichId;
  const hs: LayoutHouse[] = village(6, DISTS.gemischt, seed);
  for (let k = 0; k < 6; k++)
    hs.push({ id: `q${k}`, kind: "modul", fach: q, order: 100 + k, items: [] });
  const road = FORMS[i % FORMS.length];
  const w0 = generateWorld({ version: 3, seed, houses: hs });
  const doc0: WorldDoc = {
    v: 1,
    quartiere: pinsFromSettlement(w0.settlement).quartiere,
    quarterRoads: { [q]: road },
  };
  const w1 = generateWorld({ version: 3, seed, houses: hs, doc: doc0 });
  // Gespeichert wie im Bau-Modus: alles fixiert
  const doc: WorldDoc = { ...doc0, ...pinsFromSettlement(w1.settlement) };
  const world = generateWorld({ version: 3, seed, houses: hs, doc });
  return { q, hs, road, doc, world, input: { seed, version: 3, houses: hs, doc } };
}

const others = (a: World, b: World, skip: ReadonlySet<string>) =>
  Object.keys(a.settlement.houses)
    .filter((id) => !skip.has(id))
    .filter(
      (id) =>
        a.settlement.houses[id].x !== b.settlement.houses[id]?.x ||
        a.settlement.houses[id].z !== b.settlement.houses[id]?.z,
    );

describe("v3: Haus ziehen", () => {
  it("gültige Lagen halten beim Speichern, andere Häuser bleiben stehen", () => {
    let ok = 0;
    let bad = 0;
    SEEDS.forEach((seed, i) => {
      const { q, doc, world, input } = setup(seed, i);
      const ids = Object.values(world.settlement.houses)
        .filter((h) => h.quarterId === q)
        .map((h) => h.id);
      if (!ids.length) return;
      const r = seededRandom(`zug3-${seed}`);
      const id = ids[Math.floor(r() * ids.length)];
      const h = world.settlement.houses[id];
      const base = dragBase(input, world, q, new Set([id]));
      for (let k = 0; k < 8; k++) {
        const g = houseGhost(base, id, h.x + (r() - 0.5) * 30, h.z + (r() - 0.5) * 30);
        if (!g.ok) {
          expect(g.grund.length).toBeGreaterThan(2);
          bad++;
          continue;
        }
        ok++;
        const next: WorldDoc = {
          ...doc,
          haeuser: { ...doc.haeuser, [id]: { r: g.dir, x: g.x, z: g.z } },
        };
        const w2 = generateWorld({ ...input, doc: next });
        expect(w2.settlement.droppedPins, `${seed} ${id}`).toEqual([]);
        expect([w2.settlement.houses[id].x, w2.settlement.houses[id].z]).toEqual([g.x, g.z]);
        expect(w2.settlement.houses[id].angle).toBeCloseTo(g.angle, 6);
        expect(others(world, w2, new Set([id]))).toEqual([]);
        expect(violations(w2), `${seed} ${id}`).toEqual([]);
      }
    });
    expect(ok).toBeGreaterThan(10);
    expect(bad).toBeGreaterThan(10);
  }, 120_000);
});

describe("v3: quarterMove", () => {
  it("gültige Verschiebungen halten, ungültige nennen einen Grund", () => {
    let ok = 0;
    let bad = 0;
    SEEDS.forEach((seed, i) => {
      const { q, doc, world, input } = setup(seed, i);
      const members = Object.values(world.settlement.houses)
        .filter((h) => h.quarterId === q)
        .map((h) => ({ id: h.id, x: h.x, z: h.z }));
      if (!members.length) return;
      const deko = quarterDeko(world, q);
      const base = dragBase(input, world, q, new Set(members.map((m) => m.id)));
      const r = seededRandom(`schub-${seed}`);
      for (let k = 0; k < 5; k++) {
        // Kleine Schritte (wie beim Ziehen am Griff): Ring und Halbkreis lassen wenig Spiel
        const dx = Math.round((r() - 0.5) * 5) / 2;
        const dz = Math.round((r() - 0.5) * 5) / 2;
        const m = quarterMove(base, members, deko, dx, dz);
        if (!m.ok) {
          expect(m.grund.length).toBeGreaterThan(2);
          bad++;
          continue;
        }
        ok++;
        const haeuser = { ...doc.haeuser };
        for (const [id, p] of Object.entries(m.poses)) haeuser[id] = { r: p.dir, x: p.x, z: p.z };
        const w2 = generateWorld({ ...input, doc: { ...doc, haeuser } });
        expect(w2.settlement.droppedPins, `${seed} ${dx},${dz}`).toEqual([]);
        for (const mem of members) {
          expect(w2.settlement.houses[mem.id].x).toBeCloseTo(mem.x + dx, 1);
          expect(w2.settlement.houses[mem.id].z).toBeCloseTo(mem.z + dz, 1);
        }
        expect(others(world, w2, new Set(members.map((x) => x.id)))).toEqual([]);
        expect(violations(w2)).toEqual([]);
      }
    });
    expect(ok).toBeGreaterThan(3);
    expect(bad).toBeGreaterThan(3);
  }, 120_000);
});

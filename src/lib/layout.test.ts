import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "./fachbereiche";
import {
  computeLayout,
  houseTier,
  plotCorners,
  satOverlap,
  TERRACE_MIN,
  ZENTRALE_RING_R,
  type LayoutHouse,
} from "./layout";
import { ARTIFACT_KINDS } from "./types";

/** n Häuser, reihum auf `spread` Fachbereiche verteilt, je `items` Objekte. */
function make(n: number, spread = 3, items = 0): LayoutHouse[] {
  return [
    { id: "z", kind: "zentrale", fach: "weitere", items: [] },
    ...Array.from({ length: n }, (_, i) => ({
      id: `h${i}`,
      kind: "modul" as const,
      fach: FACH_ORDER[(i * 7 + (i % spread)) % spread],
      items: Array.from({ length: items + (i % 3 === 0 ? 2 : 0) }, (_, j) => ({
        id: `a${i}-${j}`,
        kind: ARTIFACT_KINDS[(i + j) % ARTIFACT_KINDS.length],
      })),
    })),
  ];
}

describe("houseTier", () => {
  it.each([
    [0, 1],
    [2, 1],
    [3, 2],
    [6, 2],
    [7, 3],
    [40, 3],
  ])("%i Objekte → Stufe %i", (n, tier) => expect(houseTier(n)).toBe(tier));
});

describe("computeLayout", () => {
  it("setzt die Zentrale in den Ursprung, leeres Dorf hat keine Wege", () => {
    const l = computeLayout(make(0));
    expect(l.houses.z).toMatchObject({ x: 0, z: 0 });
    expect(Object.keys(l.houses)).toEqual(["z"]);
    expect(l.paths).toEqual([]);
  });

  it("ist deterministisch", () => {
    expect(computeLayout(make(12, 4, 2))).toEqual(computeLayout(make(12, 4, 2)));
  });

  it("gruppiert die Häuser nach Fachbereich in Quartieren", () => {
    const l = computeLayout(make(9, 3));
    expect(l.quarters).toHaveLength(3);
    expect(l.quarters.reduce((s, q) => s + q.houseIds.length, 0)).toBe(9);
    for (const q of l.quarters) {
      for (const id of q.houseIds) expect(l.houses[id].quarterId).toBe(q.id);
    }
  });

  it("Hausfront zeigt zum Nebenplatz des Quartiers", () => {
    const l = computeLayout(make(6, 2));
    for (const q of l.quarters) {
      for (const id of q.houseIds) {
        const h = l.houses[id];
        const f = { x: Math.sin(h.angle), z: Math.cos(h.angle) };
        const to = { x: q.x - h.x, z: q.z - h.z };
        const len = Math.hypot(to.x, to.z);
        expect(f.x * (to.x / len) + f.z * (to.z / len)).toBeGreaterThan(0.999);
      }
    }
  });

  it("Hausgrösse folgt der Anzahl Objekte", () => {
    const hs = make(3, 1);
    hs[1].items = [];
    hs[2].items = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, kind: "quiz" as const }));
    hs[3].items = Array.from({ length: 9 }, (_, i) => ({ id: `y${i}`, kind: "quiz" as const }));
    const l = computeLayout(hs);
    expect(l.houses.h0.tier).toBe(1);
    expect(l.houses.h1.tier).toBe(2);
    expect(l.houses.h2.tier).toBe(3);
    expect(l.houses.h2.footprint).toBeGreaterThan(l.houses.h0.footprint);
  });

  it("Objekt-Plätze: genau ein Platz pro Objekt, links/rechts des Wegs, vor dem Haus", () => {
    const l = computeLayout(make(4, 1, 7));
    for (const h of Object.values(l.houses)) {
      if (!h.plot) continue;
      const ids = h.plot.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of h.plot.slots) {
        expect(Math.abs(s.x)).toBeGreaterThan(1);
        expect(s.z).toBeGreaterThan(h.footprint);
        expect(s.z).toBeLessThan(h.plot.front);
      }
    }
  });

  it("kein Grundstück überlappt ein anderes (5–50 Häuser, verschiedene Verteilungen)", () => {
    for (const n of [5, 8, 12, 20, 30, 40, 50]) {
      for (const spread of [1, 3, 5, 9]) {
        for (const items of [0, 3, 9]) {
          const l = computeLayout(make(n, spread, items));
          const hs = Object.values(l.houses).filter((h) => h.plot);
          const cs = hs.map((h) => plotCorners(h.x, h.z, h.angle, h.plot!));
          for (let i = 0; i < cs.length; i++) {
            for (let j = i + 1; j < cs.length; j++) {
              expect(satOverlap(cs[i], cs[j]), `n=${n} spread=${spread} items=${items}`).toBe(
                false,
              );
            }
          }
        }
      }
    }
  });

  it("extent umfasst alle Häuser", () => {
    const l = computeLayout(make(30, 5, 3));
    for (const h of Object.values(l.houses)) expect(Math.hypot(h.x, h.z)).toBeLessThan(l.extent);
  });
});

describe("Objekt-Ring der Zentrale", () => {
  const withZentrale = (n: number, houses = 8) => {
    const list = make(houses, 3, 1);
    list[0] = {
      ...list[0],
      items: Array.from({ length: n }, (_, j) => ({
        id: `z${j}`,
        kind: ARTIFACT_KINDS[j % ARTIFACT_KINDS.length],
      })),
    };
    return list;
  };

  it("ohne Objekte: kein Ring, Terrasse und Platz wie bisher", () => {
    const l = computeLayout(make(8, 3, 1));
    expect(l.houses.z.ring).toBeNull();
    expect(l.houses.z.plot).toBeNull();
    expect(l.terrace).toBe(TERRACE_MIN);
  });

  it.each([1, 5, 12, 40])("%i Objekte: alle im Ring, auf der Terrasse, vorne frei", (n) => {
    const l = computeLayout(withZentrale(n));
    const ring = l.houses.z.ring!;
    expect(ring.map((s) => s.id).sort()).toEqual(
      Array.from({ length: n }, (_, j) => `z${j}`).sort(),
    );
    for (const s of ring) {
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeGreaterThanOrEqual(ZENTRALE_RING_R - 0.01);
      expect(r).toBeLessThan(l.terrace);
      // Bogen vor der Zentrale (+z) bleibt für Figur und Treppe frei
      expect(Math.atan2(s.z, s.x)).not.toBeCloseTo(Math.PI / 2, 0);
    }
    // Platz und Quartiere liegen ausserhalb der Terrasse
    expect(l.plazaRadius).toBeGreaterThan(l.terrace + 4);
    for (const q of l.quarters) expect(Math.hypot(q.x, q.z) - q.radius).toBeGreaterThan(l.terrace);
  });

  it("Plätze überschneiden sich nicht", () => {
    const ring = computeLayout(withZentrale(40)).houses.z.ring!;
    for (let i = 0; i < ring.length; i++)
      for (let j = i + 1; j < ring.length; j++)
        expect(Math.hypot(ring[i].x - ring[j].x, ring[i].z - ring[j].z)).toBeGreaterThan(1);
  });
});

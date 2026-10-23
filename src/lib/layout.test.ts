import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "./fachbereiche";
import {
  computeLayout,
  houseTier,
  plotCorners,
  satOverlap,
  TERRACE_MIN,
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

describe("computeLayout (Format für die Szene)", () => {
  it("setzt die Zentrale in den Ursprung, leeres Dorf hat keine Wege (höchstens den Wanderweg)", () => {
    const l = computeLayout(make(0));
    expect(l.houses.z).toMatchObject({ x: 0, z: 0 });
    expect(Object.keys(l.houses)).toEqual(["z"]);
    expect(l.paths.filter((p) => p.kind !== "pfad")).toEqual([]);
  });

  it("ist deterministisch", () => {
    expect(computeLayout(make(12, 4, 2))).toEqual(computeLayout(make(12, 4, 2)));
  });

  it("gruppiert die Häuser nach Fachbereich in Quartieren", () => {
    const l = computeLayout(make(9, 3));
    expect(l.quarters).toHaveLength(3);
    expect(l.quarters.reduce((s, q) => s + q.houseIds.length, 0)).toBe(9);
    for (const q of l.quarters)
      for (const id of q.houseIds) expect(l.houses[id].quarterId).toBe(q.id);
  });

  it("jedes Tor liegt an einem Weg oder am Quartierplatz", () => {
    const l = computeLayout(make(14, 4, 1));
    for (const h of Object.values(l.houses)) {
      if (!h.plot) continue;
      const gate = {
        x: h.x + Math.sin(h.angle) * h.plot.front,
        z: h.z + Math.cos(h.angle) * h.plot.front,
      };
      const nearPath = l.paths.some((p) =>
        p.points.some((q) => Math.hypot(q.x - gate.x, q.z - gate.z) < p.width / 2 + 0.9),
      );
      const nearPlaza = l.quarters.some(
        (q) => Math.hypot(q.x - gate.x, q.z - gate.z) < q.rp / Math.cos(Math.PI / 8) + 0.9,
      );
      expect(nearPath || nearPlaza, h.id).toBe(true);
    }
  });

  it("Hausgrösse folgt der Anzahl Objekte, das Grundstück bleibt gleich", () => {
    const hs = make(3, 1);
    hs[1].items = [];
    hs[2].items = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, kind: "quiz" as const }));
    hs[3].items = Array.from({ length: 9 }, (_, i) => ({ id: `y${i}`, kind: "quiz" as const }));
    const l = computeLayout(hs);
    expect(l.houses.h0.tier).toBe(1);
    expect(l.houses.h1.tier).toBe(2);
    expect(l.houses.h2.tier).toBe(3);
    expect(l.houses.h2.footprint).toBeGreaterThan(l.houses.h0.footprint);
    expect(l.houses.h2.plot!.hw).toBe(l.houses.h0.plot!.hw);
  });

  it("Objekt-Plätze: genau ein Platz pro Objekt (bis 12), links/rechts des Gartenwegs, vor dem Haus", () => {
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
    for (const n of [5, 12, 30, 50]) {
      for (const spread of [1, 3, 9]) {
        const l = computeLayout(make(n, spread, 3));
        const hs = Object.values(l.houses).filter((h) => h.plot);
        const cs = hs.map((h) => plotCorners(h.x, h.z, h.angle, h.plot!));
        for (let i = 0; i < cs.length; i++) {
          for (let j = i + 1; j < cs.length; j++) {
            expect(satOverlap(cs[i], cs[j]), `n=${n} spread=${spread}`).toBe(false);
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
  const withZentrale = (n: number) => {
    const list = make(8, 3, 1);
    list[0] = {
      ...list[0],
      items: Array.from({ length: n }, (_, j) => ({ id: `z${j}`, kind: ARTIFACT_KINDS[j % 7] })),
    };
    return list;
  };

  it("ohne Objekte: kein Ring, Terrasse in Grundgrösse", () => {
    const l = computeLayout(make(8, 3, 1));
    expect(l.houses.z.ring).toBeNull();
    expect(l.houses.z.plot).toBeNull();
    expect(l.terrace).toBe(TERRACE_MIN);
  });

  it.each([1, 5, 12, 20])("%i Objekte: alle im Ring auf dem Dorfplatz, vorne frei", (n) => {
    const l = computeLayout(withZentrale(n));
    const ring = l.houses.z.ring!;
    expect(ring.map((s) => s.id).sort()).toEqual(
      Array.from({ length: n }, (_, j) => `z${j}`).sort(),
    );
    for (const s of ring) {
      expect(Math.hypot(s.x, s.z)).toBeLessThan(l.plazaRadius - 3.5);
      expect(Math.atan2(s.z, s.x)).not.toBeCloseTo(Math.PI / 2, 0);
    }
    for (let i = 0; i < ring.length; i++)
      for (let j = i + 1; j < ring.length; j++)
        expect(Math.hypot(ring[i].x - ring[j].x, ring[i].z - ring[j].z)).toBeGreaterThan(1);
  });
});

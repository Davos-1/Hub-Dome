import { describe, expect, it } from "vitest";
import { artifactSlots, computeLayout, houseTier, type LayoutHouse } from "./layout";

const make = (n: number): LayoutHouse[] => [
  { id: "z", kind: "zentrale" },
  ...Array.from({ length: n }, (_, i) => ({ id: `h${i}`, kind: "modul" as const })),
];

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
  it("setzt die Zentrale in den Ursprung", () => {
    const l = computeLayout(make(3), {});
    expect(l.houses.z).toMatchObject({ x: 0, z: 0, ring: 0 });
  });

  it("ist deterministisch", () => {
    expect(computeLayout(make(12), { h1: 5 })).toEqual(computeLayout(make(12), { h1: 5 }));
  });

  it("bis 7 Häuser auf dem ersten Ring, ab dem 8. auf dem zweiten", () => {
    const seven = computeLayout(make(7), {});
    expect(new Set(Object.values(seven.houses).map((h) => h.ring))).toEqual(new Set([0, 1]));
    const eight = computeLayout(make(8), {});
    expect(eight.houses.h7.ring).toBe(2);
    expect(eight.houses.h6.ring).toBe(1);
  });

  it("alle Häuser eines Rings haben denselben Abstand zur Zentrale", () => {
    const l = computeLayout(make(7), {});
    const radii = Object.values(l.houses)
      .filter((h) => h.ring === 1)
      .map((h) => Math.hypot(h.x, h.z));
    radii.forEach((r) => expect(r).toBeCloseTo(radii[0], 2));
  });

  it("Häuser überlappen sich nicht (30 Häuser)", () => {
    const l = computeLayout(make(30), Object.fromEntries(make(30).map((h) => [h.id, 9])));
    const hs = Object.values(l.houses);
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const d = Math.hypot(hs[i].x - hs[j].x, hs[i].z - hs[j].z);
        expect(d).toBeGreaterThan(hs[i].footprint + hs[j].footprint);
      }
    }
  });

  it("Hausfront zeigt zur Zentrale", () => {
    const h = computeLayout(make(4), {}).houses.h0;
    // lokale +z-Achse nach Drehung um `angle`
    const dir = { x: Math.sin(h.angle), z: Math.cos(h.angle) };
    const toCenter = { x: -h.x / Math.hypot(h.x, h.z), z: -h.z / Math.hypot(h.x, h.z) };
    expect(dir.x).toBeCloseTo(toCenter.x, 2);
    expect(dir.z).toBeCloseTo(toCenter.z, 2);
  });

  it("Hausgrösse folgt der Anzahl Objekte", () => {
    const l = computeLayout(make(3), { h0: 0, h1: 4, h2: 9 });
    expect(l.houses.h0.tier).toBe(1);
    expect(l.houses.h1.tier).toBe(2);
    expect(l.houses.h2.tier).toBe(3);
    expect(l.houses.h2.footprint).toBeGreaterThan(l.houses.h0.footprint);
  });

  it("leeres Dorf: nur Zentrale", () => {
    const l = computeLayout(make(0), {});
    expect(Object.keys(l.houses)).toEqual(["z"]);
    expect(l.paths).toEqual([]);
  });
});

describe("artifactSlots", () => {
  it("liefert genau so viele Plätze wie Objekte, ohne Doppelungen", () => {
    for (const n of [0, 1, 5, 6, 20, 60]) {
      const s = artifactSlots(n, 1.5);
      expect(s).toHaveLength(n);
      expect(new Set(s.map((p) => `${p.x},${p.y},${p.z}`)).size).toBe(n);
    }
  });
  it("Plätze liegen vor dem Haus (z > 0)", () => {
    artifactSlots(10, 1.5).forEach((p) => expect(p.z).toBeGreaterThan(0));
  });
});

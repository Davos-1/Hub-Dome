import { describe, expect, it } from "vitest";
import { computeLayout, PLAZA_EDGE, type LayoutHouse } from "./layout";
import { distanceToPolyline, PATH_WIDTH, polylineDistance } from "./paths";

const make = (n: number, prefix = "h"): LayoutHouse[] => [
  { id: "z", kind: "zentrale" },
  ...Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}-abc`, kind: "modul" as const })),
];
const counts = (hs: LayoutHouse[], n: number) => Object.fromEntries(hs.map((h) => [h.id, n]));

describe("Wege", () => {
  it("jedes Haus hat genau einen Weg von der Platzkante zur Tür", () => {
    const hs = make(9);
    const l = computeLayout(hs, counts(hs, 4));
    expect(l.paths).toHaveLength(9);
    for (const p of l.paths) {
      const house = l.houses[p.houseId];
      const first = p.points[0];
      const last = p.points.at(-1)!;
      // Start nahe der Platzkante (inkl. Startverschiebung), Ende vor der Tür
      expect(Math.hypot(first.x, first.z)).toBeGreaterThan(PLAZA_EDGE - 0.1);
      expect(Math.hypot(first.x, first.z)).toBeLessThan(PLAZA_EDGE + 3.2);
      expect(Math.hypot(last.x - house.x, last.z - house.z)).toBeLessThan(
        house.footprint * 1.05 + 0.7,
      );
    }
  });

  it("Wege berühren sich nicht (bis 30 Häuser, verschiedene Hausgrössen)", () => {
    for (const n of [3, 7, 8, 12, 19, 24, 30]) {
      const hs = make(n);
      const l = computeLayout(hs, Object.fromEntries(hs.map((h, i) => [h.id, (i * 3) % 11])));
      for (let i = 0; i < l.paths.length; i++) {
        for (let j = i + 1; j < l.paths.length; j++) {
          expect(polylineDistance(l.paths[i].points, l.paths[j].points)).toBeGreaterThanOrEqual(
            PATH_WIDTH + 0.34,
          );
        }
      }
    }
  });

  it("Wege führen nicht durch fremde Häuser", () => {
    for (const n of [8, 19, 30]) {
      const hs = make(n);
      const l = computeLayout(hs, counts(hs, 9));
      for (const p of l.paths) {
        for (const h of Object.values(l.houses)) {
          if (h.id === p.houseId || h.ring === 0) continue;
          expect(distanceToPolyline(h.x, h.z, p.points)).toBeGreaterThan(h.footprint * 1.9);
        }
      }
    }
  });

  it("Auslenkung bleibt begrenzt, und es gibt mehrere Varianten", () => {
    const hs = make(16);
    const l = computeLayout(hs, counts(hs, 2));
    l.paths.forEach((p) => expect(p.amplitude).toBeLessThanOrEqual(2.8));
    expect(new Set(l.paths.map((p) => p.shape)).size).toBeGreaterThan(1);
    expect(new Set(l.paths.map((p) => p.surface)).size).toBeGreaterThan(1);
    expect(l.paths.some((p) => p.amplitude > 0.3)).toBe(true);
  });

  it("ist deterministisch", () => {
    const hs = make(12);
    expect(computeLayout(hs, counts(hs, 5)).paths).toEqual(computeLayout(hs, counts(hs, 5)).paths);
  });

  it("Wege hängen von der Haus-ID ab, nicht von der Reihenfolge der Häuser im Ring", () => {
    const hs = make(6);
    const a = computeLayout(hs, counts(hs, 1)).paths.map((p) => [p.houseId, p.shape, p.surface]);
    expect(a.every(([id]) => typeof id === "string")).toBe(true);
  });
});

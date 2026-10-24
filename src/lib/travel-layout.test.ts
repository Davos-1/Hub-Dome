import { describe, expect, it } from "vitest";
import { HOUSE_COLORS } from "@/lib/house-colors";
import { activityOf, islandColor, layoutIslands, type Activity } from "@/lib/travel-layout";

const DAY = 864e5;
const NOW = Date.parse("2026-10-24T12:00:00Z");

describe("activityOf", () => {
  it("staffelt nach Tagen seit der letzten Änderung", () => {
    const ago = (d: number) => new Date(NOW - d * DAY).toISOString();
    expect(activityOf(null, NOW)).toBe(0);
    expect(activityOf("kein Datum", NOW)).toBe(0);
    expect(activityOf(ago(1), NOW)).toBe(3);
    expect(activityOf(ago(10), NOW)).toBe(2);
    expect(activityOf(ago(30), NOW)).toBe(1);
    expect(activityOf(ago(90), NOW)).toBe(0);
  });
});

describe("islandColor", () => {
  it("ist stabil und immer eine der Hausfarben", () => {
    for (const id of ["a", "dorf-1", "c0ffee", "e4b1f1a2-0000-4000-8000-000000000000"]) {
      expect(islandColor(id)).toBe(islandColor(id));
      expect(HOUSE_COLORS).toContain(islandColor(id));
    }
  });
});

describe("layoutIslands", () => {
  const sizes = [
    { width: 924, height: 540 },
    { width: 1440, height: 900 },
  ];
  for (const size of sizes) {
    for (let n = 1; n <= 6; n++) {
      it(`${n} Freunde bei ${size.width}×${size.height}: im Fenster, keine Insel auf einer anderen`, () => {
        const friends = Array.from({ length: n }, (_, i) => ({
          id: `f${i}`,
          houses: (i * 5) % 15,
          act: (i % 4) as Activity,
        }));
        const { own, islands } = layoutIslands(friends, size);
        const all = [own, ...islands];
        for (const p of islands) {
          expect(p.x).toBeGreaterThanOrEqual(60);
          expect(p.x).toBeLessThanOrEqual(size.width - 60);
          expect(p.y).toBeGreaterThanOrEqual(80);
        }
        // Inseln sind Ellipsen (Breite w, Höhe ≈ 0.72·w): Mittelpunkte weit genug auseinander
        for (let i = 0; i < all.length; i++)
          for (let j = i + 1; j < all.length; j++) {
            const a = all[i];
            const b = all[j];
            const apart =
              Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.w + b.w) * 0.36;
            expect(apart, `${a.id} und ${b.id}`).toBe(true);
          }
      });
    }
  }
});

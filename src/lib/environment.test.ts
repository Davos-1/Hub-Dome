import { describe, expect, it } from "vitest";
import { computeEnvironment, isReserved, RIVER_WIDTH } from "./environment";
import { FACH_ORDER } from "./fachbereiche";
import { computeLayout, type LayoutHouse } from "./layout";

const make = (n: number): LayoutHouse[] => [
  { id: "z", kind: "zentrale", fach: "weitere", items: [] },
  ...Array.from({ length: n }, (_, i) => ({
    id: `h${i}-abc`,
    kind: "modul" as const,
    fach: FACH_ORDER[i % 5],
    items: Array.from({ length: 9 }, (_, j) => ({ id: `a${i}-${j}`, kind: "quiz" as const })),
  })),
];

describe("Umgebung", () => {
  it("ist deterministisch", () => {
    expect(computeEnvironment(30, "dorf-1")).toEqual(computeEnvironment(30, "dorf-1"));
    expect(computeEnvironment(30, "dorf-1").river).not.toEqual(
      computeEnvironment(30, "dorf-2").river,
    );
  });

  it.each([0, 3, 7, 8, 12, 19, 30])(
    "Fluss, Teich, Weide und Windmühle liegen ausserhalb der Häuser (%i Häuser)",
    (n) => {
      const hs = make(n);
      const layout = computeLayout(hs);
      const env = computeEnvironment(layout.extent, "seed");
      for (const h of Object.values(layout.houses)) {
        // Haus samt Objektbogen (fp + ca. 4.5 m) darf keinen reservierten Bereich berühren
        const reach = h.footprint + 4.6;
        for (const c of env.reserved) {
          expect(Math.hypot(c.x - h.x, c.z - h.z)).toBeGreaterThan(c.r + reach - 1.2);
        }
      }
    },
  );

  it("Teich, Weide und Windmühle berühren sich nicht und nicht den Fluss", () => {
    for (const extent of [20, 33, 45, 66]) {
      const env = computeEnvironment(extent, "seed");
      const items = [
        { ...env.pond, r: env.pond.r },
        { x: env.pasture.x, z: env.pasture.z, r: 6 },
        { x: env.windmill.x, z: env.windmill.z, r: 3 },
      ];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          expect(Math.hypot(items[i].x - items[j].x, items[i].z - items[j].z)).toBeGreaterThan(
            items[i].r + items[j].r + 1,
          );
        }
        for (const p of env.river.points) {
          expect(Math.hypot(items[i].x - p.x, items[i].z - p.z)).toBeGreaterThan(
            items[i].r + RIVER_WIDTH / 2 + 0.5,
          );
        }
      }
    }
  });

  it("isReserved erkennt Fluss und Teich", () => {
    const env = computeEnvironment(30, "x");
    expect(isReserved(env, env.pond.x, env.pond.z)).toBe(true);
    expect(isReserved(env, 0, 0)).toBe(false);
  });
});

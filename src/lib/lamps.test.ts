import { describe, expect, it } from "vitest";
import { computeLamps } from "./lamps";
import { computeLayout, isInPlot, type LayoutHouse } from "./layout";
import { distanceToPolyline } from "./paths";
import { FACH_ORDER } from "./fachbereiche";

const make = (n: number, spread: number): LayoutHouse[] => [
  { id: "z", kind: "zentrale", fach: "weitere", items: [] },
  ...Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    kind: "modul" as const,
    fach: FACH_ORDER[i % spread],
    items: [{ id: `a${i}`, kind: "quiz" as const }],
  })),
];

describe("computeLamps", () => {
  it("ist deterministisch und liefert Laternen", () => {
    const l = computeLayout(make(14, 4));
    const a = computeLamps(l);
    expect(a.length).toBeGreaterThan(10);
    expect(computeLamps(l)).toEqual(a);
  });

  it("keine Laterne steht in einem Garten oder mitten auf einem Weg", () => {
    const l = computeLayout(make(20, 5));
    for (const lamp of computeLamps(l)) {
      expect(isInPlot(l, lamp.x, lamp.z, 0)).toBe(false);
      for (const p of l.paths) {
        expect(distanceToPolyline(lamp.x, lamp.z, p.points)).toBeGreaterThan(0.2);
      }
    }
  });
});

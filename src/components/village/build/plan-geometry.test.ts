import { describe, expect, it } from "vitest";
import { circlePts, dashedRibbon, ribbon } from "./plan-geometry";

describe("Planformen", () => {
  it("Band: zwei Punkte je Stützpunkt, Dreiecke dazwischen", () => {
    const g = ribbon(
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 3 },
      ],
      1,
    );
    expect(g.getAttribute("position").count).toBe(6);
    expect(g.getIndex()!.count).toBe(12);
  });

  it("gestrichelt: endet immer, auch bei ungünstigen Längen (Kreise mit vielen Punkten)", () => {
    for (const r of [3.7, 18.5, 26.1, 40.03]) {
      const g = dashedRibbon(circlePts(5, -2, r, 96), 0.3, 1.4, 1.0);
      const pos = g.getAttribute("position");
      expect(pos.count).toBeGreaterThan(0);
      // Etwa so viele Striche wie Umfang / Periode
      const dashes = (2 * Math.PI * r) / 2.4;
      expect(pos.count / 4).toBeGreaterThanOrEqual(Math.floor(dashes) - 1);
    }
  });
});

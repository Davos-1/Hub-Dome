import { describe, expect, it } from "vitest";
import { poseFor, navUp, overviewPose } from "./camera-poses";
import { FACH_ORDER } from "./fachbereiche";
import { computeLayout } from "./layout";

const layout = computeLayout([
  { id: "z", kind: "zentrale", fach: "weitere", items: [] },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `h${i}`,
    kind: "modul" as const,
    fach: FACH_ORDER[i % 3],
    items: [{ id: `a${i}`, kind: "quiz" as const }],
  })),
]);

describe("camera poses", () => {
  it("Dorf: Übersicht über der Dorfmitte", () => {
    const p = poseFor(layout, { level: "dorf" }, "3d");
    expect(p).toEqual(overviewPose(layout.extent));
  });

  it("Karte schaut senkrecht von oben", () => {
    const p = poseFor(layout, { level: "dorf" }, "karte");
    expect(p.position[1]).toBeGreaterThan(layout.extent);
    expect(Math.abs(p.position[0] - p.target[0])).toBeLessThan(0.1);
  });

  it("Haus: Kamera steht vor dem Gartentor, ausserhalb des Hauses", () => {
    const h = layout.houses.h0;
    const p = poseFor(layout, { level: "haus", q: h.quarterId, h: "h0" }, "3d");
    const dist = Math.hypot(p.position[0] - h.x, p.position[2] - h.z);
    expect(dist).toBeGreaterThan(h.plot!.front + 6);
    expect(p.target[1]).toBeCloseTo(1.1);
  });

  it("Quartier: Kamera steht auf der Seite der Zentrale", () => {
    const q = layout.quarters[0];
    const p = poseFor(layout, { level: "quartier", q: q.id }, "3d");
    expect(Math.hypot(p.position[0], p.position[2])).toBeLessThan(
      Math.hypot(p.target[0], p.target[2]),
    );
  });

  it("navUp: Haus → Quartier → Dorf", () => {
    const up1 = navUp({ level: "haus", q: "tragwerk", h: "x" });
    expect(up1).toEqual({ level: "quartier", q: "tragwerk" });
    expect(navUp(up1)).toEqual({ level: "dorf" });
    expect(navUp({ level: "haus", q: null, h: "z" })).toEqual({ level: "dorf" });
  });
});

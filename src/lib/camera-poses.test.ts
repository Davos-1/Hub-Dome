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

  it("Haus: Kamera steht vor dem Gartentor, ausserhalb des Hauses, aus der Vogelperspektive", () => {
    const h = layout.houses.h0;
    const p = poseFor(layout, { level: "haus", q: h.quarterId, h: "h0" }, "3d");
    const dist = Math.hypot(p.position[0] - h.x, p.position[2] - h.z);
    expect(dist).toBeGreaterThan(h.plot!.front + 6);
    expect(p.target[1]).toBeCloseTo(1.1);
    expect(p.position[1]).toBeGreaterThan(6);
  });

  it("Haus: die Blickachse führt für jedes Haus mit Abstand über jede Quartiertafel", () => {
    for (const id of Object.keys(layout.houses).filter((x) => layout.houses[x].plot)) {
      const p = poseFor(layout, { level: "haus", q: layout.houses[id].quarterId, h: id }, "3d");
      for (const q of layout.quarters) {
        const ux = Math.cos(q.theta);
        const uz = Math.sin(q.theta);
        const cx = q.x + ux * 0.4;
        const cz = q.z + uz * 0.4;
        for (let i = 0; i <= 200; i++) {
          const t = i / 200;
          const x = p.position[0] + (p.target[0] - p.position[0]) * t;
          const z = p.position[2] + (p.target[2] - p.position[2]) * t;
          const y = p.position[1] + (p.target[1] - p.position[1]) * t;
          const along = (x - cx) * ux + (z - cz) * uz;
          const side = -(x - cx) * uz + (z - cz) * ux;
          if (Math.abs(side) < 2.6 && Math.abs(along) < 0.4) expect(y).toBeGreaterThan(4.2 + 0.5);
        }
      }
    }
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

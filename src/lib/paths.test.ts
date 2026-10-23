import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "./fachbereiche";
import { computeLayout, type LayoutHouse } from "./layout";
import { distanceToPolyline, hermite, pathLength, pointAlong, polylineDistance } from "./paths";

function make(n: number, spread: number): LayoutHouse[] {
  return [
    { id: "z", kind: "zentrale", fach: "weitere", items: [] },
    ...Array.from({ length: n }, (_, i) => ({
      id: `h${i}`,
      kind: "modul" as const,
      fach: FACH_ORDER[i % spread],
      items: [{ id: `a${i}`, kind: "quiz" as const }],
    })),
  ];
}

describe("Wege", () => {
  it("ein Zuweg pro Quartier mit Quartierplatz, Gassen nur mit Häusern daran", () => {
    for (const [n, spread] of [
      [1, 1],
      [5, 2],
      [12, 4],
      [30, 9],
    ]) {
      const l = computeLayout(make(n, spread));
      expect(l.paths.filter((p) => p.kind === "haupt")).toHaveLength(l.quarters.length);
      for (const p of l.paths) expect(p.points.length).toBeGreaterThan(1);
    }
  });

  it("Wege verschiedener Quartiere berühren sich nicht (ausser am Dorfplatz)", () => {
    const l = computeLayout(make(30, 9));
    const away = (pts: { x: number; z: number }[]) =>
      pts.filter((p) => Math.hypot(p.x, p.z) > l.plazaRadius + 1.5);
    for (let i = 0; i < l.paths.length; i++) {
      for (let j = i + 1; j < l.paths.length; j++) {
        const a = l.paths[i];
        const b = l.paths[j];
        if (a.ownerId === b.ownerId) continue;
        const pa = away(a.points);
        const pb = away(b.points);
        if (pa.length < 2 || pb.length < 2) continue;
        expect(polylineDistance(pa, pb), `${a.id}/${b.id}`).toBeGreaterThan(
          (a.width + b.width) / 2,
        );
      }
    }
  });
});

describe("Linienzüge", () => {
  const line = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
  ];
  it("distanceToPolyline und polylineDistance", () => {
    expect(distanceToPolyline(5, 3, line)).toBeCloseTo(3);
    expect(
      polylineDistance(line, [
        { x: 0, z: 2 },
        { x: 10, z: 2 },
      ]),
    ).toBeCloseTo(2);
  });
  it("pathLength und pointAlong", () => {
    expect(pathLength(line)).toBeCloseTo(10);
    expect(pointAlong(line, 4)).toMatchObject({ x: 4, z: 0 });
  });
  it("hermite beginnt und endet an den Punkten", () => {
    const pts = hermite({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 10, z: 5 }, { x: 0, z: 1 }, 0, 1);
    expect(pts[0]).toEqual({ x: 0, z: 0 });
    expect(pts.at(-1)!.x).toBeCloseTo(10);
    expect(pts.at(-1)!.z).toBeCloseTo(5);
  });
});

import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "./fachbereiche";
import { computeLayout, type LayoutHouse } from "./layout";
import { distanceToPolyline, pointAlong, polylineDistance } from "./paths";

function make(n: number, spread: number): LayoutHouse[] {
  return [
    { id: "z", kind: "zentrale", fach: "weitere", items: [] },
    ...Array.from({ length: n }, (_, i) => ({
      id: `h${i}`,
      kind: "modul" as const,
      fach: FACH_ORDER[i % spread],
      items: Array.from({ length: i % 4 === 0 ? 5 : 1 }, (_, j) => ({
        id: `a${i}-${j}`,
        kind: "quiz" as const,
      })),
    })),
  ];
}

describe("computePaths", () => {
  const cases: [number, number][] = [
    [1, 1],
    [5, 2],
    [12, 4],
    [20, 7],
    [30, 9],
    [45, 9],
  ];

  it("ein Hauptweg pro Quartier und ein Hausweg pro Haus", () => {
    for (const [n, spread] of cases) {
      const l = computeLayout(make(n, spread));
      expect(l.paths.filter((p) => p.kind === "haupt")).toHaveLength(l.quarters.length);
      expect(l.paths.filter((p) => p.kind === "haus")).toHaveLength(n);
    }
  });

  it("jeder Weg beginnt an einer eigenen Vieleckseite", () => {
    for (const [n, spread] of cases) {
      const l = computeLayout(make(n, spread));
      for (const poly of l.polys) {
        const sides = poly.used.map((a) => Math.round(((a - poly.rot) / (2 * Math.PI)) * poly.n));
        const mod = sides.map((s) => ((s % poly.n) + poly.n) % poly.n);
        expect(new Set(mod).size).toBe(mod.length);
      }
    }
  });

  it("Hauswege kommen senkrecht am Gartentor an", () => {
    const l = computeLayout(make(12, 4));
    for (const p of l.paths.filter((x) => x.kind === "haus")) {
      const h = l.houses[p.ownerId];
      const a = p.points[p.points.length - 2];
      const b = p.points[p.points.length - 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
      // Richtung am Ende = zum Haus (-Front reversed): zeigt entgegen der Frontrichtung
      expect(dir.x * -Math.sin(h.angle) + dir.z * -Math.cos(h.angle)).toBeGreaterThan(0.95);
    }
  });

  it("Hauswege verschiedener Häuser berühren sich nicht", () => {
    for (const [n, spread] of cases) {
      const l = computeLayout(make(n, spread));
      const ps = l.paths.filter((p) => p.kind === "haus");
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const d = polylineDistance(ps[i].points, ps[j].points);
          expect(d, `n=${n} ${ps[i].id} ${ps[j].id}`).toBeGreaterThan(
            (ps[i].width + ps[j].width) / 2,
          );
        }
      }
    }
  });

  it("Hauptwege führen nicht durch fremde Grundstücke", () => {
    for (const [n, spread] of cases) {
      const l = computeLayout(make(n, spread));
      for (const p of l.paths.filter((x) => x.kind === "haupt")) {
        for (const h of Object.values(l.houses)) {
          if (!h.plot) continue;
          expect(distanceToPolyline(h.x, h.z, p.points), `n=${n} ${p.id} ${h.id}`).toBeGreaterThan(
            h.footprint,
          );
        }
      }
    }
  });
});

describe("pointAlong", () => {
  it("liegt bei Bogenlänge s auf dem Linienzug", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 0, z: 4 },
      { x: 3, z: 4 },
    ];
    expect(pointAlong(pts, 2)).toEqual({ x: 0, z: 2, angle: 0 });
    expect(pointAlong(pts, 5)).toMatchObject({ x: 1, z: 4 });
    expect(pointAlong(pts, 99)).toMatchObject({ x: 3, z: 4 });
  });

  it("liefert bei einem Teilstück der Länge 0 keine NaN-Werte", () => {
    const pts = [
      { x: 1, z: 1 },
      { x: 1, z: 1 },
      { x: 1, z: 3 },
    ];
    const p = pointAlong(pts, 0);
    expect(p).toEqual({ x: 1, z: 1, angle: 0 });
  });
});

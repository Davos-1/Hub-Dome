import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { generateWorld } from "./generate";
import { distPointPolyline, pointShapeDist, type Shape } from "./geom";
import { waterEdgeDist } from "./map";
import { halfWidth, pathDress, smoothLine, surfaceOf } from "./path-dress";
import { dekoShape } from "./rules";
import { makeSeed } from "./seed";
import { seedObjektShape } from "./seed-objects";
import { NODE_RP, plotShape } from "./settlement";
import { DISTS, village } from "./test-world";

/**
 * P7 Darstellung: Randschmuck, Randsteine und Trittplatten liegen nie auf einem anderen Weg, in einem Garten,
 * im Wasser, auf einem Platz oder in Deko und Seed-Objekten. Wegbreite konstant, Mittellinie glatt.
 */
const SEEDS = Array.from({ length: 30 }, (_, i) => makeSeed(seededRandom(`weg-${i}`)));

describe("Wegausstattung", () => {
  it("Belag je Wegtyp, konstante Breite, Einmündungen aufgeweitet", () => {
    expect(surfaceOf({ kind: "haupt", quarterIndex: 2 })).toBe("pflaster");
    expect(surfaceOf({ kind: "pfad", quarterIndex: null })).toBe("erde");
    expect(surfaceOf({ kind: "stich", quarterIndex: 1 })).toBe("kies");
    expect(new Set([0, 1, 2].map((q) => surfaceOf({ kind: "gasse", quarterIndex: q }))).size).toBe(
      3,
    );
    const p = { kind: "gasse" as const, width: 1.7 };
    for (let s = 2; s < 18; s += 0.37) expect(halfWidth(p, s, 20)).toBeCloseTo(0.85, 9);
    expect(halfWidth(p, 0, 20)).toBeGreaterThan(1.3);
    const st = { kind: "stich" as const, width: 1.1 };
    expect(halfWidth(st, 0, 3)).toBeCloseTo(0.55, 9);
    expect(halfWidth(st, 3, 3)).toBeGreaterThan(0.9);
  });

  it("glatte Mittellinie: Endpunkte bleiben, feine Abtastung, nah am Original", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const w = generateWorld({ version: 2, seed, houses: village(14, DISTS.gemischt, seed) });
      for (const p of w.layout.paths) {
        const line = smoothLine(p.points);
        expect(line[0]).toEqual(p.points[0]);
        expect(line[line.length - 1]).toEqual(p.points[p.points.length - 1]);
        for (let k = 1; k < line.length; k++)
          expect(Math.hypot(line[k].x - line[k - 1].x, line[k].z - line[k - 1].z)).toBeLessThan(
            0.27,
          );
        for (const q of line) expect(distPointPolyline(q.x, q.z, p.points)).toBeLessThan(0.2);
      }
    }
  });

  it("nichts Komisches: Randschmuck, Randsteine und Trittplatten frei von Wegen, Gärten, Wasser und Plätzen", () => {
    const problems: string[] = [];
    let tufts = 0;
    let curbs = 0;
    let steps = 0;
    SEEDS.forEach((seed, i) => {
      const version = i % 3 === 0 ? 1 : 2;
      const n = [3, 10, 20, 30][i % 4];
      const w = generateWorld({ version, seed, houses: village(n, DISTS.gemischt, seed) });
      const t0 = performance.now();
      const d = pathDress(w, i % 5 === 0 ? 0.4 : 1);
      const ms = performance.now() - t0;
      if (ms > 400) problems.push(`${seed}: ${ms.toFixed(0)} ms`);
      const lines = w.layout.paths.map((p) => ({ p, pts: smoothLine(p.points) }));
      const plots = Object.values(w.settlement.houses).map((h) => plotShape(h.x, h.z, h.angle));
      const solid: Shape[] = [
        ...plots,
        ...w.deko.map(dekoShape),
        ...(w.map.objects ?? []).map(seedObjektShape),
        ...w.settlement.nodes.map(
          (nd) =>
            ({ kind: "circle", x: nd.x, z: nd.z, r: NODE_RP / Math.cos(Math.PI / 8) }) as Shape,
        ),
        { kind: "circle", x: 0, z: 0, r: w.map.plaza.a },
      ];
      // Abstand zur Wegfläche über die halbe Breite an der nächsten Stelle (mit Einmündungen)
      const measured = lines.map(({ p, pts }) => {
        const acc = [0];
        for (let k = 1; k < pts.length; k++)
          acc.push(acc[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
        return { p, pts, acc, total: acc[acc.length - 1] };
      });
      const onPath = (x: number, z: number, r: number, own?: string) =>
        measured.some(({ p, pts, acc, total }) => {
          if (p.id === own) return false;
          let best = { d: Infinity, s: 0 };
          pts.forEach((q, k) => {
            const d = Math.hypot(q.x - x, q.z - z);
            if (d < best.d) best = { d, s: acc[k] };
          });
          return best.d < halfWidth(p, best.s, total) + r - 0.05;
        });
      for (const t of [...d.tufts, ...d.pebbles]) {
        tufts++;
        if (onPath(t.x, t.z, t.s)) problems.push(`${seed}: Randgras auf Weg`);
        if (solid.some((s) => pointShapeDist(t.x, t.z, s) < t.s))
          problems.push(`${seed}: Randgras in Garten/Platz/Deko`);
        if (waterEdgeDist(w.map, t.x, t.z) < t.s) problems.push(`${seed}: Randgras im Wasser`);
      }
      for (const c of d.curbs) {
        for (const q of c.pts) {
          curbs++;
          if (onPath(q.x, q.z, 0.05, c.pathId)) problems.push(`${seed}: Randstein auf anderem Weg`);
          if (waterEdgeDist(w.map, q.x, q.z) < 0.2) problems.push(`${seed}: Randstein im Wasser`);
          if (Math.hypot(q.x, q.z) < w.map.plaza.a)
            problems.push(`${seed}: Randstein auf dem Dorfplatz`);
        }
      }
      const spurs = w.layout.paths.filter((p) => p.kind === "stich");
      for (const s of d.steps) {
        steps++;
        if (!spurs.some((p) => distPointPolyline(s.x, s.z, p.points) < 0.15))
          problems.push(`${seed}: Trittplatte neben dem Stichweg`);
        if (plots.some((pl) => pointShapeDist(s.x, s.z, pl) < 0.05))
          problems.push(`${seed}: Trittplatte im Garten`);
      }
      if (version === 2 && n >= 10) expect(spurs.length, seed).toBeGreaterThan(0);
    });
    expect(problems.slice(0, 12)).toEqual([]);
    expect(tufts).toBeGreaterThan(2000);
    expect(curbs).toBeGreaterThan(2000);
    expect(steps).toBeGreaterThan(100);
  }, 120_000);
});

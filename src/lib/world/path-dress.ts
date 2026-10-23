/**
 * Wegausstattung (P7, reine Darstellung für alle Generator-Versionen): Belag je Wegtyp und Quartier, glatte
 * Mittellinien, Randsteine an gepflasterten Wegen, Trittplatten auf Stichwegen, Randgras und Steinchen.
 * Alles deterministisch aus der Welt; nichts davon liegt auf einem anderen Weg, in einem Garten, im Wasser,
 * auf einem Platz oder in Deko und Seed-Objekten (Property-Tests in `path-dress.test.ts`).
 */

import type { VillagePath } from "../paths";
import { seededRandom } from "../random";
import type { World } from "./generate";
import { pointShapeDist, type Pt, type Shape } from "./geom";
import { waterEdgeDist } from "./map";
import { dekoShape } from "./rules";
import { seedObjektShape } from "./seed-objects";
import { NODE_RP, plotShape } from "./settlement";

export type Surface = "kies" | "pflaster" | "platten" | "erde";

/** Belag der Gassen je Quartier (Reihenfolge der Quartiere). */
const LANE_SURFACES: Surface[] = ["kies", "pflaster", "platten"];

/**
 * Belag eines Wegs: Zuwege Kopfsteinpflaster, Gassen je Quartier Kies, Pflaster oder Platten, Stichwege ein
 * Kiesbett (darauf Trittplatten), Fusspfade Erde.
 */
export function surfaceOf(p: Pick<VillagePath, "kind" | "quarterIndex">): Surface {
  if (p.kind === "haupt") return "pflaster";
  if (p.kind === "pfad") return "erde";
  if (p.kind === "stich") return "kies";
  return LANE_SURFACES[(p.quarterIndex ?? 0) % LANE_SURFACES.length];
}

/** Gepflasterte Beläge bekommen Randsteine; Kies und Erde laufen weich ins Gras aus. */
export const hasCurb = (s: Surface) => s === "pflaster" || s === "platten";

/** Randstein: Breite und Höhe über dem Belag. */
export const CURB = { w: 0.14, h: 0.05 } as const;

/**
 * Glatte Mittellinie: zweimal Ecken abschneiden (Endpunkte bleiben), dann alle `step` Meter abtasten (Desktop
 * 0.2 m, Mobile 0.4 m).
 * Keine sichtbaren Facetten in der Nahaufnahme.
 */
export function smoothLine(pts: Pt[], step = 0.2): Pt[] {
  let line = pts;
  for (let k = 0; k < 2 && line.length > 2; k++) {
    const out: Pt[] = [line[0]];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (i > 0) out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
      if (i < line.length - 2) out.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    out.push(line[line.length - 1]);
    line = out;
  }
  // Gleichmässig abtasten (Bogenlänge)
  const res: Pt[] = [line[0]];
  let acc = 0;
  let next = step;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    while (acc + l >= next && l > 0) {
      const t = (next - acc) / l;
      res.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      next += step;
    }
    acc += l;
  }
  const last = line[line.length - 1];
  const prev = res[res.length - 1];
  if (Math.hypot(last.x - prev.x, last.z - prev.z) > step * 0.3) res.push(last);
  else res[res.length - 1] = last;
  return res;
}

/** Einmündung: An welchem Ende weitet sich der Weg trichterförmig auf (zum Platz bzw. zum Rückgrat)? */
export function flareEnds(kind: VillagePath["kind"]): { start: boolean; end: boolean } {
  if (kind === "haupt") return { start: true, end: true };
  if (kind === "stich") return { start: false, end: true };
  return { start: true, end: false };
}

/** Halbe Breite bei Bogenlänge `s` (Länge `total`): konstant, an Einmündungen sanft aufgeweitet. */
export function halfWidth(
  p: Pick<VillagePath, "kind" | "width">,
  s: number,
  total: number,
): number {
  const f = flareEnds(p.kind);
  const L = p.kind === "stich" ? 0.9 : 1.6;
  const a = f.start ? Math.max(0, 1 - s / L) ** 2 : 0;
  const b = f.end ? Math.max(0, 1 - (total - s) / L) ** 2 : 0;
  const k = p.kind === "stich" ? 0.9 : 0.7;
  return (p.width / 2) * (1 + k * Math.max(a, b));
}

export type Stone = { x: number; z: number; angle: number; w: number; d: number };
export type Tuft = { x: number; z: number; s: number; rot: number; tone: number };
export type CurbRun = { pathId: string; side: 1 | -1; pts: Pt[] };

export type PathDress = {
  /** Geglättete Mittellinien je Weg (gleiche Reihenfolge wie `layout.paths`). */
  lines: Pt[][];
  curbs: CurbRun[];
  steps: Stone[];
  tufts: Tuft[];
  pebbles: Tuft[];
};

/** Hindernisse für Randschmuck: Gärten, Plätze, Deko, Seed-Objekte, Laternen. */
function blockers(world: World): { shape: Shape; m: number }[] {
  const out: { shape: Shape; m: number }[] = [];
  for (const h of Object.values(world.settlement.houses))
    out.push({ shape: plotShape(h.x, h.z, h.angle), m: 0.1 });
  for (const n of world.settlement.nodes)
    out.push({
      shape: { kind: "circle", x: n.x, z: n.z, r: NODE_RP / Math.cos(Math.PI / 8) },
      m: 0.15,
    });
  out.push({
    shape: {
      kind: "circle",
      x: 0,
      z: 0,
      r: world.map.plaza.a / Math.cos(Math.PI / world.map.plaza.n),
    },
    m: 0.4,
  });
  for (const d of world.deko) out.push({ shape: dekoShape(d), m: 0.1 });
  for (const o of world.map.objects ?? []) out.push({ shape: seedObjektShape(o), m: 0.1 });
  for (const l of world.lamps)
    out.push({ shape: { kind: "circle", x: l.x, z: l.z, r: 0.25 }, m: 0.1 });
  for (const b of world.plazaProps.benches)
    out.push({ shape: { kind: "circle", x: b.x, z: b.z, r: 1.0 }, m: 0.1 });
  for (const b of world.settlement.bridges)
    out.push({ shape: { kind: "circle", x: b.x, z: b.z, r: b.span / 2 + 0.6 }, m: 0 });
  return out;
}

type Line = {
  path: VillagePath;
  pts: Pt[];
  acc: number[];
  total: number;
  /** Rahmen samt grösster Einmündung, für die schnelle Vorprüfung. */
  box: [number, number, number, number];
};

function lineOf(path: VillagePath, step: number): Line {
  const pts = smoothLine(path.points, step);
  const acc = [0];
  for (let k = 1; k < pts.length; k++)
    acc.push(acc[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
  const m = path.width + 0.5;
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  return {
    path,
    pts,
    acc,
    total: acc[acc.length - 1],
    box: [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m],
  };
}

/** Abstand eines Punkts zum Rand der Wegfläche (mit Einmündungen); negativ = auf dem Weg. */
function edgeDist(l: Line, x: number, z: number): number {
  let best = { d: Infinity, s: 0 };
  for (let k = 0; k < l.pts.length - 1; k++) {
    const a = l.pts[k];
    const b = l.pts[k + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1e-9;
    const f = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const d = Math.hypot(x - a.x - dx * f, z - a.z - dz * f);
    if (d < best.d) best = { d, s: l.acc[k] + f * (l.acc[k + 1] - l.acc[k]) };
  }
  return best.d - halfWidth(l.path, best.s, l.total);
}

/** Kleinster Abstand zum Rand aller Wege (ausser `skip`). */
export function clearOfPaths(lines: Line[], x: number, z: number, skip?: Line): number {
  let best = Infinity;
  for (const l of lines) {
    if (l === skip) continue;
    const [x0, z0, x1, z1] = l.box;
    if (x < x0 - 1 || x > x1 + 1 || z < z0 - 1 || z > z1 + 1) continue;
    best = Math.min(best, edgeDist(l, x, z));
  }
  return best;
}

/**
 * Ausstattung aller Wege einer Welt. `detail` < 1 dünnt Randgras und Steinchen aus (Mobile).
 */
export function pathDress(world: World, detail = 1): PathDress {
  const all = world.layout.paths.map((p) => lineOf(p, detail < 1 ? 0.4 : 0.2));
  const block = blockers(world);
  const plazaR = world.map.plaza.a / Math.cos(Math.PI / world.map.plaza.n);
  const free = (x: number, z: number, r: number) =>
    waterEdgeDist(world.map, x, z) > r + 0.3 &&
    Math.hypot(x, z) < world.map.rBuild + 6 &&
    block.every((b) => pointShapeDist(x, z, b.shape) > r + b.m) &&
    clearOfPaths(all, x, z) > r + 0.05;

  const curbs: CurbRun[] = [];
  const steps: Stone[] = [];
  const tufts: Tuft[] = [];
  const pebbles: Tuft[] = [];

  for (const l of all) {
    const p = l.path;
    const { pts: line, acc, total } = l;
    const n = line.length;
    const nrm = (k: number) => {
      const a = line[Math.max(0, k - 1)];
      const b = line[Math.min(n - 1, k + 1)];
      const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: -(b.z - a.z) / d, z: (b.x - a.x) / d };
    };
    const at = (s: number) => {
      let k = 0;
      while (k < n - 2 && acc[k + 1] < s) k++;
      const f =
        acc[k + 1] > acc[k] ? Math.max(0, Math.min(1, (s - acc[k]) / (acc[k + 1] - acc[k]))) : 0;
      const a = line[k];
      const b = line[k + 1] ?? a;
      return {
        x: a.x + (b.x - a.x) * f,
        z: a.z + (b.z - a.z) * f,
        k,
        h: Math.atan2(b.x - a.x, b.z - a.z),
      };
    };
    const surface = surfaceOf(p);
    const r = seededRandom(`weg-${p.id}`);

    // Randsteine: nur entlang der konstanten Breite, nicht an Einmündungen, Kreuzungen, Brücken und Wasser
    if (hasCurb(surface)) {
      for (const side of [1, -1] as const) {
        let run: Pt[] = [];
        const flush = () => {
          if (run.length > 3) curbs.push({ pathId: p.id, side, pts: run });
          run = [];
        };
        for (let k = 0; k < n; k++) {
          const s = acc[k];
          const w = halfWidth(p, s, total);
          const q = nrm(k);
          const o = w + CURB.w / 2;
          const x = line[k].x + q.x * o * side;
          const z = line[k].z + q.z * o * side;
          const ok =
            w <= p.width / 2 + 1e-6 &&
            s > 0.3 &&
            s < total - 0.3 &&
            waterEdgeDist(world.map, x, z) > 0.4 &&
            clearOfPaths(all, x, z, l) > CURB.w &&
            world.settlement.bridges.every(
              (b) => Math.hypot(b.x - x, b.z - z) > b.span / 2 + 0.6,
            ) &&
            world.settlement.nodes.every(
              (nd) => Math.hypot(nd.x - x, nd.z - z) > NODE_RP / Math.cos(Math.PI / 8) + 0.2,
            ) &&
            Math.hypot(x, z) > plazaR + 0.2;
          if (ok) run.push({ x, z });
          else flush();
        }
        flush();
      }
    }

    // Trittplatten auf dem Stichweg: vom Tor bis kurz vor das Rückgrat
    if (p.kind === "stich") {
      const s0 = 0.35;
      const s1 = total - 0.55;
      const len = s1 - s0;
      // Kurzer Stummel am Bauplatz: eine Platte vor dem Tor
      const stub = len < 0.3;
      const count = stub ? (total >= 0.5 ? 1 : 0) : Math.max(1, Math.round(len / 0.62) + 1);
      for (let j = 0; j < count; j++) {
        const s = stub
          ? Math.min(0.27, total / 2)
          : count === 1
            ? (s0 + s1) / 2
            : s0 + (len * j) / (count - 1);
        const c = at(s);
        const q = nrm(c.k);
        const lat = (r() - 0.5) * 0.12;
        steps.push({
          x: c.x + q.x * lat,
          z: c.z + q.z * lat,
          angle: c.h + (r() - 0.5) * 0.5,
          w: 0.44 + r() * 0.1,
          d: stub ? 0.28 : 0.32 + r() * 0.08,
        });
      }
    }

    // Randgras und Steinchen beidseits (ausserhalb von Belag und Randstein)
    const gap = 0.42 / Math.max(0.2, detail);
    for (let s = 0.4 + r() * gap; s < total - 0.2; s += gap * (0.7 + r() * 0.6)) {
      const c = at(s);
      const q = nrm(c.k);
      const side = r() < 0.5 ? 1 : -1;
      const w = halfWidth(p, s, total) + (hasCurb(surface) ? CURB.w : 0);
      const pebble = r() < (surface === "kies" || surface === "erde" ? 0.35 : 0.2);
      const size = pebble ? 0.05 + r() * 0.07 : 0.12 + r() * 0.12;
      const o = w + size + 0.05 + r() * 0.22;
      const x = c.x + q.x * o * side;
      const z = c.z + q.z * o * side;
      const rot = r() * Math.PI * 2;
      const tone = r();
      if (!free(x, z, size)) continue;
      (pebble ? pebbles : tufts).push({ x, z, s: size, rot, tone });
    }
  }

  return { lines: all.map((l) => l.pts), curbs, steps, tufts, pebbles };
}

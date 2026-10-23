/**
 * Achsen der neun Gassen (Generator v1): vom Dorfplatz nach aussen, gerade bis hinter den Quartierplatz,
 * danach sanft gebogen. Fest pro Seed und Ausgang; einem See weichen sie seitlich aus. Die Karte legt
 * Merkmale in die Lücken dazwischen, die Siedlung hält die Korridore für Häuser frei.
 */

import { polar, TAU, type Pt } from "./geom";

/** Wasserlauf für die Gassenführung (v2): Mittellinie und Breite. */
type Stream = { points: Pt[]; width: number };
import { range, rng } from "./seed";

/** Anzahl Ausgänge des Dorfplatzes (= höchstens neun Quartiere). */
export const DIRECTIONS = 9;
/** Quartierplatz (Achteck), Apothem. */
export const NODE_RP = 3.0;
export const AXIS_STEP = 0.5;

export type Axis = { axis: Pt[]; acc: number[]; nodeT: number };

/** Richtung des Ausgangs k am Dorfplatz. */
export const dirAngle = (plaza: { rot: number }, k: number) => plaza.rot + (TAU * k) / DIRECTIONS;

export function laneAxis(
  seed: string,
  plaza: { a: number; rot: number },
  k: number,
  rMax: number,
  lake?: { x: number; z: number; r: number } | null,
  /** Nur v2: Wasserläufe, die die Gasse rechtwinklig quert (kurze Brücke statt schräger Querung). */
  streams?: readonly Stream[],
): Axis {
  const r = rng(seed, `gasse-${k}`);
  const nodeT = range(r, 12, 14.5) + NODE_RP;
  const amp = range(r, 0.1, 0.24) * (r() < 0.5 ? -1 : 1);
  const lambda = range(r, 26, 40);
  const phase = range(r, 0, Math.PI);
  const base = dirAngle(plaza, k);
  const axis: Pt[] = [];
  const acc: number[] = [];
  let p = polar(base, plaza.a - 0.35);
  let t = 0;
  let dodge = 0;
  const straight = nodeT + NODE_RP + 2;
  // Rahmen der Wasserläufe (12 m Rand) für eine schnelle Vorprüfung
  const boxes = new Map<Stream, [number, number, number, number]>();
  for (const st of streams ?? []) {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const q of st.points) {
      x0 = Math.min(x0, q.x);
      z0 = Math.min(z0, q.z);
      x1 = Math.max(x1, q.x);
      z1 = Math.max(z1, q.z);
    }
    const m = st.width / 2 + 12;
    boxes.set(st, [x0 - m, z0 - m, x1 + m, z1 + m]);
  }
  while (Math.hypot(p.x, p.z) < rMax + 4 && axis.length < 2000) {
    axis.push(p);
    acc.push(t);
    const s = t - straight;
    const bend = s <= 0 ? 0 : amp * Math.sin((s / lambda) * Math.PI + phase) * Math.min(1, s / 8);
    let h = base + bend + dodge;
    // Kurz vor einem See seitlich ausweichen (die Gasse läuft dann dem Ufer entlang)
    if (lake && s > 0) {
      const dx = lake.x - p.x;
      const dz = lake.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < lake.r + 12) {
        const toLake = Math.atan2(dz, dx);
        const rel = Math.atan2(Math.sin(toLake - h), Math.cos(toLake - h));
        if (Math.abs(rel) < Math.PI / 2) {
          const push = (0.05 * (lake.r + 12 - d)) / 12;
          dodge += rel > 0 ? -push : push;
          dodge = Math.max(-0.9, Math.min(0.9, dodge));
          h = base + bend + dodge;
        }
      }
    }
    // Vor einem Wasserlauf auf eine rechtwinklige Querung einschwenken (nur v2); danach geradeaus weiter
    if (streams && s > 0) {
      for (const st of streams) {
        const bb = boxes.get(st)!;
        if (p.x < bb[0] || p.x > bb[2] || p.z < bb[1] || p.z > bb[3]) continue;
        const near = nearestOn(st.points, p);
        if (near.d - st.width / 2 > 9 || near.d < 0.01) continue;
        // Nur flache Querungen korrigieren: auf mindestens 60° zur Fliessrichtung einschwenken
        const flow = Math.atan2(near.tz, near.tx);
        const rel0 = Math.atan2(Math.sin(h - flow), Math.cos(h - flow));
        const cross = Math.abs(Math.sin(rel0));
        if (cross >= Math.sin(Math.PI / 3)) continue;
        const sign = Math.sign(rel0) || 1;
        const want =
          Math.abs(rel0) > Math.PI / 2
            ? flow + sign * ((2 * Math.PI) / 3)
            : flow + sign * (Math.PI / 3);
        const rel = Math.atan2(Math.sin(want - h), Math.cos(want - h));
        dodge += Math.max(-0.06, Math.min(0.06, rel * 0.3));
        dodge = Math.max(-0.7, Math.min(0.7, dodge));
        h = base + bend + dodge;
      }
    }
    p = { x: p.x + Math.cos(h) * AXIS_STEP, z: p.z + Math.sin(h) * AXIS_STEP };
    t += AXIS_STEP;
  }
  return { axis, acc, nodeT };
}

const AXES = new WeakMap<object, Axis[]>();

/**
 * Achsen aller neun Ausgänge einer Karte (zwischengespeichert je Karte: Karte und Siedlung brauchen dieselben).
 * v2 übergibt die Wasserläufe (rechtwinklige Querung), v1 nicht.
 */
export function laneAxesOf(
  seed: string,
  map: {
    plaza: { a: number; rot: number };
    rBuild: number;
    lake: { x: number; z: number; r: number } | null;
    version?: number;
    river: Stream | null;
    streams?: Stream[];
  },
): Axis[] {
  let axes = AXES.get(map);
  if (!axes) {
    const streams =
      map.version === 2 ? [...(map.river ? [map.river] : []), ...(map.streams ?? [])] : undefined;
    axes = Array.from({ length: DIRECTIONS }, (_, k) =>
      laneAxis(seed, map.plaza, k, map.rBuild, map.lake, streams),
    );
    AXES.set(map, axes);
  }
  return axes;
}

/** Nächster Punkt auf einem Linienzug: Abstand und Richtung des Segments (Einheitsvektor). */
function nearestOn(pts: Pt[], p: Pt) {
  // Grob über jeden vierten Punkt, dann fein um den besten Abschnitt (Linienzüge sind gleichmässig abgetastet)
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < pts.length; i += 4) {
    const d = (pts[i].x - p.x) ** 2 + (pts[i].z - p.z) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  let best = { d: Infinity, tx: 1, tz: 0 };
  for (let i = Math.max(0, bi - 6); i < Math.min(pts.length - 1, bi + 6); i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
    if (d < best.d) {
      const l = Math.sqrt(l2);
      best = { d, tx: dx / l, tz: dz / l };
    }
  }
  return best;
}

/**
 * Achsen der neun Gassen (Generator v1): vom Dorfplatz nach aussen, gerade bis hinter den Quartierplatz,
 * danach sanft gebogen. Fest pro Seed und Ausgang; einem See weichen sie seitlich aus. Die Karte legt
 * Merkmale in die Lücken dazwischen, die Siedlung hält die Korridore für Häuser frei.
 */

import { polar, TAU, type Pt } from "./geom";
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
    p = { x: p.x + Math.cos(h) * AXIS_STEP, z: p.z + Math.sin(h) * AXIS_STEP };
    t += AXIS_STEP;
  }
  return { axis, acc, nodeT };
}

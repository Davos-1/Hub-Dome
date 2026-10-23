import { distPointToSegment, fnv, type Pt } from "./geometry";
import type { VillageLayout } from "./layout";

/** Breite der Hauptwege und der Hauswege. */
const MAIN_PATH_WIDTH = 1.9;
const HOUSE_PATH_WIDTH = 1.5;

/** Ein Weg als Linienzug: Hauptweg (Hauptplatz → Nebenplatz) oder Hausweg (Nebenplatz → Gartentor). */
export type VillagePath = {
  id: string;
  kind: "haupt" | "haus";
  /** Haus (Hausweg) bzw. Quartier-Id (Hauptweg). */
  ownerId: string;
  /** Index in der Quartierfarbe, `null` für Wege ohne Quartier. */
  quarterIndex: number | null;
  points: { x: number; z: number }[];
  width: number;
  /** Phase der leichten Breitenschwankung. */
  seed: number;
};

/** Kleinster Abstand eines Punktes zu einem Linienzug. */
export function distanceToPolyline(x: number, z: number, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distPointToSegment(x, z, pts[i], pts[i + 1]));
  }
  return best;
}

/** Kleinster Abstand zwischen zwei Linienzügen (Mittellinien). */
export function polylineDistance(a: Pt[], b: Pt[]): number {
  let best = Infinity;
  for (const p of a) best = Math.min(best, distanceToPolyline(p.x, p.z, b));
  for (const p of b) best = Math.min(best, distanceToPolyline(p.x, p.z, a));
  return best;
}

/**
 * Sanfter Bogen (Hermite-Kurve) von S nach G mit Anfangsrichtung dS und Endrichtung dG.
 * `amp` biegt die Mitte seitlich aus (`sign` = Seite).
 */
function hermite(S: Pt, dS: Pt, G: Pt, dG: Pt, amp: number, sign: number): Pt[] {
  const D = Math.hypot(G.x - S.x, G.z - S.z);
  const N = Math.max(20, Math.round(D * 3));
  const kk = D * 0.5;
  // Start gleich Ziel: keine Seitenrichtung, kein NaN
  const nx = D === 0 ? 0 : -(G.z - S.z) / D;
  const nz = D === 0 ? 0 : (G.x - S.x) / D;
  const pts: Pt[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const bow = amp * sign * Math.sin(Math.PI * t) ** 2;
    pts.push({
      x: h00 * S.x + h10 * dS.x * kk + h01 * G.x + h11 * dG.x * kk + nx * bow,
      z: h00 * S.z + h10 * dS.z * kk + h01 * G.z + h11 * dG.z * kk + nz * bow,
    });
  }
  return pts;
}

const dir = (a: number): Pt => ({ x: Math.cos(a), z: Math.sin(a) });

/** Wegende am Rand eines Platzes (Mittelpunkt `c`, Apothem `apothem`) in Richtung `d`. */
function plazaEdge(c: Pt, d: Pt, apothem: number): Pt {
  return { x: c.x + d.x * (apothem - 0.35), z: c.z + d.z * (apothem - 0.35) };
}

/** Wege des Dorfs: ein Hauptweg pro Quartier, ein Hausweg pro Haus. */
export function computePaths(layout: Omit<VillageLayout, "paths">): VillagePath[] {
  const out: VillagePath[] = [];
  const plaza = layout.plazaRadius;
  for (const q of layout.quarters) {
    const s0 = dir(q.mainSide);
    const e0 = dir(q.entrySide);
    const quarterCenter: Pt = { x: q.x, z: q.z };
    out.push({
      id: `haupt-${q.id}`,
      kind: "haupt",
      ownerId: q.id,
      quarterIndex: q.index,
      width: MAIN_PATH_WIDTH,
      seed: 1,
      points: hermite(
        plazaEdge({ x: 0, z: 0 }, s0, plaza),
        s0,
        plazaEdge(quarterCenter, e0, q.rp),
        { x: -e0.x, z: -e0.z },
        0,
        1,
      ),
    });
    for (const id of q.houseIds) {
      const h = layout.houses[id];
      if (!h.plot) continue;
      const sd = dir(h.side);
      const f = { x: Math.sin(h.angle), z: Math.cos(h.angle) };
      const hash = fnv(h.id);
      const sign = (hash >>> 6) % 2 ? 1 : -1;
      out.push({
        id: `haus-${h.id}`,
        kind: "haus",
        ownerId: h.id,
        quarterIndex: q.index,
        width: HOUSE_PATH_WIDTH,
        seed: (hash % 100) / 10,
        points: hermite(
          plazaEdge(quarterCenter, sd, q.rp),
          sd,
          { x: h.x + f.x * h.plot.front, z: h.z + f.z * h.plot.front },
          { x: -f.x, z: -f.z },
          0.3,
          sign,
        ),
      });
    }
  }
  return out;
}

/** Länge des Linienzugs in Metern. */
export function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return l;
}

/** Punkt und Richtung (Winkel `atan2(dx, dz)`) bei Bogenlänge `s`. */
export function pointAlong(pts: Pt[], s: number): { x: number; z: number; angle: number } {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dz = pts[i + 1].z - pts[i].z;
    const l = Math.hypot(dx, dz);
    if (acc + l >= s) {
      const t = l === 0 ? 0 : (s - acc) / l;
      return { x: pts[i].x + dx * t, z: pts[i].z + dz * t, angle: Math.atan2(dx, dz) };
    }
    acc += l;
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { x: b.x, z: b.z, angle: Math.atan2(b.x - a.x, b.z - a.z) };
}

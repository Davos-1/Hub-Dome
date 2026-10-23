/**
 * Geometrie für das Regelwerk der Welt: Grundflächen (Kreis oder gedrehtes Rechteck) und Abstände.
 * Koordinaten in Metern auf dem Boden (x, z). Drehung `angle` wie bei Häusern um die Y-Achse:
 * die lokale +z-Achse zeigt nach (sin a, cos a).
 */

export type Pt = { x: number; z: number };
export type Circle = { kind: "circle"; x: number; z: number; r: number };
/** Gedrehtes Rechteck: Mittelpunkt, halbe Breite (lokal x), halbe Tiefe (lokal z), Drehung. */
export type Box = { kind: "box"; x: number; z: number; hw: number; hd: number; angle: number };
export type Shape = Circle | Box;

export const TAU = Math.PI * 2;
export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const normA = (a: number) => ((a % TAU) + TAU) % TAU;
/** Kleinster Winkelabstand zweier Richtungen (0…π). */
export const angDiff = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const polar = (a: number, r: number): Pt => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });

export const circle = (x: number, z: number, r: number): Circle => ({ kind: "circle", x, z, r });

export function box(x: number, z: number, hw: number, hd: number, angle: number): Box {
  return { kind: "box", x, z, hw, hd, angle };
}

/** Lokaler Punkt (lx, lz) eines Objekts an (x, z) mit Drehung `angle` in Weltkoordinaten. */
export function toWorld(x: number, z: number, angle: number, lx: number, lz: number): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
}

/** Weltpunkt in das lokale System eines Objekts an (x, z) mit Drehung `angle`. */
export function toLocal(x: number, z: number, angle: number, px: number, pz: number): Pt {
  const dx = px - x;
  const dz = pz - z;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

export function corners(b: Box): Pt[] {
  return [
    toWorld(b.x, b.z, b.angle, -b.hw, -b.hd),
    toWorld(b.x, b.z, b.angle, b.hw, -b.hd),
    toWorld(b.x, b.z, b.angle, b.hw, b.hd),
    toWorld(b.x, b.z, b.angle, -b.hw, b.hd),
  ];
}

/** Radius des umschliessenden Kreises (für schnelle Vorprüfungen). */
export function boundR(s: Shape): number {
  return s.kind === "circle" ? s.r : Math.hypot(s.hw, s.hd);
}

/** Abstand eines Punktes zur Grundfläche (0 innerhalb). */
export function pointShapeDist(px: number, pz: number, s: Shape): number {
  if (s.kind === "circle") return Math.max(0, Math.hypot(px - s.x, pz - s.z) - s.r);
  const l = toLocal(s.x, s.z, s.angle, px, pz);
  const dx = Math.max(0, Math.abs(l.x) - s.hw);
  const dz = Math.max(0, Math.abs(l.z) - s.hd);
  return Math.hypot(dx, dz);
}

/** Separating-Axis-Test zweier Rechtecke: überlappen sie oder liegen sie näher als `m`? */
function boxBox(a: Box, b: Box, m: number): boolean {
  const A = corners(a);
  const B = corners(b);
  const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2];
  for (const ang of axes) {
    const nx = Math.cos(ang);
    const nz = -Math.sin(ang);
    let amin = Infinity;
    let amax = -Infinity;
    let bmin = Infinity;
    let bmax = -Infinity;
    for (const p of A) {
      const d = p.x * nx + p.z * nz;
      amin = Math.min(amin, d);
      amax = Math.max(amax, d);
    }
    for (const p of B) {
      const d = p.x * nx + p.z * nz;
      bmin = Math.min(bmin, d);
      bmax = Math.max(bmax, d);
    }
    if (amax + m <= bmin || bmax + m <= amin) return false;
  }
  return true;
}

/** Überlappen sich zwei Grundflächen, bzw. sind sie näher als der Mindestabstand `m`? */
export function overlaps(a: Shape, b: Shape, m = 0): boolean {
  const reach = boundR(a) + boundR(b) + m;
  if (Math.abs(a.x - b.x) > reach || Math.abs(a.z - b.z) > reach) return false;
  if (a.kind === "circle" && b.kind === "circle")
    return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + m;
  if (a.kind === "circle") return pointShapeDist(a.x, a.z, b) < a.r + m;
  if (b.kind === "circle") return pointShapeDist(b.x, b.z, a) < b.r + m;
  return boxBox(a, b, m);
}

export function distPointSeg(px: number, pz: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

export function distPointPolyline(px: number, pz: number, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++)
    best = Math.min(best, distPointSeg(px, pz, pts[i], pts[i + 1]));
  if (pts.length === 1) best = Math.hypot(px - pts[0].x, pz - pts[0].z);
  return best;
}

/** Schneidet die Strecke ab das achsparallele Rechteck [-hw,hw]×[-hd,hd]? (Liang–Barsky) */
function segHitsAabb(a: Pt, b: Pt, hw: number, hd: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, a.x + hw) &&
    clip(dx, hw - a.x) &&
    clip(-dz, a.z + hd) &&
    clip(dz, hd - a.z) &&
    t0 <= t1
  );
}

/** Exakter Abstand einer Strecke zu einer Grundfläche (0 bei Schnitt). */
export function segShapeDist(a: Pt, b: Pt, s: Shape): number {
  if (s.kind === "circle") return Math.max(0, distPointSeg(s.x, s.z, a, b) - s.r);
  const la = toLocal(s.x, s.z, s.angle, a.x, a.z);
  const lb = toLocal(s.x, s.z, s.angle, b.x, b.z);
  if (segHitsAabb(la, lb, s.hw, s.hd)) return 0;
  let best = Math.min(pointShapeDist(a.x, a.z, s), pointShapeDist(b.x, b.z, s));
  for (const c of corners(s)) best = Math.min(best, distPointSeg(c.x, c.z, a, b));
  return best;
}

/** Abstand einer Grundfläche zu einem Linienzug (Mittellinie eines Wegs, Flusses …). */
export function shapePolylineDist(s: Shape, pts: Pt[]): number {
  const R = boundR(s);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    // Vorprüfung über den umschliessenden Kreis
    if (distPointSeg(s.x, s.z, a, b) - R > best) continue;
    best = Math.min(best, segShapeDist(a, b, s));
    if (best === 0) return 0;
  }
  return best;
}

/** Kleinster Abstand zweier Linienzüge (exakt über alle Segmentpaare, mit Vorprüfung). */
export function polylineDist(a: Pt[], b: Pt[]): number {
  let best = Infinity;
  for (const p of a) best = Math.min(best, distPointPolyline(p.x, p.z, b));
  for (const p of b) best = Math.min(best, distPointPolyline(p.x, p.z, a));
  return best;
}

/** Linienzug gleichmässig neu abtasten (höchstens `step` Meter zwischen zwei Punkten). */
export function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++)
      out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
}

export function polylineLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return l;
}

/** Liegt der Punkt im Vieleck (Gerade-Ungerade-Regel)? */
export function pointInPolygon(px: number, pz: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > pz !== b.z > pz && px < ((b.x - a.x) * (pz - a.z)) / (b.z - a.z) + a.x)
      inside = !inside;
  }
  return inside;
}

/** Gemeinsame 2D-Helfer (Grundebene x/z) für Layout, Wege, Laternen und Umgebung. */

export type Pt = { x: number; z: number };

export const TAU = Math.PI * 2;

/** Punkt auf dem Kreis mit Radius `r` beim Winkel `a`. */
export function polar(a: number, r: number): Pt {
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

/** Winkel auf den Bereich [0, 2π) bringen. */
export function normalizeAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}

/** Kleinster Abstand zweier Winkel (0 bis π). */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, TAU - d);
}

/** Abstand des Punktes (px, pz) zur Strecke a–b. */
export function distPointToSegment(px: number, pz: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

/** FNV-1a-Hash für deterministische Variation pro Id. */
export function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

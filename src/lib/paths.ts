/** Ein Weg als Linienzug: Zuweg (Dorfplatz → Quartierplatz) oder Gasse (Quartierplatz hinaus, Häuser beidseits). */
export type VillagePath = {
  id: string;
  /** Hauptweg (Dorfplatz → Quartierplatz), Gasse, Stichweg (v2: Tor → Rückgrat) oder Fusspfad (Wanderweg). */
  kind: "haupt" | "gasse" | "stich" | "pfad";
  /** Quartier-Id. */
  ownerId: string;
  /** Index in der Quartierfarbe, `null` für Wege ohne Quartier. */
  quarterIndex: number | null;
  points: { x: number; z: number }[];
  width: number;
  /** Phase der leichten Breitenschwankung. */
  seed: number;
};

type Pt = { x: number; z: number };

function distPointToSegment(px: number, pz: number, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

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
export function hermite(S: Pt, dS: Pt, G: Pt, dG: Pt, amp: number, sign: number): Pt[] {
  const D = Math.hypot(G.x - S.x, G.z - S.z);
  const N = Math.max(20, Math.round(D * 3));
  const kk = D * 0.5;
  const nx = -(G.z - S.z) / D;
  const nz = (G.x - S.x) / D;
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
      const t = (s - acc) / l;
      return { x: pts[i].x + dx * t, z: pts[i].z + dz * t, angle: Math.atan2(dx, dz) };
    }
    acc += l;
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { x: b.x, z: b.z, angle: Math.atan2(b.x - a.x, b.z - a.z) };
}

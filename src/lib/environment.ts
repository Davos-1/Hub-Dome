/**
 * Deterministische Platzierung der Umgebung (Fluss, Teich, Weide, Windmühle) ausserhalb der Häuser.
 * Alles hängt nur von `extent` (Radius des Dorfs) und einem Seed ab – gleiche Daten, gleiche Landschaft.
 */

export type Pt = { x: number; z: number };
export type Circle = { x: number; z: number; r: number };

export type Environment = {
  /** Flussmitte als Linienzug (läuft bei beiden Enden aus dem Bild). */
  river: { points: Pt[]; width: number; bridge: { x: number; z: number; angle: number } };
  pond: Circle;
  /** Weide: Mittelpunkt, Breite (entlang Tangente), Tiefe, Drehung um Y. */
  pasture: { x: number; z: number; w: number; d: number; angle: number };
  windmill: { x: number; z: number; angle: number };
  /** Kreise, die andere Dekoration (Bäume, Büsche …) freihalten muss. */
  reserved: Circle[];
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const polar = (angle: number, radius: number): Pt => ({
  x: Math.cos(angle) * radius,
  z: Math.sin(angle) * radius,
});

export const RIVER_WIDTH = 3.4;
/** Fluss belegt den hinteren Bogen (von +z aus gesehen die Rückseite); die Vorderseite bleibt frei. */
const RIVER_CENTER = -Math.PI / 2;
const RIVER_HALF_SPAN = 1.75;

export function computeEnvironment(extent: number, seed: string): Environment {
  const k = hash(seed);
  const phase = ((k % 628) / 100) as number;

  // Fluss: Bogen um das Dorf, leicht mäandernd, die Enden laufen nach aussen aus dem Dorf
  const points: Pt[] = [];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = RIVER_CENTER - RIVER_HALF_SPAN + t * RIVER_HALF_SPAN * 2;
    const meander = 1.3 * Math.sin(t * 7 + phase) + 0.5 * Math.sin(t * 15 + phase * 2);
    points.push(polar(a, extent + 4.5 + meander));
  }
  const first = polar(RIVER_CENTER - RIVER_HALF_SPAN - 0.12, extent + 14);
  const last = polar(RIVER_CENTER + RIVER_HALF_SPAN + 0.12, extent + 14);
  const riverPts = [
    polar(RIVER_CENTER - RIVER_HALF_SPAN - 0.3, extent + 38),
    first,
    ...points,
    last,
    polar(RIVER_CENTER + RIVER_HALF_SPAN + 0.3, extent + 38),
  ];

  // Brücke ungefähr bei 62 % des Flusses
  const bi = Math.round(points.length * 0.62);
  const bp = points[bi];
  const bn = points[bi + 1];
  const bridge = { x: bp.x, z: bp.z, angle: Math.atan2(bn.x - bp.x, bn.z - bp.z) };

  // Freie Vorderseite: Windmühle, Weide, Teich
  const windmillAngle = 0.5 + (((k >>> 4) % 20) - 10) / 200;
  const pastureAngle = 1.2;
  const pondAngle = 2.4 + (((k >>> 9) % 20) - 10) / 200;

  const windmillPos = polar(windmillAngle, extent + 5.5);
  const pasturePos = polar(pastureAngle, extent + 6.5);
  const pondPos = polar(pondAngle, extent + 6);
  const pasture = {
    x: pasturePos.x,
    z: pasturePos.z,
    w: 10,
    d: 6.5,
    // lange Seite verläuft entlang der Tangente
    angle: Math.atan2(-pasturePos.z, -pasturePos.x) + Math.PI / 2,
  };
  const windmill = {
    x: windmillPos.x,
    z: windmillPos.z,
    angle: Math.atan2(-windmillPos.x, -windmillPos.z),
  };
  const pond: Circle = { ...pondPos, r: 3.6 };

  const reserved: Circle[] = [
    { x: pasture.x, z: pasture.z, r: 7.2 },
    { x: pond.x, z: pond.z, r: pond.r + 1.5 },
    { x: windmill.x, z: windmill.z, r: 4.2 },
    // Fluss als Kette von Kreisen (Breite plus Uferstreifen)
    ...riverPts.map((p) => ({ x: p.x, z: p.z, r: RIVER_WIDTH / 2 + 1.6 })),
  ];

  return {
    river: { points: riverPts, width: RIVER_WIDTH, bridge },
    pond,
    pasture,
    windmill,
    reserved,
  };
}

/** Liegt der Punkt in einem reservierten Bereich (plus Abstand)? */
export function isReserved(env: Environment, x: number, z: number, margin = 0): boolean {
  return env.reserved.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + margin);
}

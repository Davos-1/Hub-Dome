import type { HouseLayout } from "./layout";

/** Ein Weg von der Dorfplatz-Kante zur Haustür als Linienzug. */
export type VillagePath = {
  houseId: string;
  points: { x: number; z: number }[];
  /** Kurvenform 0–3 (Bogen, S-Kurve, Gegenbogen, Schlängeln). */
  shape: number;
  /** Belag 0–3 (Sand, Kies, Platten, Trittsteine). */
  surface: number;
  width: number;
  /** Tatsächlich verwendete maximale seitliche Auslenkung in Metern. */
  amplitude: number;
};

type Pt = { x: number; z: number };

export const PATH_WIDTH = 1.5;
/** Mindestabstand zwischen den Kanten zweier Wege. */
const GAP = 0.35;
const MAX_AMPLITUDE = 2.8;
const SAMPLES = 40;

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seitliche Auslenkung (−1…1) über t ∈ [0,1], an beiden Enden 0. */
function shapeFn(shape: number, t: number): number {
  switch (shape) {
    case 0:
      return Math.sin(Math.PI * t);
    case 1:
      return Math.sin(2 * Math.PI * t);
    case 2:
      return -Math.sin(Math.PI * t);
    default:
      return (
        (0.65 * Math.sin(2 * Math.PI * t) + 0.45 * Math.sin(3 * Math.PI * t + 0.8)) *
        Math.sin(Math.PI * t) ** 0.3
      );
  }
}

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
 * Verteilt die Startwinkel am Dorfplatz so, dass benachbarte Wege mindestens `minSpacing` (Bogenmass)
 * Abstand haben. Einfache Relaxation; bei sehr vielen Wegen (> ca. 19) ist das nicht mehr möglich.
 */
function spreadStartAngles(angles: number[], minSpacing: number): number[] {
  const n = angles.length;
  if (n < 2) return angles.slice();
  const order = angles.map((a, i) => ({ a, i })).sort((p, q) => p.a - q.a);
  const a = order.map((o) => o.a);
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let k = 0; k < n; k++) {
      const next = (k + 1) % n;
      const nextA = next === 0 ? a[0] + Math.PI * 2 : a[next];
      const gap = nextA - a[k];
      if (gap < minSpacing - 1e-6) {
        const push = (minSpacing - gap) / 2;
        a[k] -= push;
        if (next === 0) a[0] += push;
        else a[next] += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const result = new Array<number>(n);
  order.forEach((o, k) => (result[o.i] = a[k]));
  return result;
}

/**
 * Erzeugt für jedes Haus einen organisch geschwungenen Weg.
 *
 * Garantie gegen Berührung («Korridor-Verfahren»): Zuerst wird für jedes Haus der gerade Weg
 * (Startpunkt am Dorfplatz → Haustür) festgelegt. An jedem Punkt eines geraden Wegs wird der Abstand
 * e zu allen anderen geraden Wegen gemessen. Darf jeder Weg dort höchstens (e − Breite − Lücke)/2 seitlich
 * ausweichen, bleiben zwei Kurven rechnerisch mindestens Breite + Lücke voneinander entfernt.
 * Ebenso hält jeder Weg Abstand zu fremden Häusern. Die Auslenkung wird gleichmässig skaliert, damit die
 * Kurvenform glatt bleibt. Form und Belag hängen deterministisch von der Haus-ID ab.
 */
export function computePaths(houses: HouseLayout[], plazaRadius: number): VillagePath[] {
  const homes = houses.filter((h) => h.ring > 0);
  if (homes.length === 0) return [];
  const W = PATH_WIDTH + GAP + 0.05;

  // 1) Startwinkel auf dem Dorfplatz entzerren, gerade Wege festlegen
  const baseAngles = homes.map((h) => Math.atan2(h.z, h.x));
  const starts = spreadStartAngles(baseAngles, W / plazaRadius);
  const rays = homes.map((h, i) => {
    const len = Math.hypot(h.x, h.z);
    const rx = h.x / len;
    const rz = h.z / len;
    const s: Pt = { x: Math.cos(starts[i]) * plazaRadius, z: Math.sin(starts[i]) * plazaRadius };
    const reach = h.footprint * 1.05 + 0.55;
    const d: Pt = { x: h.x - rx * reach, z: h.z - rz * reach };
    return { s, d };
  });
  const straight = rays.map(({ s, d }) =>
    Array.from({ length: SAMPLES + 1 }, (_, k) => ({
      x: s.x + (d.x - s.x) * (k / SAMPLES),
      z: s.z + (d.z - s.z) * (k / SAMPLES),
    })),
  );

  return homes.map((h, i) => {
    const k = hash(h.id);
    const shape = k % 4;
    const surface = (k >>> 3) % 4;
    const sign = (k >>> 6) % 2 === 0 ? 1 : -1;
    const wanted = MAX_AMPLITUDE * (0.55 + ((k >>> 9) % 100) / 220);

    const { s, d } = rays[i];
    const dx = d.x - s.x;
    const dz = d.z - s.z;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;

    // 2) Erlaubte Auslenkung an jedem Stützpunkt
    const allowed = straight[i].map((p) => {
      let bound = Infinity;
      for (let j = 0; j < homes.length; j++) {
        if (j === i) continue;
        const e = distanceToPolyline(p.x, p.z, straight[j]);
        bound = Math.min(bound, (e - W) / 2);
      }
      for (const o of homes) {
        if (o.id === h.id) continue;
        const clear = o.footprint * 1.9 + 0.8 + PATH_WIDTH / 2;
        bound = Math.min(bound, Math.hypot(p.x - o.x, p.z - o.z) - clear);
      }
      return Math.max(0, bound);
    });

    // 3) Kurve gleichmässig so weit skalieren, dass sie überall im Korridor bleibt
    let scale = 1;
    for (let q = 1; q < SAMPLES; q++) {
      const want = Math.abs(wanted * shapeFn(shape, q / SAMPLES));
      if (want > 1e-6) scale = Math.min(scale, allowed[q] / want);
    }
    const amp = wanted * Math.max(0, scale);

    const points = straight[i].map((p, q) => {
      const lateral = sign * amp * shapeFn(shape, q / SAMPLES);
      return { x: p.x + nx * lateral, z: p.z + nz * lateral };
    });
    return { houseId: h.id, points, shape, surface, width: PATH_WIDTH, amplitude: amp };
  });
}

/**
 * Panorama hinter der Karte (P2): drei gestaffelte Ringe (Vorberge mit Wald, Berge, ferne Gipfel), Form aus dem
 * Seed. Reine Darstellung: nichts hier beeinflusst eine Platzierung. Die Karte endet als runde Scheibe
 * (`groundRadius`); der vordere Ring beginnt darunter und steigt über ihren Rand, damit keine Kante, kein Loch
 * und kein Abbruch am Horizont entsteht. Wo ein Wasserlauf die Karte verlässt, öffnet sich ein Tal.
 */

import { smooth } from "../terrain";
import { distPointPolyline, TAU } from "./geom";
import { heightAt, riversOf, type WorldMap } from "./map";
import { range, rng } from "./seed";

export type Ring = {
  /** Innen- und Aussenradius (Meter von der Dorfmitte). */
  rIn: number;
  rOut: number;
  /** Höhe über Grund an (Winkel, Radius). */
  height: (a: number, r: number) => number;
  /** Luftperspektive 0…1 (hinten heller und bläulicher). */
  haze: number;
};

export type Panorama = {
  groundRadius: number;
  rings: Ring[];
  /** Schneegrenze (Meter); `Infinity` ohne Schnee. */
  snowLine: number;
  /** Baumgrenze für den Wald auf dem vorderen Ring (Meter). */
  treeLine: number;
  /** Winkel der Wahrzeichen (Alpweide, Kapelle, Wasserfall), fern von Tälern. */
  landmarks: { alp: number; chapel: number; waterfall: number };
};

/** Radius der runden Karte (Bodenscheibe). */
export const groundRadius = (m: WorldMap) => m.rFlat + 110;

/**
 * Zufallskurve über den Winkel (−1…1, geschlossen): weiche Wellen, mit `crest` > 0 zusätzlich Grate (gefaltete
 * Wellen mit scharfen Spitzen), damit ferne Ketten zerklüftet statt rund wirken.
 */
function ridge(r: () => number, octaves: [number, number][], crest = 0) {
  const waves = octaves.map(([f, amp]) => ({ f, amp: amp * range(r, 0.6, 1.2), p: r() * TAU }));
  const folds = octaves.map(([f, amp]) => ({
    f: f * 2 + 1,
    amp: amp * range(r, 0.5, 1.1),
    p: r() * TAU,
  }));
  const norm = waves.reduce((s, w) => s + w.amp, 0);
  const fnorm = folds.reduce((s, w) => s + w.amp, 0);
  return (a: number) => {
    const soft = waves.reduce((s, w) => s + w.amp * Math.sin(w.f * a + w.p), 0) / norm;
    if (!crest) return soft;
    const sharp =
      folds.reduce((s, w) => s + w.amp * (1 - Math.abs(Math.sin(w.f * a + w.p))) ** 1.6, 0) / fnorm;
    return soft * (1 - crest) + (sharp * 2 - 1) * crest;
  };
}

/** Winkel, an denen Wasserläufe die Karte verlassen (dort entstehen Täler). */
function valleyAngles(m: WorldMap, R: number): number[] {
  const out: number[] = [];
  for (const river of riversOf(m)) {
    for (const end of [river.points[0], river.points[river.points.length - 1]]) {
      if (Math.hypot(end.x, end.z) > m.rFlat) out.push(Math.atan2(end.z, end.x));
    }
  }
  if (m.lake && Math.hypot(m.lake.x, m.lake.z) + m.lake.r > R - 40)
    out.push(Math.atan2(m.lake.z, m.lake.x));
  return out;
}

const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export function panoramaOf(m: WorldMap): Panorama {
  const r = rng(m.seed, "panorama");
  const R = groundRadius(m);
  const alpin = m.stimmung === "alpin";
  const high = alpin ? 1.35 : m.landschaft === "hochplateau" ? 1.2 : 1;
  const valleys = valleyAngles(m, R);
  const valley = (a: number, width: number) =>
    valleys.reduce((v, va) => Math.min(v, smooth(angDist(a, va) / width)), 1);

  const foot = ridge(r, [
    [3, 1],
    [7, 0.5],
    [13, 0.25],
  ]);
  const footH = range(r, 16, 30) * high;
  const mid = ridge(
    r,
    [
      [2, 1],
      [5, 0.6],
      [11, 0.3],
      [23, 0.12],
    ],
    0.35,
  );
  const midH = range(r, 55, 95) * high;
  const far = ridge(
    r,
    [
      [3, 1],
      [7, 0.7],
      [15, 0.4],
      [31, 0.2],
    ],
    0.6,
  );
  const farH = range(r, 110, 190) * high;
  // Ein paar markante Gipfel auf dem fernen Ring
  const peaks = Array.from({ length: 4 + Math.floor(r() * 3) }, () => ({
    a: r() * TAU,
    w: range(r, 0.12, 0.28),
    h: range(r, 0.3, 0.6) * farH,
  }));

  const rivers = riversOf(m);
  const ground = (a: number, rad: number) => heightAt(m, Math.cos(a) * rad, Math.sin(a) * rad);

  const rings: Ring[] = [
    {
      // Vorberge: beginnen 25 m innerhalb der Bodenscheibe knapp unter dem Gelände und liegen am Rand der
      // Scheibe deutlich darüber (verdecken die Kante); Täler an den Wasserläufen
      rIn: R - 25,
      rOut: R + 150,
      haze: 0.35,
      height: (a, rad) => {
        const t = smooth((rad - (R - 25)) / 95);
        const shape = 0.65 + 0.35 * foot(a);
        const v = valley(a, 0.22);
        // Am Rand der Scheibe mindestens 1.2 m über dem Gelände, innen 0.6 m darunter
        const lip = -0.6 + 1.8 * smooth((rad - (R - 25)) / 25);
        const h = ground(a, Math.min(rad, R)) + lip + t * footH * shape * (0.25 + 0.75 * v);
        // Wo ein Wasserlauf weiterfliesst, bleibt das Tal unter dem Wasser (der Fluss verschwindet nicht im Hang)
        const w = rivers.length ? riverDistance(m, Math.cos(a) * rad, Math.sin(a) * rad) : Infinity;
        return w < 30 ? Math.min(h, -0.3 + Math.max(0, w - 4) * 0.45) : h;
      },
    },
    {
      rIn: R + 110,
      rOut: R + 330,
      haze: 0.62,
      height: (a, rad) => {
        const t = Math.sin(Math.PI * Math.min(1, Math.max(0, (rad - (R + 110)) / 220)));
        const v = valley(a, 0.12);
        return t * midH * (0.55 + 0.45 * mid(a)) * (0.5 + 0.5 * v) - 4;
      },
    },
    {
      rIn: R + 280,
      rOut: R + 560,
      haze: 0.8,
      height: (a, rad) => {
        const t = Math.sin(Math.PI * Math.min(1, Math.max(0, (rad - (R + 280)) / 280)));
        let h = farH * (0.55 + 0.45 * far(a));
        // Markante Gipfel als weiche Erhebungen mit eigenem Grat (keine einzelnen Kegel)
        for (const p of peaks) {
          const d = angDist(a, p.a) / p.w;
          h += p.h * Math.exp(-d * d * 2.2) * (0.85 + 0.15 * Math.sin(a * 47 + p.a));
        }
        return t * h - 6;
      },
    },
  ];

  // Wahrzeichen fern von Tälern und voneinander
  const pickAngle = (avoid: number[]) => {
    for (let k = 0; k < 48; k++) {
      const a = r() * TAU;
      if (valleys.every((v) => angDist(a, v) > 0.5) && avoid.every((v) => angDist(a, v) > 0.9))
        return a;
    }
    return r() * TAU;
  };
  const alp = pickAngle([]);
  const chapel = pickAngle([alp]);
  const waterfall = pickAngle([alp, chapel]);

  return {
    groundRadius: R,
    rings,
    snowLine: alpin ? farH * 0.55 : m.landschaft === "hochplateau" ? farH * 0.8 : farH * 0.92,
    treeLine: footH * 0.95 + 4,
    landmarks: { alp, chapel, waterfall },
  };
}

/** Abstand eines Punktes zum nächsten Wasserlauf (für Wald und Wahrzeichen: nicht ins Wasser). */
export function riverDistance(m: WorldMap, x: number, z: number): number {
  let best = Infinity;
  for (const river of riversOf(m)) best = Math.min(best, distPointPolyline(x, z, river.points));
  return best;
}

import { isInPlot, type VillageLayout } from "./layout";
import { distanceToPolyline, pathLength, pointAlong } from "./paths";
import { seededRandom } from "./random";

export type LampSpot = { x: number; z: number };

const TAU = Math.PI * 2;

/**
 * Strassenlaternen: am Hauptplatz an jeder Wegeinmündung zwei, an den Nebenplätzen an zufälligen Ecken
 * (mindestens zwei), entlang der Wege unregelmässig (Abstand 6–14 m, Seite zufällig, 20 % der Stellen leer).
 * Deterministisch.
 */
export function computeLamps(layout: VillageLayout): LampSpot[] {
  const rnd = seededRandom("laternen");
  const lamps: LampSpot[] = [];
  const tooClose = (x: number, z: number, d: number) =>
    lamps.some((l) => Math.hypot(l.x - x, l.z - z) < d);

  for (const p of layout.polys) {
    const R = p.a / Math.cos(Math.PI / p.n);
    if (p.main) {
      const side = 2 * p.a * Math.tan(Math.PI / p.n);
      for (let k = 0; k < p.n; k++) {
        const a = p.rot + (TAU * k) / p.n;
        const used = p.used.some(
          (u) => Math.abs(Math.atan2(Math.sin(u - a), Math.cos(u - a))) < 0.02,
        );
        const c = { x: Math.cos(a), z: Math.sin(a) };
        const t = { x: -c.z, z: c.x };
        const d = p.a - 0.75;
        const off = used ? p.gap / 2 + 0.45 : side * 0.28;
        for (const sg of [-1, 1]) {
          lamps.push({ x: p.x + c.x * d + t.x * sg * off, z: p.z + c.z * d + t.z * sg * off });
        }
      }
    } else {
      let placed = 0;
      for (let i = 0; i < p.n; i++) {
        if (rnd() > 0.45 && !(i === p.n - 1 && placed < 2)) continue;
        const b = p.rot + Math.PI / p.n + (TAU * i) / p.n;
        const rr = R - 0.35 - rnd() * 0.3;
        lamps.push({ x: p.x + Math.cos(b) * rr, z: p.z + Math.sin(b) * rr });
        placed++;
      }
    }
  }

  layout.paths.forEach((pp, pi) => {
    const total = pathLength(pp.points);
    const w0 = pp.width / 2;
    for (let sd = 2.5 + rnd() * 5; sd < total - 2.5; sd += 6 + rnd() * 8) {
      if (rnd() < 0.2) continue;
      const a = pointAlong(pp.points, sd);
      const sg = rnd() < 0.5 ? 1 : -1;
      const w = w0 + 0.45 + rnd() * 0.5;
      const x = a.x + Math.cos(a.angle) * w * sg;
      const z = a.z - Math.sin(a.angle) * w * sg;
      if (
        Math.hypot(x, z) < layout.plazaRadius + 1.5 ||
        isInPlot(layout, x, z, 0.4) ||
        tooClose(x, z, 4) ||
        layout.paths.some(
          (q, qi) => qi !== pi && distanceToPolyline(x, z, q.points) < q.width / 2 + 0.3,
        )
      ) {
        continue;
      }
      lamps.push({ x, z });
    }
  });
  return lamps;
}

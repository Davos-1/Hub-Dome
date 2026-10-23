import type { FachbereichId } from "./fachbereiche";
import type { VillageLayout } from "./layout";

/** Kamerapose: Position und Blickziel (Weltkoordinaten). */
export type Pose = { position: [number, number, number]; target: [number, number, number] };
export type ViewMode = "3d" | "karte";

export type Nav =
  | { level: "dorf" }
  | { level: "quartier"; q: FachbereichId }
  | { level: "haus"; q: FachbereichId | null; h: string };

export const overviewPose = (extent: number): Pose => ({
  position: [0, extent * 1.0 + 11, extent * 1.38 + 16],
  target: [0, 0, 0],
});

export const mapPose = (extent: number): Pose => ({
  position: [0, extent * 1.75 + 8, 0.05],
  target: [0, 0, 0],
});

/** Abstand der Übersichtskamera zum Ursprung (für den Nebel). */
export const overviewDistance = (extent: number) => Math.hypot(extent + 11, extent * 1.38 + 16);

/** Quartier wie einen Ordner öffnen: Blick auf Nebenplatz und Häuser von der Seite der Zentrale. */
export function quarterPose(layout: VillageLayout, id: FachbereichId, view: ViewMode): Pose {
  const q = layout.quarters.find((x) => x.id === id);
  if (!q) return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
  let cx = q.x;
  let cz = q.z;
  for (const hid of q.houseIds) {
    cx += layout.houses[hid].x;
    cz += layout.houses[hid].z;
  }
  cx /= q.houseIds.length + 1;
  cz /= q.houseIds.length + 1;
  const R = q.radius;
  if (view === "karte") return { position: [cx, R * 2.2 + 10, cz + 0.05], target: [cx, 0, cz] };
  const ux = Math.cos(q.theta);
  const uz = Math.sin(q.theta);
  const back = R * 1.25 + 7;
  return { position: [cx - ux * back, R * 1.05 + 8, cz - uz * back], target: [cx, 0, cz] };
}

/** Höhe der Quartiertafeln samt Pfosten (Meter) und Sicherheitsabstand der Blickachse darüber. */
const BOARD_TOP = 4.2;
const BOARD_MARGIN = 1.3;

/**
 * Liegt die Blickachse (Kamera → Ziel) durch eine Quartiertafel? Die Tafel steht in der Mitte des
 * Quartierplatzes quer zur Eingangsrichtung, ist 5.2 m breit, mit 0.8 m Spielraum an den Seiten.
 */
function blockedByBoard(
  layout: VillageLayout,
  from: [number, number, number],
  to: [number, number, number],
) {
  const steps = 60;
  for (const q of layout.quarters) {
    // Achse senkrecht zur Tafel (zeigt vom Platz nach aussen)
    const ux = -Math.cos(q.entrySide);
    const uz = -Math.sin(q.entrySide);
    const cx = q.x + ux * 0.4;
    const cz = q.z + uz * 0.4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from[0] + (to[0] - from[0]) * t;
      const z = from[2] + (to[2] - from[2]) * t;
      const y = from[1] + (to[1] - from[1]) * t;
      const along = (x - cx) * ux + (z - cz) * uz; // Richtung Zentrale/weg
      const side = -(x - cx) * uz + (z - cz) * ux;
      if (
        Math.abs(side) < 2.6 + 0.8 &&
        Math.abs(along) < 0.4 + 0.8 &&
        y < BOARD_TOP + BOARD_MARGIN
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Öffnungswinkel und Seitenverhältnis der Szenenkamera (Desktop; schmale Bildschirme rückt der Rig weiter weg). */
const FOV_Y = (45 * Math.PI) / 180;
const ASPECT = 1.6;
const NEAR = 0.3;

/**
 * Wie viel des Bildes decken Quartiertafeln, die nicht hinter dem Ziel stehen? Grob über die projizierten
 * Ecken der Tafel samt Pfosten, Anteil der Bildfläche 0…1 (summiert über alle Tafeln).
 */
export function boardClutter(
  layout: VillageLayout,
  from: [number, number, number],
  to: [number, number, number],
): number {
  const fx = to[0] - from[0];
  const fy = to[1] - from[1];
  const fz = to[2] - from[2];
  const fl = Math.hypot(fx, fy, fz);
  const f = [fx / fl, fy / fl, fz / fl];
  // rechts = f × oben, oben' = rechts × f
  const rl = Math.hypot(f[2], f[0]);
  const r = [-f[2] / rl, 0, f[0] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const ty = Math.tan(FOV_Y / 2);
  let sum = 0;
  for (const q of layout.quarters) {
    const ex = Math.cos(q.entrySide);
    const ez = Math.sin(q.entrySide);
    const cx = q.x - ex * 0.4;
    const cz = q.z - ez * 0.4;
    // Tafel samt Pfosten als Rechteck in Kamerakoordinaten (rechts, oben, Tiefe)
    const quad = (
      [
        [-2.6, 0],
        [2.6, 0],
        [2.6, BOARD_TOP],
        [-2.6, BOARD_TOP],
      ] as const
    ).map(([sd, y]) => {
      const px = cx - ez * sd - from[0];
      const py = y - from[1];
      const pz = cz + ex * sd - from[2];
      return [
        px * r[0] + py * r[1] + pz * r[2],
        px * u[0] + py * u[1] + pz * u[2],
        px * f[0] + py * f[1] + pz * f[2],
      ];
    });
    if (Math.min(...quad.map((c) => Math.hypot(c[0], c[1], c[2]))) > fl + 1) continue;
    // Am Nahpunkt abschneiden (Teile hinter der Kamera), dann projizieren
    const clipped: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      if (a[2] >= NEAR) clipped.push(a);
      if (a[2] >= NEAR !== b[2] >= NEAR) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    if (!clipped.length) continue;
    const sx = clipped.map((c) => c[0] / (c[2] * ty * ASPECT));
    const sy = clipped.map((c) => c[1] / (c[2] * ty));
    const w = Math.max(0, Math.min(1, Math.max(...sx)) - Math.max(-1, Math.min(...sx)));
    const h = Math.max(0, Math.min(1, Math.max(...sy)) - Math.max(-1, Math.min(...sy)));
    sum += (w * h) / 4;
  }
  return sum;
}

/**
 * Haus von vorne aus der Vogelperspektive: vor dem Gartentor, etwas weiter draussen und höher. Die
 * Blickachse führt sicher über die Quartiertafeln hinweg, und keine Tafel füllt den Vordergrund (Häuser am
 * Quartierplatz: die Tafel steht vor ihnen, dann leicht seitlich oder näher).
 */
export function housePose(layout: VillageLayout, id: string, view: ViewMode): Pose {
  const h = layout.houses[id];
  if (!h) return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
  if (view === "karte") return { position: [h.x, 30, h.z + 0.01], target: [h.x, 0, h.z] };
  const gate = h.plot ? h.plot.front : h.footprint * 2;
  const target: [number, number, number] = [
    h.x + Math.sin(h.angle) * gate * 0.45,
    1.1,
    h.z + Math.cos(h.angle) * gate * 0.45,
  ];
  const at = (off: number, back: number, lift: number): [number, number, number] => [
    h.x + Math.sin(h.angle + off) * back,
    6.2 + h.footprint * 1.1 + lift,
    h.z + Math.cos(h.angle + off) * back,
  ];
  // Beste Pose: wenig Tafel im Bild, möglichst von vorne, auf üblicher Höhe und Distanz
  let best: { p: [number, number, number]; score: number } | null = null;
  for (const lift of [0, 2.5, 5, 8])
    for (const back of [gate + 8, gate + 5.5, gate + 11])
      for (const off of [0, 0.45, -0.45, 0.8, -0.8, 1.15, -1.15]) {
        const p = at(off, back, lift);
        const score =
          boardClutter(layout, p, target) +
          (blockedByBoard(layout, p, target) ? 1 : 0) +
          Math.abs(off) * 0.02 +
          lift * 0.004 +
          Math.abs(back - gate - 8) * 0.002;
        if (!best || score < best.score - 1e-9) best = { p, score };
      }
  const position = best!.p;
  // Notfalls höher gehen, bis die Blickachse frei über jeder Tafel liegt (Obergrenze: 40 m)
  while (position[1] < 40 && blockedByBoard(layout, position, target)) position[1] += 0.5;
  return { position, target };
}

/**
 * Feste Kameraposen für die Screenshot-Matrix (Entwickler-Route): Übersicht, Vogelperspektive,
 * Strassenhöhe am Dorfplatz, erstes Quartier oder ein bestimmtes Haus.
 */
export function devPose(layout: VillageLayout, kamera: string, houseId?: string): Pose | null {
  const e = layout.extent;
  if (kamera === "uebersicht") return overviewPose(e);
  if (kamera === "vogel") return { position: [0, e * 1.7 + 18, e * 0.55 + 4], target: [0, 0, 0] };
  const q = layout.quarters[0];
  if (kamera === "strasse") {
    if (!q) return { position: [0, 1.7, layout.plazaRadius + 6], target: [0, 1.4, 0] };
    const a = q.mainSide;
    const r = layout.plazaRadius - 2;
    return {
      position: [Math.cos(a) * r + Math.sin(a) * 1.2, 1.7, Math.sin(a) * r - Math.cos(a) * 1.2],
      target: [q.x, 1.6, q.z],
    };
  }
  if (kamera === "quartier" && q) return quarterPose(layout, q.id, "3d");
  if (houseId) return housePose(layout, houseId, "3d");
  return null;
}

export function poseFor(layout: VillageLayout, nav: Nav, view: ViewMode): Pose {
  if (nav.level === "quartier") return quarterPose(layout, nav.q, view);
  if (nav.level === "haus") return housePose(layout, nav.h, view);
  return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
}

/** Eine Ebene zurück: Haus → Quartier (falls vorhanden) → Dorf. */
export function navUp(nav: Nav): Nav {
  if (nav.level === "haus" && nav.q) return { level: "quartier", q: nav.q };
  return { level: "dorf" };
}

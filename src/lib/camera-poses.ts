import type { FachbereichId } from "./fachbereiche";
import type { VillageLayout } from "./layout";

/** Kamerapose: Position und Blickziel (Weltkoordinaten). */
export type Pose = { position: [number, number, number]; target: [number, number, number] };
export type ViewMode = "3d" | "karte";
export type Vec3 = [number, number, number];

/**
 * Freier Bildausschnitt in Normalkoordinaten (−1…1), also ohne die Flächen unter Suche, Leiste und Fenster.
 * Ein Haus oder die Zentrale wird in diesen Ausschnitt eingepasst.
 */
export type Frame = { left: number; right: number; bottom: number; top: number };
export const FULL_FRAME: Frame = { left: -1, right: 1, bottom: -1, top: 1 };

export type PoseOpts = {
  /** Seitenverhältnis der Leinwand (Breite/Höhe); Hochformat < 1. */
  aspect?: number;
  /** Freier Bildausschnitt (Standard: ganzes Bild). */
  frame?: Frame;
  /**
   * Hüllpunkte (Weltkoordinaten) des tatsächlichen Modells: Haus samt Garten bzw. Zentrale samt Sockel,
   * Objektring und Figur. Fehlen sie, gilt eine grobe Schätzung aus dem Layout.
   */
  hullOf?: (id: string) => Vec3[] | null;
};

/** Rand um das eingepasste Modell (Anteil des freien Ausschnitts je Seite). */
export const FIT_MARGIN = 0.12;

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
export function quarterPose(
  layout: VillageLayout,
  id: FachbereichId,
  view: ViewMode,
  opts: PoseOpts = {},
): Pose {
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
  // Quartierplatz und alle Grundstücke des Quartiers im freien Ausschnitt, Blick von der Seite der Zentrale
  const pts: Vec3[] = [
    [q.x - q.rp, 0, q.z - q.rp],
    [q.x + q.rp, 4, q.z + q.rp],
  ];
  for (const hid of q.houseIds) pts.push(...roughHull(layout, hid));
  const azimuth = Math.atan2(-Math.cos(q.theta), -Math.sin(q.theta));
  return fitPose(pts, [cx, 0, cz], unit(azimuth, 0.62), opts.aspect ?? ASPECT, opts.frame, 14);
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

/** Kamera-Basis für eine Blickrichtung (vorwärts, rechts, oben). */
function basis(forward: Vec3) {
  const rl = Math.hypot(forward[2], forward[0]) || 1;
  const right: Vec3 = [-forward[2] / rl, 0, forward[0] / rl];
  const up: Vec3 = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  return { right, up };
}

/**
 * Projiziert Punkte für eine Kamera an `cam` mit Blickrichtung `forward` und prüft, ob alle im Ausschnitt
 * (samt Rand) liegen. Gibt die grösste Überschreitung zurück (≤ 0 = alles sichtbar).
 */
export function frameOverflow(
  points: Vec3[],
  cam: Vec3,
  forward: Vec3,
  aspect: number,
  frame: Frame,
  margin = FIT_MARGIN,
): number {
  const { right, up } = basis(forward);
  const ty = Math.tan(FOV_Y / 2);
  const cx = (frame.left + frame.right) / 2;
  const cy = (frame.bottom + frame.top) / 2;
  const hx = ((frame.right - frame.left) / 2) * (1 - margin);
  const hy = ((frame.top - frame.bottom) / 2) * (1 - margin);
  let worst = -Infinity;
  for (const p of points) {
    const rx = p[0] - cam[0];
    const ry = p[1] - cam[1];
    const rz = p[2] - cam[2];
    const z = rx * forward[0] + ry * forward[1] + rz * forward[2];
    if (z < NEAR) return Infinity;
    const x = (rx * right[0] + ry * right[1] + rz * right[2]) / (z * ty * aspect);
    const y = (rx * up[0] + ry * up[1] + rz * up[2]) / (z * ty);
    worst = Math.max(worst, Math.abs(x - cx) - hx, Math.abs(y - cy) - hy);
  }
  return worst;
}

/**
 * Pose, die alle Hüllpunkte mit Rand in den freien Ausschnitt einpasst: Blick aus Richtung `dir` (Einheitsvektor
 * vom Ziel zur Kamera) auf `center`; der kleinste Abstand ab `minDist` wird gesucht (Bisektion). Liegt der
 * Ausschnitt nicht mittig (Fenster rechts offen), wird die Kamera seitlich versetzt, damit das Modell in der
 * Mitte des freien Ausschnitts steht; Blickpunkt (Drehzentrum) ist dann der entsprechend versetzte Punkt.
 */
export function fitPose(
  points: Vec3[],
  center: Vec3,
  dir: Vec3,
  aspect: number,
  frame: Frame = FULL_FRAME,
  minDist = 6,
): Pose {
  const forward: Vec3 = [-dir[0], -dir[1], -dir[2]];
  const { right, up } = basis(forward);
  const ty = Math.tan(FOV_Y / 2);
  const cx = (frame.left + frame.right) / 2;
  const cy = (frame.bottom + frame.top) / 2;
  const camAt = (d: number): Vec3 => {
    // Mitte des Modells soll bei (cx, cy) erscheinen
    const sx = cx * d * ty * aspect;
    const sy = cy * d * ty;
    return [
      center[0] + dir[0] * d - right[0] * sx - up[0] * sy,
      center[1] + dir[1] * d - right[1] * sx - up[1] * sy,
      center[2] + dir[2] * d - right[2] * sx - up[2] * sy,
    ];
  };
  const ok = (d: number) => frameOverflow(points, camAt(d), forward, aspect, frame) <= 0;
  let lo = minDist;
  let hi = Math.max(minDist * 2, 40);
  while (!ok(hi) && hi < 2000) hi *= 1.6;
  if (ok(lo)) hi = lo;
  for (let i = 0; i < 40 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  const position = camAt(hi);
  return {
    position,
    target: [
      position[0] + forward[0] * hi,
      position[1] + forward[1] * hi,
      position[2] + forward[2] * hi,
    ],
  };
}

/**
 * Verschiebt eine Pose seitlich und in der Höhe, sodass ihr Blickziel in der Mitte des freien Ausschnitts
 * erscheint (Übersicht bei offener Liste); `farther` > 1 rückt zusätzlich weiter weg (Streifen des Inventars).
 */
export function shiftPose(pose: Pose, frame: Frame, aspect: number, farther = 1): Pose {
  const t = pose.target;
  const off: Vec3 = [
    (pose.position[0] - t[0]) * farther,
    (pose.position[1] - t[1]) * farther,
    (pose.position[2] - t[2]) * farther,
  ];
  const d = Math.hypot(off[0], off[1], off[2]) || 1;
  const forward: Vec3 = [-off[0] / d, -off[1] / d, -off[2] / d];
  const { right, up } = basis(forward);
  const ty = Math.tan(FOV_Y / 2);
  const sx = ((frame.left + frame.right) / 2) * d * ty * aspect;
  const sy = ((frame.bottom + frame.top) / 2) * d * ty;
  const move = (p: Vec3): Vec3 => [
    p[0] - right[0] * sx - up[0] * sy,
    p[1] - right[1] * sx - up[1] * sy,
    p[2] - right[2] * sx - up[2] * sy,
  ];
  return { position: move([t[0] + off[0], t[1] + off[1], t[2] + off[2]]), target: move(t) };
}

/** Grobe Hülle ohne Modell: Grundstück bis Dachhöhe bzw. Terrasse und Turm der Zentrale. */
function roughHull(layout: VillageLayout, id: string): Vec3[] {
  const h = layout.houses[id];
  const pts: Vec3[] = [];
  if (!h.plot) {
    const r = Math.max(layout.terrace, h.footprint * 1.6);
    for (const x of [-r, r])
      for (const z of [-r, r])
        for (const y of [0, h.footprint * 6.6]) pts.push([h.x + x, y, h.z + z]);
    return pts;
  }
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  for (const lx of [-h.plot.hw, h.plot.hw])
    for (const lz of [-h.plot.back, h.plot.front])
      for (const y of [0, h.footprint * 3.4])
        pts.push([h.x + lx * c + lz * s, y, h.z - lx * s + lz * c]);
  return pts;
}

const unit = (azimuth: number, elevation: number): Vec3 => [
  Math.sin(azimuth) * Math.cos(elevation),
  Math.sin(elevation),
  Math.cos(azimuth) * Math.cos(elevation),
];

/**
 * Zentrale ganz im Bild: Blick von vorne (+z, leicht schräg, falls eine Tafel stört) auf die Mitte der
 * Hüllbox; der Abstand ergibt sich aus Hülle, Öffnungswinkel und Seitenverhältnis (auch Hochformat).
 */
export function zentralePose(layout: VillageLayout, id: string, opts: PoseOpts = {}): Pose {
  const aspect = opts.aspect ?? ASPECT;
  const frame = opts.frame ?? FULL_FRAME;
  const pts = opts.hullOf?.(id) ?? roughHull(layout, id);
  let min: Vec3 = [Infinity, Infinity, Infinity];
  let max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let best: { pose: Pose; score: number } | null = null;
  for (const elev of [0.36, 0.46, 0.56])
    for (const az of [0, 0.3, -0.3, 0.6, -0.6]) {
      const pose = fitPose(pts, center, unit(az, elev), aspect, frame, 8);
      const score =
        boardClutter(layout, pose.position, pose.target) +
        (blockedByBoard(layout, pose.position, pose.target) ? 1 : 0) +
        Math.abs(az) * 0.03 +
        Math.abs(elev - 0.46) * 0.05;
      if (!best || score < best.score - 1e-9) best = { pose, score };
    }
  return best!.pose;
}

/**
 * Haus von vorne aus der Vogelperspektive: vor dem Gartentor, etwas weiter draussen und höher. Die
 * Blickachse führt sicher über die Quartiertafeln hinweg, und keine Tafel füllt den Vordergrund (Häuser am
 * Quartierplatz: die Tafel steht vor ihnen, dann leicht seitlich oder näher).
 */
export function housePose(
  layout: VillageLayout,
  id: string,
  view: ViewMode,
  opts: PoseOpts = {},
): Pose {
  const h = layout.houses[id];
  if (!h) return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
  if (view === "karte") return { position: [h.x, 30, h.z + 0.01], target: [h.x, 0, h.z] };
  if (!h.plot) return zentralePose(layout, id, opts);
  const aspect = opts.aspect ?? ASPECT;
  const frame = opts.frame ?? FULL_FRAME;
  const pts = opts.hullOf?.(id) ?? roughHull(layout, id);
  const gate = h.plot.front;
  const center: Vec3 = [
    h.x + Math.sin(h.angle) * gate * 0.3,
    1.1,
    h.z + Math.cos(h.angle) * gate * 0.3,
  ];
  // Beste Pose: wenig Tafel im Bild, möglichst von vorne und nicht zu steil; der Abstand ergibt sich aus der
  // Hülle (Haus samt Garten ganz im freien Ausschnitt)
  let best: { pose: Pose; score: number } | null = null;
  for (const elev of [0.53, 0.66, 0.8, 0.93])
    for (const off of [0, 0.45, -0.45, 0.8, -0.8, 1.15, -1.15]) {
      const pose = fitPose(pts, center, unit(h.angle + off, elev), aspect, frame, 11);
      const score =
        boardClutter(layout, pose.position, pose.target) +
        (blockedByBoard(layout, pose.position, pose.target) ? 1 : 0) +
        Math.abs(off) * 0.02 +
        (elev - 0.53) * 0.03;
      if (!best || score < best.score - 1e-9) best = { pose, score };
    }
  const { position, target } = best!.pose;
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
  if (kamera === "panorama") {
    // Vom Rand des Dorfplatzes knapp über den Dächern zum Horizont (Hintergrund, Übergang Karte → Ferne)
    const a = q ? q.mainSide + Math.PI : Math.PI / 2;
    const r = layout.plazaRadius;
    return {
      position: [Math.cos(a) * r, 9, Math.sin(a) * r],
      target: [Math.cos(a) * (r + 120), 14, Math.sin(a) * (r + 120)],
    };
  }
  if (kamera === "weg") {
    // Nahaufnahme einer Gasse (sonst eines Zuwegs): knapp über dem Boden, der Weg läuft ins Bild
    const p =
      layout.paths.find((x) => x.kind === "gasse" && x.points.length > 30) ??
      layout.paths.find((x) => x.kind === "haupt");
    if (p) {
      const i = Math.min(p.points.length - 1, 12);
      const a = p.points[Math.max(0, i - 8)];
      const b = p.points[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      return {
        position: [a.x - (dx / l) * 2 + (dz / l) * 1.2, 2.1, a.z - (dz / l) * 2 - (dx / l) * 1.2],
        target: [b.x + (dx / l) * 3, 0, b.z + (dz / l) * 3],
      };
    }
  }
  if (houseId) return housePose(layout, houseId, "3d");
  return null;
}

export function poseFor(
  layout: VillageLayout,
  nav: Nav,
  view: ViewMode,
  opts: PoseOpts = {},
): Pose {
  if (nav.level === "quartier") return quarterPose(layout, nav.q, view, opts);
  if (nav.level === "haus") return housePose(layout, nav.h, view, opts);
  return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
}

/** Eine Ebene zurück: Haus → Quartier (falls vorhanden) → Dorf. */
export function navUp(nav: Nav): Nav {
  if (nav.level === "haus" && nav.q) return { level: "quartier", q: nav.q };
  return { level: "dorf" };
}

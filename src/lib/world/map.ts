/**
 * Weltkarte (Generator v1): Landschaft, Wasser, Merkmale, Gelände und Stimmung hängen **nur vom Seed** ab,
 * nicht von der Grösse des Dorfs. Die Siedlung passt sich der Landschaft an (nicht umgekehrt), damit
 * Wasser und Merkmale nie wandern, wenn Häuser dazukommen.
 */

import { smooth } from "../terrain";
import {
  box,
  circle,
  distPointPolyline,
  overlaps,
  pointInPolygon,
  polar,
  resample,
  TAU,
  type Circle,
  type Pt,
  type Shape,
} from "./geom";
import { pickWeighted, range, rng } from "./seed";
import { DIRECTIONS, laneAxis } from "./axes";
import { SEED_OBJEKT, seedObjektShape, type SeedObjekt } from "./seed-objects";

/** Merkmale bleiben so weit von jeder Gassenachse weg, dass dort beidseits Häuser Platz haben. */
export const LANE_BAND = 10.8;

/** Landschaften v1 (flussbogen, bachtal, seeufer, huegelland) und v2 (zusätzlich die übrigen). */
export type Landschaft =
  | "flussbogen"
  | "bachtal"
  | "seeufer"
  | "huegelland"
  | "flussdorf"
  | "flussgabel"
  | "bergsee"
  | "bucht"
  | "hochplateau";
export type Stimmung = "fruehling" | "sommer" | "herbst" | "alpin";

export const LANDSCHAFT_LABELS: Record<Landschaft, string> = {
  flussbogen: "Flussbogen",
  bachtal: "Bachtal",
  seeufer: "Seeufer",
  huegelland: "Hügelland",
  flussdorf: "Flussdorf",
  flussgabel: "Flussgabel mit Insel",
  bergsee: "Bergsee",
  bucht: "Bucht",
  hochplateau: "Hochplateau",
};
export const STIMMUNG_LABELS: Record<Stimmung, string> = {
  fruehling: "Frühling",
  sommer: "Sommer",
  herbst: "Herbst",
  alpin: "Alpin",
};

/** Farben einer Stimmung (Gras, Laub, Nadeln, Büsche, Blüten, Pflaster). */
export type Palette = {
  grassIn: string;
  grassOut: string;
  grassHill: string;
  lawn: string;
  leaves: string[];
  /** Kronen der Blütenbäume (Frühling) bzw. Obstbäume. */
  blossom: string[];
  needles: string[];
  bushes: string[];
  flowers: string[];
  rocks: string[];
  paving: string;
  /** Anteil Nadelbäume in der Streuung (0…1). */
  conifer: number;
};

export const PALETTES: Record<Stimmung, Palette> = {
  sommer: {
    grassIn: "#86bf6c",
    grassOut: "#9ccc82",
    grassHill: "#b4cf86",
    lawn: "#9fcf83",
    leaves: ["#5c9b4f", "#4f8f47", "#68a658"],
    blossom: ["#6aa95a", "#e04f4f", "#f0a33a"],
    needles: ["#4f9a58", "#3f8a4e", "#5ba861", "#468f55"],
    bushes: ["#5aa65e", "#6cb56a", "#4d9a55"],
    flowers: ["#ec4899", "#f59e0b", "#ef4444", "#a855f7", "#fde047"],
    rocks: ["#9ca3af", "#a8a29e", "#b6b0a6"],
    paving: "#c9bfa2",
    conifer: 0.45,
  },
  fruehling: {
    grassIn: "#8fc872",
    grassOut: "#a6d58a",
    grassHill: "#bcd98e",
    lawn: "#a5d68a",
    leaves: ["#7cbf5c", "#8fcb6a", "#69ad55"],
    blossom: ["#f6b8cc", "#fbe2ea", "#f3a1bb"],
    needles: ["#5aa461", "#4a9656", "#62ad68"],
    bushes: ["#78c06a", "#8bcb78", "#6ab460"],
    flowers: ["#f9a8d4", "#fde68a", "#c4b5fd", "#ffffff", "#93c5fd"],
    rocks: ["#a8adb4", "#b4afa6", "#bdb8ae"],
    paving: "#d1c8ad",
    conifer: 0.3,
  },
  herbst: {
    grassIn: "#97b968",
    grassOut: "#adc47c",
    grassHill: "#c2c98a",
    lawn: "#a7c97f",
    leaves: ["#d9822b", "#c4572e", "#e0a43a", "#a3a13f"],
    blossom: ["#c4572e", "#e0a43a", "#b8442a"],
    needles: ["#3f7f4c", "#356f42", "#4a8a55"],
    bushes: ["#b9853a", "#9c8a3c", "#c06a35"],
    flowers: ["#f59e0b", "#b91c1c", "#d97706", "#a16207"],
    rocks: ["#9a958c", "#a39c90", "#8f8a82"],
    paving: "#c7b89a",
    conifer: 0.4,
  },
  alpin: {
    grassIn: "#7db46b",
    grassOut: "#90c07d",
    grassHill: "#a9c48d",
    lawn: "#94c47f",
    leaves: ["#4c8a48", "#457f42", "#5a9650"],
    blossom: ["#4c8a48", "#f5f5f0", "#e9e4d8"],
    needles: ["#356f47", "#2f6640", "#3d7a4f", "#2a5c3a"],
    bushes: ["#4f8f52", "#5c9b5a", "#47834a"],
    flowers: ["#3b6fd6", "#f5f5f0", "#7c3aed", "#facc15"],
    rocks: ["#9aa1a8", "#a9adb2", "#8c9298", "#b9bcbf"],
    paving: "#bdb7a8",
    conifer: 0.75,
  },
};

export type River = {
  points: Pt[];
  width: number;
  /** Nur v2: Bach (schmal, klar) oder Fluss (breit, mit Sandbänken und Schaumlinien). */
  kind?: "fluss" | "bach";
};
/** Brücke; `style` nur v2 (Steinbogen bei breitem Wasser, sonst Holz). */
export type Bridge = {
  x: number;
  z: number;
  angle: number;
  span: number;
  style?: "holz" | "stein";
};
/** Felsen (v2): Gruppe von Blöcken auf einem Kreis. */
export type Rock = { x: number; z: number; r: number; h: number };
/** Kontinuierliche Parameter der Welt (v2). */
export type MapParams = {
  /** Waldanteil (Dichte der Streu- und Hügelbäume), 0.6–1.5. */
  forest: number;
  /** Felsanteil 0–1. */
  rocks: number;
  /** Dichte der Seed-Objekte 0–1. */
  density: number;
  /** Farbton von Licht und Himmel: −1 kühl … +1 warm. */
  tint: number;
};
export type Pasture = { x: number; z: number; w: number; d: number; angle: number };
export type Windmill = { x: number; z: number; angle: number };
export type Orchard = { x: number; z: number; w: number; d: number; angle: number };

export type WorldMap = {
  seed: string;
  landschaft: Landschaft;
  stimmung: Stimmung;
  palette: Palette;
  /** Bis hier ist das Gelände flach. */
  rFlat: number;
  /** Bis hier darf gebaut und dekoriert werden. */
  rBuild: number;
  /** Hauptplatz: Apothem, Seitenzahl, Drehung. */
  plaza: { a: number; n: number; rot: number };
  river: River | null;
  bridge: Bridge | null;
  /** Fusspfad über die Brücke (Wanderweg, endet an einer Aussichtsbank). */
  trail: Pt[] | null;
  pond: Circle | null;
  lake: { x: number; z: number; r: number; outline: Pt[] } | null;
  pasture: Pasture | null;
  windmill: Windmill | null;
  orchard: Orchard | null;
  /** Aussichtsbank am Ende des Wanderwegs. */
  viewBench: { x: number; z: number; angle: number } | null;
  hills: {
    amp: number;
    f1: number;
    f2: number;
    p1: number;
    p2: number;
    /** Nur v2: Breite des Anstiegs am Rand der flachen Zone (v1: 18 m; Hochplateau steiler). */
    ramp?: number;
  };
  /** Generator-Version der Karte (fehlt bei v1). */
  version?: number;
  /** Nur v2: weitere Wasserläufe (Flussarm, Zufluss, Bach). Brücken dürfen sie queren. */
  streams?: River[];
  /** Nur v2: Seed-Objekte (Auswahl je Welt). */
  objects?: SeedObjekt[];
  /** Nur v2: Felsen. */
  rocks?: Rock[];
  /** Nur v2: Sandbänke im Fluss (nur Darstellung, Umriss). */
  sandbanks?: Pt[][];
  /** Nur v2: Wasserfall am Rand (Bach über die Plateaukante), nur Darstellung. */
  waterfall?: { x: number; z: number; angle: number } | null;
  /** Nur v2: kontinuierliche Parameter. */
  params?: MapParams;
};

/** Alle Wasserläufe der Karte (Hauptfluss und, nur v2, weitere). */
export const riversOf = (m: Pick<WorldMap, "river" | "streams">): River[] =>
  m.river ? [m.river, ...(m.streams ?? [])] : [...(m.streams ?? [])];

export const RIVER_WIDTH = 3.4;
/** Uferstreifen beidseits des Flusses (Sand, Schilf). */
export const RIVER_BANK = 0.85;
export const TRAIL_WIDTH = 1.15;

/** Fluss im Bogen hinter dem Dorf; die Enden laufen in die Hügel. */
function flussbogen(r: () => number, rFlat: number): Pt[] {
  const c = -Math.PI / 2 + range(r, -0.7, 0.7);
  const half = range(r, 1.0, 1.35);
  const rr = range(r, 76, 86);
  const phase = r() * TAU;
  const pts: Pt[] = [polar(c - half - 0.32, rFlat + 48)];
  pts.push(polar(c - half - 0.14, rFlat + 14));
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = c - half + t * half * 2;
    const m = 1.4 * Math.sin(t * 7 + phase) + 0.5 * Math.sin(t * 15 + phase * 2);
    pts.push(polar(a, rr + m));
  }
  pts.push(polar(c + half + 0.14, rFlat + 14));
  pts.push(polar(c + half + 0.32, rFlat + 48));
  return pts;
}

/** Bach quer über eine Seite der Karte (Sehne), leicht mäandernd. */
function bachtal(r: () => number, rFlat: number): Pt[] {
  const c = range(r, 0, TAU);
  const d = range(r, 70, 78);
  const n = { x: Math.cos(c), z: Math.sin(c) };
  const t = { x: -n.z, z: n.x };
  const L = rFlat + 55;
  const phase = r() * TAU;
  const pts: Pt[] = [];
  const steps = 70;
  for (let i = 0; i <= steps; i++) {
    const s = -L + (2 * L * i) / steps;
    const m = 1.6 * Math.sin(s * 0.09 + phase) + 0.6 * Math.sin(s * 0.23 + phase * 1.7);
    // Bogen nach aussen, damit der Bach die flache Zone nur streift
    const bow = (s * s) / (2 * (L + 30));
    pts.push({ x: n.x * (d + m + bow) + t.x * s, z: n.z * (d + m + bow) + t.z * s });
  }
  return pts;
}

/** See am Rand: unregelmässiges Ufer, Mittelpunkt aussen. */
function seeufer(r: () => number): { x: number; z: number; r: number; outline: Pt[] } {
  const c = range(r, 0, TAU);
  const d = range(r, 98, 106);
  const rad = range(r, 13, 16);
  const ctr = polar(c, d);
  const phase = r() * TAU;
  const outline: Pt[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (TAU * i) / 40;
    const rr = rad * (1 + 0.12 * Math.sin(a * 3 + phase) + 0.06 * Math.sin(a * 5 + phase * 2));
    outline.push({ x: ctr.x + Math.cos(a) * rr, z: ctr.z + Math.sin(a) * rr });
  }
  return { x: ctr.x, z: ctr.z, r: rad * 1.18, outline };
}

/** Wasser als Grundflächen (für die Prüfung von Merkmalen auf der Karte selbst). */
export function waterHits(
  m: Pick<WorldMap, "river" | "pond" | "lake" | "streams">,
  s: Shape,
  margin: number,
): boolean {
  for (const river of riversOf(m)) {
    const d = distPointPolyline(s.x, s.z, river.points);
    const reach = s.kind === "circle" ? s.r : Math.hypot(s.hw, s.hd);
    if (d < river.width / 2 + RIVER_BANK + reach + margin) return true;
  }
  if (m.pond && overlaps(s, m.pond, margin + 1.2)) return true;
  if (m.lake) {
    if (pointInPolygon(s.x, s.z, m.lake.outline)) return true;
    const reach = s.kind === "circle" ? s.r : Math.hypot(s.hw, s.hd);
    if (distPointPolyline(s.x, s.z, [...m.lake.outline, m.lake.outline[0]]) < reach + margin + 1.2)
      return true;
  }
  return false;
}

/** Erste gültige Stelle auf einem Ring für ein Merkmal (deterministisch, meidet Wasser und andere Merkmale). */
export function placeOnRing(
  r: () => number,
  m: Pick<WorldMap, "river" | "pond" | "lake" | "streams">,
  taken: Shape[],
  axes: Pt[][],
  radii: [number, number],
  make: (x: number, z: number, angle: number) => Shape,
): { x: number; z: number; angle: number } | null {
  const start = r() * TAU;
  for (let k = 0; k < 72; k++) {
    const a = start + (k * TAU * 29) / 72; // springend verteilt, nicht der Reihe nach
    for (const rr of [radii[0], (radii[0] + radii[1]) / 2, radii[1]]) {
      const p = polar(a, rr);
      // Lange Seite entlang der Tangente, Front zur Dorfmitte
      const angle = Math.atan2(-p.x, -p.z);
      const s = make(p.x, p.z, angle);
      if (waterHits(m, s, 1.5)) continue;
      if (taken.some((t) => overlaps(s, t, 3))) continue;
      const reach = s.kind === "circle" ? s.r : Math.hypot(s.hw, s.hd);
      if (axes.some((ax) => distPointPolyline(s.x, s.z, ax) - reach < LANE_BAND)) continue;
      return { x: p.x, z: p.z, angle };
    }
  }
  return null;
}

/** Erzeugt die Weltkarte aus dem Seed (Generator v1). */
export function generateMap(seed: string): WorldMap {
  const r = rng(seed, "karte");
  const landschaft = pickWeighted<Landschaft>(r, [
    ["flussbogen", 3],
    ["bachtal", 2],
    ["seeufer", 2],
    ["huegelland", 2],
  ]);
  const stimmung = pickWeighted<Stimmung>(r, [
    ["sommer", 3],
    ["fruehling", 2],
    ["herbst", 2],
    ["alpin", 2],
  ]);
  const rFlat = landschaft === "huegelland" ? range(r, 104, 110) : range(r, 110, 118);
  const plaza = {
    a: range(r, 11.4, 12.4),
    n: pickWeighted(r, [
      [9, 3],
      [18, 2],
    ] as const),
    rot: r() * TAU,
  };

  const map: WorldMap = {
    seed,
    landschaft,
    stimmung,
    palette: PALETTES[stimmung],
    rFlat,
    rBuild: rFlat - 2,
    plaza,
    river: null,
    bridge: null,
    trail: null,
    pond: null,
    lake: null,
    pasture: null,
    windmill: null,
    orchard: null,
    viewBench: null,
    hills: {
      amp: landschaft === "huegelland" ? range(r, 3.2, 4.2) : range(r, 2.0, 3.0),
      f1: range(r, 0.07, 0.11),
      f2: range(r, 0.15, 0.22),
      p1: r() * TAU,
      p2: r() * TAU,
    },
  };

  if (landschaft === "flussbogen" || landschaft === "bachtal") {
    const pts = landschaft === "flussbogen" ? flussbogen(r, rFlat) : bachtal(r, rFlat);
    map.river = { points: resample(pts, 1.2), width: landschaft === "bachtal" ? 2.6 : RIVER_WIDTH };
  }
  if (landschaft === "seeufer") {
    map.lake = seeufer(r);
  }
  // Achsen aller Gassen (gleiche Funktion wie die Siedlung): Merkmale liegen in den Lücken dazwischen
  // (grob abgetastet, alle 2 m: für Abstände von über 10 m genau genug)
  const axes = Array.from({ length: DIRECTIONS }, (_, k) =>
    laneAxis(seed, plaza, k, rFlat - 2, map.lake).axis.filter((_, i) => i % 4 === 0),
  );

  if (landschaft !== "seeufer") {
    // Teich auf der freien Seite
    const spot = placeOnRing(r, map, [], axes, [46, 58], (x, z) => circle(x, z, 4.2));
    if (spot) map.pond = circle(spot.x, spot.z, range(r, 3.2, 4.0));
  }

  // Brücke mit Wanderweg über den Fluss: dort, wo der Fluss der Dorfmitte am nächsten ist (in der flachen Zone)
  if (map.river) {
    const pts = map.river.points;
    // Brücke in einer Lücke zwischen zwei Gassen (Wanderweg und Bank stören keine Häuser)
    const cands = pts
      .map((p, i) => ({
        p,
        i,
        d: Math.hypot(p.x, p.z),
        gap: Math.min(...axes.map((ax) => distPointPolyline(p.x, p.z, ax))),
      }))
      .filter((c) => c.i > 6 && c.i < pts.length - 7 && c.d < rFlat - 6 && c.gap > LANE_BAND + 6);
    if (cands.length) {
      const c = cands.sort((a, b) => b.gap - a.gap)[0];
      const a = pts[c.i - 2];
      const b = pts[c.i + 2];
      const flow = Math.atan2(b.x - a.x, b.z - a.z);
      // Brückenachse quer zum Fluss; Wanderweg von der Aussichtsbank (innen) über die Brücke nach aussen
      const ax = Math.cos(flow);
      const az = -Math.sin(flow);
      const toCenter = -(c.p.x * ax + c.p.z * az) > 0 ? 1 : -1;
      const ix = ax * toCenter;
      const iz = az * toCenter;
      const span = map.river.width + 3.2;
      map.bridge = { x: c.p.x, z: c.p.z, angle: Math.atan2(ix, iz), span };
      const inner = { x: c.p.x + ix * (span / 2 + 5.5), z: c.p.z + iz * (span / 2 + 5.5) };
      const outer = { x: c.p.x - ix * (span / 2 + 16), z: c.p.z - iz * (span / 2 + 16) };
      map.trail = resample([inner, { x: c.p.x, z: c.p.z }, outer], 0.5);
      map.viewBench = { x: inner.x + ix * 1.6, z: inner.z + iz * 1.6, angle: Math.atan2(-ix, -iz) };
    }
  }

  const taken: Shape[] = [];
  if (map.pond) taken.push(circle(map.pond.x, map.pond.z, map.pond.r + 1.5));
  if (map.trail) for (const p of map.trail) taken.push(circle(p.x, p.z, 2));
  if (map.viewBench) taken.push(circle(map.viewBench.x, map.viewBench.z, 2));

  // Weide (fast immer), Windmühle (meist), Obstgarten (manchmal)
  if (r() < 0.9) {
    const w = range(r, 9, 11.5);
    const d = range(r, 6, 7.5);
    const spot = placeOnRing(r, map, taken, axes, [50, 64], (x, z, a) =>
      box(x, z, w / 2 + 1, d / 2 + 1, a + Math.PI / 2),
    );
    if (spot) {
      map.pasture = { x: spot.x, z: spot.z, w, d, angle: spot.angle + Math.PI / 2 };
      taken.push(box(spot.x, spot.z, w / 2 + 1, d / 2 + 1, spot.angle + Math.PI / 2));
    }
  }
  if (r() < 0.8) {
    const spot = placeOnRing(r, map, taken, axes, [44, 60], (x, z) => circle(x, z, 3.6));
    if (spot) {
      map.windmill = spot;
      taken.push(circle(spot.x, spot.z, 3.6));
    }
  }
  if (r() < 0.55) {
    const w = range(r, 10, 13);
    const d = range(r, 7, 9);
    const spot = placeOnRing(r, map, taken, axes, [52, 66], (x, z, a) =>
      box(x, z, w / 2, d / 2, a + Math.PI / 2),
    );
    if (spot) map.orchard = { x: spot.x, z: spot.z, w, d, angle: spot.angle + Math.PI / 2 };
  }
  return map;
}

/** Grundflächen der Merkmale (Weide, Mühle, Obstgarten, Aussichtsbank), die Siedlung und Deko meiden. */
export function featureShapes(m: WorldMap): { shape: Shape; label: string }[] {
  const out: { shape: Shape; label: string }[] = [];
  if (m.pasture) {
    out.push({
      shape: box(
        m.pasture.x,
        m.pasture.z,
        m.pasture.w / 2 + 0.6,
        m.pasture.d / 2 + 0.6,
        m.pasture.angle,
      ),
      label: "auf der Weide",
    });
  }
  if (m.windmill)
    out.push({ shape: circle(m.windmill.x, m.windmill.z, 3.0), label: "an der Windmühle" });
  if (m.orchard) {
    out.push({
      shape: box(m.orchard.x, m.orchard.z, m.orchard.w / 2, m.orchard.d / 2, m.orchard.angle),
      label: "im Obstgarten",
    });
  }
  if (m.viewBench)
    out.push({ shape: circle(m.viewBench.x, m.viewBench.z, 1.2), label: "an der Aussichtsbank" });
  // Nur v2: Seed-Objekte und Felsen
  for (const o of m.objects ?? [])
    out.push({ shape: seedObjektShape(o), label: SEED_OBJEKT[o.typ].label });
  for (const k of m.rocks ?? []) out.push({ shape: circle(k.x, k.z, k.r), label: "an den Felsen" });
  return out;
}

export type Crossing = {
  x: number;
  z: number;
  angle: number;
  span: number;
  ok: boolean;
  /** Breite des gequerten Wassers. */
  width: number;
};

/**
 * Stellen, an denen ein Weg den Fluss quert (Brücken). `ok` heisst: Winkel zum Fluss ≥ 35° und kurz genug.
 * `angle` ist die Richtung des Wegs (atan2(dx, dz)), `span` die Länge der Brücke.
 */
export function riverCrossings(m: WorldMap, pts: Pt[], hw: number): Crossing[] {
  return riversOf(m).flatMap((river) => crossingsOf(river, pts, hw));
}

function crossingsOf(river: River, pts: Pt[], hw: number): Crossing[] {
  const reach = river.width / 2 + RIVER_BANK + hw + 0.3;
  const out: Crossing[] = [];
  let run: number[] = [];
  const flush = () => {
    if (!run.length) return;
    const a = pts[Math.max(0, run[0] - 1)];
    const b = pts[Math.min(pts.length - 1, run[run.length - 1] + 1)];
    const mid = pts[run[Math.floor(run.length / 2)]];
    const dir = Math.atan2(b.x - a.x, b.z - a.z);
    // Flussrichtung an der Stelle
    let best = 0;
    let bd = Infinity;
    river.points.forEach((p, i) => {
      const d = Math.hypot(p.x - mid.x, p.z - mid.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    const rp = river.points;
    const f0 = rp[Math.max(0, best - 2)];
    const f1 = rp[Math.min(rp.length - 1, best + 2)];
    const flow = Math.atan2(f1.x - f0.x, f1.z - f0.z);
    const sin = Math.abs(Math.sin(dir - flow));
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    // Schräge Brücken bis 35° sind erlaubt; die Brücke ist dann entsprechend länger
    const across = river.width + 2 * RIVER_BANK + 2 * hw + 0.6;
    out.push({
      x: mid.x,
      z: mid.z,
      angle: dir,
      span,
      ok: sin > 0.57 && span < across / Math.max(sin, 0.57) + 1.5,
      width: river.width,
    });
    run = [];
  };
  pts.forEach((p, i) => {
    if (distPointPolyline(p.x, p.z, river.points) < reach) run.push(i);
    else flush();
  });
  flush();
  return out;
}

/** Wasserprüfung mit Uferabstand `margin` (Steg und Brücke sind Sonderfälle und werden separat geprüft). */
export function inWater(m: WorldMap, s: Shape, margin = 0): boolean {
  return waterHits(m, s, margin);
}

/** Abstand eines Punktes zur nächsten Wasserkante (negativ im Wasser); Infinity ohne Wasser. */
export function waterEdgeDist(m: WorldMap, x: number, z: number): number {
  let best = Infinity;
  for (const river of riversOf(m))
    best = Math.min(best, distPointPolyline(x, z, river.points) - river.width / 2);
  if (m.pond) best = Math.min(best, Math.hypot(x - m.pond.x, z - m.pond.z) - m.pond.r);
  if (m.lake) {
    const d = distPointPolyline(x, z, [...m.lake.outline, m.lake.outline[0]]);
    best = Math.min(best, pointInPolygon(x, z, m.lake.outline) ? -d : d);
  }
  return best;
}

/** Geländehöhe: flach bis `rFlat`, aussen sanfte Hügel; an Wasser und Merkmalen flach gedrückt. */
export function heightAt(m: WorldMap, x: number, z: number): number {
  const r = Math.hypot(x, z);
  const s = smooth((r - m.rFlat) / (m.hills.ramp ?? 18));
  if (s <= 0) return 0;
  const { amp, f1, f2, p1, p2 } = m.hills;
  let h =
    s *
    (amp +
      1.4 * Math.sin(x * f1 + p1) * Math.cos(z * (f1 * 1.2) - p2) +
      0.6 * Math.sin(x * f2 + z * f2 * 0.8 + p2));
  if (h <= 0) return 0;
  // Täler für Wasser und den Wanderweg
  const w = waterEdgeDist(m, x, z);
  if (w < 6) h *= smooth(w / 6);
  if (m.trail && h > 0) {
    const d = distPointPolyline(x, z, m.trail);
    if (d < 5) h *= smooth((d - 1) / 4);
  }
  return Math.max(0, h);
}

/** Kurzbeschreibung der Landschaft (Einstellungen, Vorschau). */
export function describeMap(m: WorldMap): string {
  return `${LANDSCHAFT_LABELS[m.landschaft]} · ${STIMMUNG_LABELS[m.stimmung]}`;
}

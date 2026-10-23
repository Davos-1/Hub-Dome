/**
 * Weltkarte, Generator v2 (Phase 4g): mehr Landschaftstypen, kontinuierliche Parameter statt weniger fester
 * Varianten, ein präsenter Fluss (im Dorfbild statt am Rand) und eine Auswahl an Seed-Objekten je Welt.
 * Grundsatz wie v1: Die Landschaft hängt **nur vom Seed** ab, die Siedlung weicht ihr aus.
 *
 * Abstände zur Siedlung: Wasser bleibt ausserhalb der Quartierplätze (nächster Punkt ≥ 21 m + halbe Breite +
 * Ufer); Merkmale halten wie in v1 `LANE_BAND` Abstand zu allen neun Gassenachsen, damit dort beidseits Häuser
 * Platz haben. Gassen queren Flüsse und Bäche auf Brücken.
 */

import { laneAxesOf } from "./axes";
import {
  box,
  circle,
  distPointPolyline,
  overlaps,
  pointInPolygon,
  polar,
  resample,
  TAU,
  toWorld,
  type Pt,
  type Shape,
} from "./geom";
import {
  LANE_BAND,
  PALETTES,
  placeOnRing,
  RIVER_BANK,
  riversOf,
  waterEdgeDist,
  waterHits,
  type Landschaft,
  type MapParams,
  type Palette,
  type River,
  type Rock,
  type Stimmung,
  type WorldMap,
} from "./map";
import { pickWeighted, range, rng } from "./seed";
import {
  SEED_OBJEKT,
  seedObjektShape,
  spanFor,
  type SeedObjekt,
  type SeedObjektTyp,
} from "./seed-objects";

/** Gewichte der Landschaftstypen v2. */
export const LANDSCHAFTEN_V2: readonly (readonly [Landschaft, number])[] = [
  ["flussdorf", 3],
  ["flussgabel", 2],
  ["bergsee", 2],
  ["bucht", 1.5],
  ["hochplateau", 1.5],
  ["bachtal", 2],
  ["huegelland", 1.5],
];

/** Wasser bleibt mindestens so weit von der Dorfmitte (Quartierplätze liegen innerhalb von 21 m). */
const minWaterDist = (width: number) => 21 + width / 2 + RIVER_BANK + 1.5;

// ---------- Farben ----------

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Farbe leicht verschieben (Farbton, Sättigung, Helligkeit; kleine Werte). */
export function shade(hex: string, dh: number, ds: number, dl: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(
    (h + dh + 1) % 1,
    Math.max(0, Math.min(1, s + ds)),
    Math.max(0, Math.min(1, l + dl)),
  );
}

/** Palette der Stimmung, getönt: warm (+) Richtung Gelbgrün, kühl (−) Richtung Blaugrün, leicht variiert. */
function tintPalette(p: Palette, tint: number, r: () => number): Palette {
  const dh = -0.012 * tint;
  const ds = range(r, -0.05, 0.06);
  const dl = range(r, -0.03, 0.03);
  const g = (c: string) => shade(c, dh, ds, dl);
  return {
    ...p,
    grassIn: g(p.grassIn),
    grassOut: g(p.grassOut),
    grassHill: g(p.grassHill),
    lawn: g(p.lawn),
    leaves: p.leaves.map((c) => shade(c, dh * 0.6, ds * 0.5, dl)),
    bushes: p.bushes.map((c) => shade(c, dh * 0.6, ds * 0.5, dl)),
    needles: p.needles.map((c) => shade(c, dh * 0.4, 0, dl)),
  };
}

// ---------- Wasser ----------

/** Fluss oder Bach als Sehne an der Dorfmitte vorbei: nächster Punkt bei `d`, mäandernd. */
function meanderRiver(
  r: () => number,
  d: number,
  width: number,
  rFlat: number,
  kind: "fluss" | "bach",
  amp: [number, number],
  wave: [number, number],
  dir = r() * TAU,
): { river: River; base: (s: number) => Pt; n: Pt; t: Pt } {
  const n = { x: Math.cos(dir), z: Math.sin(dir) };
  const t = { x: -n.z, z: n.x };
  const a1 = range(r, amp[0], amp[1]);
  const l1 = range(r, wave[0], wave[1]);
  const a2 = range(r, 0.8, 2.2);
  const l2 = range(r, 16, 28);
  const p1 = r() * TAU;
  const p2 = r() * TAU;
  const minD = minWaterDist(width);
  const off = (s: number) =>
    Math.max(minD, d + a1 * Math.sin((TAU * s) / l1 + p1) + a2 * Math.sin((TAU * s) / l2 + p2));
  const base = (s: number): Pt => ({ x: n.x * off(s) + t.x * s, z: n.z * off(s) + t.z * s });
  // Bis unter die Vorberge des Panoramas (dort öffnet sich ein Tal), damit der Fluss nicht im Gelände endet
  const L = rFlat + 130;
  const pts: Pt[] = [];
  for (let s = -L; s <= L + 1e-6; s += 1.5) pts.push(base(s));
  return { river: { points: resample(pts, 1.2), width, kind }, base, n, t };
}

/** Flussgabel: Hauptarm aussen, zweiter Arm innen um eine Insel. */
function forkRiver(r: () => number, rFlat: number) {
  const width = range(r, 4.6, 6.2);
  const d = range(r, 48, 58);
  const m = meanderRiver(r, d, width, rFlat, "fluss", [1.5, 3.5], [60, 90]);
  const s0 = range(r, -16, 16);
  const li = range(r, 16, 22);
  const wi = range(r, 7, 9.5);
  const bump = (s: number) =>
    Math.abs(s - s0) < li ? wi * Math.sin((Math.PI * (s - s0 + li)) / (2 * li)) : 0;
  const shift = (s: number, sign: number): Pt => {
    const b = m.base(s);
    return { x: b.x + m.n.x * sign * bump(s), z: b.z + m.n.z * sign * bump(s) };
  };
  const L = rFlat + 130;
  const outer: Pt[] = [];
  for (let s = -L; s <= L + 1e-6; s += 1.5) outer.push(shift(s, 1));
  const inner: Pt[] = [];
  for (let s = s0 - li - 4; s <= s0 + li + 4 + 1e-6; s += 1) inner.push(shift(s, -1));
  const armW = width * 0.72;
  return {
    river: { points: resample(outer, 1.2), width, kind: "fluss" as const },
    arm: { points: resample(inner, 1.2), width: armW, kind: "fluss" as const },
    island: m.base(s0),
    islandHalf: { length: li * 0.75, width: wi - (width + armW) / 4 - RIVER_BANK - 0.6, n: m.n },
  };
}

/** Unregelmässiger Umriss eines Sees (Mitte, Radius, Wellen). */
function lakeOutline(r: () => number, c: Pt, rad: number, n = 48) {
  const p1 = r() * TAU;
  const p2 = r() * TAU;
  const p3 = r() * TAU;
  const outline: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n;
    const rr =
      rad *
      (1 +
        0.1 * Math.sin(a * 3 + p1) +
        0.05 * Math.sin(a * 5 + p2) +
        0.025 * Math.sin(a * 11 + p3));
    outline.push({ x: c.x + Math.cos(a) * rr, z: c.z + Math.sin(a) * rr });
  }
  return { x: c.x, z: c.z, r: rad * 1.16, outline };
}

/** Catmull-Rom-Kurve durch die Punkte (Stützpunkte im Abstand `step`). */
function spline(ctrl: Pt[], step: number): Pt[] {
  const p = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(c.x - b.x, c.z - b.z) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (u: number, v: number, w: number, x: number) =>
        0.5 *
        (2 * v + (-u + w) * t + (2 * u - 5 * v + 4 * w - x) * t2 + (-u + 3 * v - 3 * w + x) * t3);
      out.push({ x: f(a.x, b.x, c.x, d.x), z: f(a.z, b.z, c.z, d.z) });
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

/** Zufluss in einen See: aus den Hügeln, im Bogen an der Dorfmitte vorbei bis ins Wasser. */
function inflow(r: () => number, lake: NonNullable<WorldMap["lake"]>, rFlat: number): River {
  const width = range(r, 2.2, 3.0);
  const c = Math.atan2(lake.z, lake.x);
  const sign = r() < 0.5 ? 1 : -1;
  const start = polar(c + sign * range(r, 1.7, 2.3), rFlat + 140);
  const mid = polar(c + sign * range(r, 0.7, 1.0), range(r, 38, 48));
  const pts = spline([start, mid, { x: lake.x, z: lake.z }], 1.0);
  const minD = minWaterDist(width);
  const kept: Pt[] = [];
  for (const p of pts) {
    const d = Math.hypot(p.x, p.z);
    const q = d < minD ? { x: (p.x / d) * minD, z: (p.z / d) * minD } : p;
    kept.push(q);
    if (pointInPolygon(q.x, q.z, lake.outline)) break;
  }
  return { points: resample(kept, 1.2), width, kind: "bach" };
}

/** Sandbänke an den Innenseiten starker Biegungen des Hauptflusses (nur Darstellung). */
function sandbanks(river: River, r: () => number): Pt[][] {
  const pts = river.points;
  const out: Pt[][] = [];
  let last = -999;
  for (let i = 8; i < pts.length - 8 && out.length < 4; i++) {
    const a = pts[i - 6];
    const b = pts[i];
    const c = pts[i + 6];
    const h1 = Math.atan2(b.z - a.z, b.x - a.x);
    const h2 = Math.atan2(c.z - b.z, c.x - b.x);
    const turn = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1));
    if (Math.abs(turn) < 0.32 || i - last < 20 || Math.hypot(b.x, b.z) > 115) continue;
    last = i;
    // Innenseite: Richtung der Drehung
    const nx = -Math.sin(h1) * Math.sign(turn);
    const nz = Math.cos(h1) * Math.sign(turn);
    // An die Innenseite angelehnt (berührt das Ufer), schmal und flach
    const len = range(r, 2.2, 3.8);
    const wid = river.width * range(r, 0.1, 0.14);
    const cx = b.x + nx * (river.width / 2 - wid * 0.8);
    const cz = b.z + nz * (river.width / 2 - wid * 0.8);
    const poly: Pt[] = [];
    for (let k = 0; k < 14; k++) {
      const u = (TAU * k) / 14;
      const lx = Math.cos(u) * len;
      const lz = Math.sin(u) * wid * (1 - 0.35 * Math.cos(u));
      poly.push({
        x: cx + Math.cos(h1) * lx + nx * lz,
        z: cz + Math.sin(h1) * lx + nz * lz,
      });
    }
    out.push(poly);
  }
  return out;
}

// ---------- Seed-Objekte ----------

type Pool = { key: SeedObjektTyp | "teich" | "weide" | "windmuehle" | "obstgarten"; w: number };

const shapeOf = seedObjektShape;

const farFromAxes = (s: Shape, axes: Pt[][], band = LANE_BAND) => {
  const reach = s.kind === "circle" ? s.r : Math.hypot(s.hw, s.hd);
  return axes.every((ax) => distPointPolyline(s.x, s.z, ax) - reach >= band);
};

/** Objekt am Ufer eines Wasserlaufs: Rückseite trocken, Front über dem Wasser. */
function placeUfer(
  r: () => number,
  map: WorldMap,
  river: River,
  typ: SeedObjektTyp,
  taken: Shape[],
  axes: Pt[][],
): SeedObjekt | null {
  const f = SEED_OBJEKT[typ].form as { hw: number; hd: number };
  const pts = river.points;
  const start = Math.floor(r() * pts.length);
  for (let k = 0; k < pts.length; k++) {
    const i = (start + k * 17) % pts.length;
    if (i < 4 || i > pts.length - 5) continue;
    const p = pts[i];
    const rad = Math.hypot(p.x, p.z);
    if (rad < 28 || rad > map.rBuild - 6) continue;
    const a = pts[i - 3];
    const b = pts[i + 3];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
    for (const side of r() < 0.5 ? [1, -1] : [-1, 1]) {
      const nx = n.x * side;
      const nz = n.z * side;
      const dist = river.width / 2 + 0.35;
      const o: SeedObjekt = {
        typ,
        x: p.x + nx * dist,
        z: p.z + nz * dist,
        angle: Math.atan2(-nx, -nz),
      };
      const s = shapeOf(o);
      const back = toWorld(o.x, o.z, o.angle, 0, -f.hd + 0.4);
      const front = toWorld(o.x, o.z, o.angle, 0, f.hd - 0.4);
      if (waterEdgeDist(map, back.x, back.z) < 0.6) continue;
      if (waterEdgeDist(map, front.x, front.z) > -0.3) continue;
      if (!farFromAxes(s, axes)) continue;
      if (taken.some((t) => overlaps(s, t, 2))) continue;
      return o;
    }
  }
  return null;
}

/** Objekt quer über einen Fluss (Fähre, Wehr) an einer geraden Stelle. */
function placeQuer(
  r: () => number,
  map: WorldMap,
  river: River,
  typ: SeedObjektTyp,
  taken: Shape[],
  axes: Pt[][],
): SeedObjekt | null {
  const pts = river.points;
  const start = Math.floor(r() * pts.length);
  const hd = spanFor(river.width);
  for (let k = 0; k < pts.length; k++) {
    const i = (start + k * 13) % pts.length;
    if (i < 8 || i > pts.length - 9) continue;
    const p = pts[i];
    const rad = Math.hypot(p.x, p.z);
    if (rad < 30 || rad > map.rBuild - hd) continue;
    const a = pts[i - 6];
    const b = pts[i + 6];
    const c0 = Math.atan2(p.z - a.z, p.x - a.x);
    const c1 = Math.atan2(b.z - p.z, b.x - p.x);
    if (Math.abs(Math.atan2(Math.sin(c1 - c0), Math.cos(c1 - c0))) > 0.2) continue;
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
    const o: SeedObjekt = {
      typ,
      x: p.x,
      z: p.z,
      angle: Math.atan2(n.x, n.z),
      hd,
      water: river.width,
    };
    const s = shapeOf(o);
    const e1 = toWorld(o.x, o.z, o.angle, 0, hd - 1.0);
    const e2 = toWorld(o.x, o.z, o.angle, 0, -hd + 1.0);
    if (waterEdgeDist(map, e1.x, e1.z) < 0.4 || waterEdgeDist(map, e2.x, e2.z) < 0.4) continue;
    if (!farFromAxes(s, axes)) continue;
    if (taken.some((t) => overlaps(s, t, 2))) continue;
    return o;
  }
  return null;
}

/** Objekt auf der Wiese nahe am Wasser (Picknickplatz). */
function placeNearWater(
  r: () => number,
  map: WorldMap,
  typ: SeedObjektTyp,
  taken: Shape[],
  axes: Pt[][],
): SeedObjekt | null {
  const rad = (SEED_OBJEKT[typ].form as { r: number }).r;
  const shores: Pt[][] = [
    ...riversOf(map).map((x) => x.points),
    ...(map.lake ? [map.lake.outline] : []),
  ];
  for (const line of shores) {
    const start = Math.floor(r() * line.length);
    for (let k = 0; k < line.length; k += 2) {
      const i = (start + k * 11) % line.length;
      const p = line[i];
      if (Math.hypot(p.x, p.z) < 26 || Math.hypot(p.x, p.z) > map.rBuild - 6) continue;
      for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const q = { x: p.x + Math.cos(ang) * (rad + 4.5), z: p.z + Math.sin(ang) * (rad + 4.5) };
        const w = waterEdgeDist(map, q.x, q.z);
        if (w < rad + 1.5 || w > rad + 5) continue;
        const o: SeedObjekt = { typ, x: q.x, z: q.z, angle: Math.atan2(p.x - q.x, p.z - q.z) };
        const s = shapeOf(o);
        if (waterHits(map, s, 0.4)) continue;
        if (!farFromAxes(s, axes)) continue;
        if (taken.some((t) => overlaps(s, t, 2))) continue;
        return o;
      }
    }
  }
  return null;
}

// ---------- Karte ----------

export function generateMapV2(seed: string): WorldMap {
  const r = rng(seed, "karte-v2");
  const landschaft = pickWeighted<Landschaft>(r, LANDSCHAFTEN_V2);
  const stimmung = pickWeighted<Stimmung>(r, [
    ["sommer", 3],
    ["fruehling", 2],
    ["herbst", 2],
    ["alpin", 2],
  ]);
  const params: MapParams = {
    forest: range(r, 0.6, 1.5),
    rocks: r(),
    density: r(),
    tint: range(r, -1, 1),
  };
  const rFlat =
    landschaft === "hochplateau"
      ? range(r, 94, 102)
      : landschaft === "huegelland"
        ? range(r, 98, 106)
        : range(r, 104, 116);
  const plaza = {
    a: range(r, 11.4, 12.4),
    n: pickWeighted(r, [
      [9, 3],
      [18, 2],
    ] as const),
    rot: r() * TAU,
  };
  const hills = {
    amp:
      landschaft === "hochplateau"
        ? range(r, 6, 9)
        : landschaft === "huegelland"
          ? range(r, 4.5, 7.5)
          : range(r, 2, 6),
    f1: range(r, 0.06, 0.12),
    f2: range(r, 0.14, 0.24),
    p1: r() * TAU,
    p2: r() * TAU,
    ramp: landschaft === "hochplateau" ? range(r, 7, 10) : range(r, 14, 24),
  };

  const map: WorldMap = {
    seed,
    landschaft,
    stimmung,
    palette: tintPalette(PALETTES[stimmung], params.tint, rng(seed, "farbe-v2")),
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
    hills,
    version: 2,
    streams: [],
    objects: [],
    rocks: [],
    sandbanks: [],
    waterfall: null,
    params,
  };

  // 1. Wasser nach Landschaft
  let island: ReturnType<typeof forkRiver> | null = null;
  if (landschaft === "flussdorf") {
    map.river = meanderRiver(
      r,
      range(r, 40, 52),
      range(r, 4.6, 7.0),
      rFlat,
      "fluss",
      [2.5, 6],
      [60, 100],
    ).river;
  } else if (landschaft === "flussgabel") {
    island = forkRiver(r, rFlat);
    map.river = island.river;
    map.streams!.push(island.arm);
  } else if (landschaft === "bachtal") {
    map.river = meanderRiver(
      r,
      range(r, 34, 46),
      range(r, 2.6, 3.4),
      rFlat,
      "bach",
      [3, 6],
      [40, 70],
    ).river;
  } else if (landschaft === "hochplateau") {
    map.river = meanderRiver(
      r,
      range(r, 36, 46),
      range(r, 2.2, 2.8),
      rFlat,
      "bach",
      [2, 5],
      [35, 60],
    ).river;
  } else if (landschaft === "bergsee") {
    const c = r() * TAU;
    map.lake = lakeOutline(r, polar(c, range(r, 64, 76)), range(r, 13, 18));
    map.streams!.push(inflow(r, map.lake, rFlat));
  } else if (landschaft === "bucht") {
    const c = r() * TAU;
    const rad = range(r, 46, 58);
    const dist = Math.max(range(r, 112, 124), 56 + rad * 1.14);
    map.lake = lakeOutline(r, polar(c, dist), rad, 96);
    if (r() < 0.5) map.streams!.push(inflow(r, map.lake, rFlat));
  } else if (landschaft === "huegelland" && r() < 0.4) {
    map.river = meanderRiver(
      r,
      range(r, 44, 60),
      range(r, 2.2, 2.8),
      rFlat,
      "bach",
      [2, 6],
      [35, 60],
    ).river;
  }
  if (map.river?.kind === "fluss") map.sandbanks = sandbanks(map.river, r);

  // Achsen aller Gassen (wie die Siedlung): Merkmale liegen in den Lücken dazwischen
  const axes = laneAxesOf(seed, map).map((a) => a.axis.filter((_, i) => i % 4 === 0));

  // 2. Wanderweg mit Brücke und Aussichtsbank über den Hauptwasserlauf (in einer Lücke zwischen zwei Gassen)
  const trailRiver = map.river ?? map.streams![0] ?? null;
  if (trailRiver) {
    const pts = trailRiver.points;
    const cands = pts
      .map((p, i) => ({
        p,
        i,
        d: Math.hypot(p.x, p.z),
        gap: Math.min(...axes.map((ax) => distPointPolyline(p.x, p.z, ax))),
      }))
      .filter(
        (c) =>
          c.i > 6 &&
          c.i < pts.length - 7 &&
          c.d < rFlat - 8 &&
          c.gap > LANE_BAND + 6 &&
          riversOf(map).every(
            (x) => x === trailRiver || distPointPolyline(c.p.x, c.p.z, x.points) > 14,
          ),
      );
    if (cands.length) {
      const c = cands.sort((a, b) => b.gap - a.gap)[0];
      const a = pts[c.i - 2];
      const b = pts[c.i + 2];
      const flow = Math.atan2(b.x - a.x, b.z - a.z);
      const ax = Math.cos(flow);
      const az = -Math.sin(flow);
      const toCenter = -(c.p.x * ax + c.p.z * az) > 0 ? 1 : -1;
      const ix = ax * toCenter;
      const iz = az * toCenter;
      const span = trailRiver.width + 3.2;
      map.bridge = {
        x: c.p.x,
        z: c.p.z,
        angle: Math.atan2(ix, iz),
        span,
        style: trailRiver.width >= 4.5 ? "stein" : "holz",
      };
      const inner = { x: c.p.x + ix * (span / 2 + 5.5), z: c.p.z + iz * (span / 2 + 5.5) };
      const outer = { x: c.p.x - ix * (span / 2 + 16), z: c.p.z - iz * (span / 2 + 16) };
      map.trail = resample([inner, { x: c.p.x, z: c.p.z }, outer], 0.5);
      map.viewBench = { x: inner.x + ix * 1.6, z: inner.z + iz * 1.6, angle: Math.atan2(-ix, -iz) };
    }
  }

  const taken: Shape[] = [];
  if (map.trail) for (const p of map.trail) taken.push(circle(p.x, p.z, 2));
  if (map.viewBench) taken.push(circle(map.viewBench.x, map.viewBench.z, 2));
  for (const b of map.bridge ? [map.bridge] : []) taken.push(circle(b.x, b.z, b.span / 2 + 3));

  // 3. Insel der Flussgabel: ein Objekt darauf, falls keine Gasse darüber führt
  const objects: SeedObjekt[] = [];
  if (island && island.islandHalf.width > 2.2) {
    const c = island.island;
    for (const typ of ["schaukelbaum", "ruine", "findlinge", "kapelle"] as SeedObjektTyp[]) {
      const f = SEED_OBJEKT[typ].form;
      const fits =
        f.kind === "circle" ? f.r <= island.islandHalf.width : f.hw <= island.islandHalf.width;
      if (!fits) continue;
      const o: SeedObjekt = { typ, x: c.x, z: c.z, angle: Math.atan2(-c.x, -c.z) };
      const s = shapeOf(o);
      if (waterHits(map, s, 0.3) || !farFromAxes(s, axes)) continue;
      objects.push(o);
      taken.push(s);
      break;
    }
  }

  // 4. Auswahl: Merkmale aus v1 (Teich, Weide, Mühle, Obstgarten) und Seed-Objekte, gewichtet ohne Zurücklegen
  const hasRiver = riversOf(map).length > 0;
  const widest = Math.max(0, ...riversOf(map).map((x) => x.width));
  const pool: Pool[] = [
    { key: "weide", w: 3 },
    { key: "obstgarten", w: 2 },
    { key: "windmuehle", w: hasRiver ? 1 : 2.5 },
    ...(map.lake ? [] : [{ key: "teich" as const, w: landschaft === "huegelland" ? 3.5 : 1.5 }]),
    ...(Object.keys(SEED_OBJEKT) as SeedObjektTyp[])
      .filter((typ) => {
        const e = SEED_OBJEKT[typ];
        if (e.lage === "quer" || e.lage === "ufer") return hasRiver && widest >= (e.minBreite ?? 0);
        if (e.lage === "wassernah") return hasRiver || !!map.lake;
        return true;
      })
      .filter((typ) => !objects.some((o) => o.typ === typ))
      .map((typ) => ({ key: typ, w: SEED_OBJEKT[typ].gewicht })),
  ];
  const want = 4 + Math.round(params.density * 4);
  let placed = 0;
  const pr = rng(seed, "objekte-v2");
  while (pool.length && placed < want) {
    const choice = pickWeighted(
      pr,
      pool.map((p) => [p, p.w] as const),
    );
    pool.splice(pool.indexOf(choice), 1);
    if (placeChoice(choice.key)) placed++;
  }

  function placeChoice(key: Pool["key"]): boolean {
    if (key === "teich") {
      const spot = placeOnRing(pr, map, taken, axes, [44, 64], (x, z) => circle(x, z, 4.4));
      if (!spot) return false;
      map.pond = circle(spot.x, spot.z, range(pr, 3.2, 4.2));
      taken.push(circle(spot.x, spot.z, map.pond.r + 1.5));
      return true;
    }
    if (key === "weide") {
      const w = range(pr, 9, 12);
      const d = range(pr, 6, 8);
      const spot = placeOnRing(pr, map, taken, axes, [50, 72], (x, z, a) =>
        box(x, z, w / 2 + 1, d / 2 + 1, a + Math.PI / 2),
      );
      if (!spot) return false;
      map.pasture = { x: spot.x, z: spot.z, w, d, angle: spot.angle + Math.PI / 2 };
      taken.push(box(spot.x, spot.z, w / 2 + 1, d / 2 + 1, spot.angle + Math.PI / 2));
      return true;
    }
    if (key === "windmuehle") {
      const spot = placeOnRing(pr, map, taken, axes, [44, 66], (x, z) => circle(x, z, 3.6));
      if (!spot) return false;
      map.windmill = spot;
      taken.push(circle(spot.x, spot.z, 3.6));
      return true;
    }
    if (key === "obstgarten") {
      const w = range(pr, 10, 13);
      const d = range(pr, 7, 9);
      const spot = placeOnRing(pr, map, taken, axes, [52, 74], (x, z, a) =>
        box(x, z, w / 2, d / 2, a + Math.PI / 2),
      );
      if (!spot) return false;
      map.orchard = { x: spot.x, z: spot.z, w, d, angle: spot.angle + Math.PI / 2 };
      taken.push(box(spot.x, spot.z, w / 2, d / 2, spot.angle + Math.PI / 2));
      return true;
    }
    const e = SEED_OBJEKT[key];
    let o: SeedObjekt | null = null;
    const rivers = riversOf(map);
    if (e.lage === "ufer") {
      for (const river of rivers.filter((x) => x.width >= (e.minBreite ?? 0)))
        if (!o) o = placeUfer(pr, map, river, key, taken, axes);
    } else if (e.lage === "quer") {
      for (const river of rivers.filter((x) => x.width >= (e.minBreite ?? 0)))
        if (!o) o = placeQuer(pr, map, river, key, taken, axes);
    } else if (e.lage === "wassernah") {
      o = placeNearWater(pr, map, key, taken, axes);
    } else {
      const spot = placeOnRing(pr, map, taken, axes, [42, 76], (x, z, a) =>
        shapeOf({ typ: key, x, z, angle: a }),
      );
      if (spot) o = { typ: key, x: spot.x, z: spot.z, angle: spot.angle };
    }
    if (!o) return false;
    objects.push(o);
    taken.push(shapeOf(o));
    return true;
  }
  map.objects = objects;

  // 5. Felsen: am Rand der flachen Zone und auf den Hügeln (Hochplateau: Felskanten), Anzahl nach Felsanteil
  const rockCount = Math.round(
    (landschaft === "hochplateau" ? 14 : landschaft === "huegelland" ? 9 : 4) *
      (0.35 + params.rocks),
  );
  const rr = rng(seed, "felsen-v2");
  const rocks: Rock[] = [];
  for (let i = 0; i < rockCount * 8 && rocks.length < rockCount; i++) {
    const rad = range(rr, 1.4, 3.6);
    const p = polar(rr() * TAU, range(rr, rFlat - 12, rFlat + 26));
    const s = circle(p.x, p.z, rad);
    if (waterHits(map, s, 1)) continue;
    if (taken.some((t) => overlaps(s, t, 1.5))) continue;
    if (rocks.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r + rad + 2)) continue;
    if (Math.hypot(p.x, p.z) - rad < rFlat && !farFromAxes(s, axes, LANE_BAND - 2)) continue;
    rocks.push({ x: p.x, z: p.z, r: rad, h: range(rr, 0.8, 1.6) * rad });
    taken.push(s);
  }
  map.rocks = rocks;
  return map;
}

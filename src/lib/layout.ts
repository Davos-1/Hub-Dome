/**
 * Deterministisches Dorf-Layout: Zentrale mit Hauptplatz in der Mitte, rundherum «Quartiere»
 * (ein Quartier pro Fachbereich) mit je einem Nebenplatz, um den die Häuser stehen.
 * Gleiche Daten ergeben immer dasselbe Dorf – keine Zufallswerte, kein Date.now().
 */

import { FACH_ORDER, FACHBEREICHE, type FachbereichId } from "./fachbereiche";
import { computePaths, type VillagePath } from "./paths";
import { ARTIFACT_KINDS, type ArtifactKind } from "./types";

export type LayoutItem = { id: string; kind: ArtifactKind };
export type LayoutHouse = {
  id: string;
  kind: "zentrale" | "modul" | "thema";
  fach: FachbereichId;
  /** Objekte des Hauses (bestimmen Grösse und Grundstück). */
  items: LayoutItem[];
};

export type Tier = 1 | 2 | 3;

/** Platz eines Objekts im Grundstück (lokal: +z = zum Gartentor). */
export type PlotSlot = LayoutItem & {
  side: -1 | 1;
  row: number;
  col: number;
  x: number;
  z: number;
};
export type Plot = { hw: number; front: number; back: number; slots: PlotSlot[] };

export type HouseLayout = {
  id: string;
  x: number;
  z: number;
  /** Drehung um Y, sodass die lokale +z-Achse (Hausfront) zum Nebenplatz zeigt. */
  angle: number;
  tier: Tier;
  /** Halbe Grundrissbreite des Hauses. */
  footprint: number;
  /** Grundstück samt Objekt-Plätzen; die Zentrale hat keines. */
  plot: Plot | null;
  /** Nur Zentrale: Objekt-Plätze im Ring um die Zentrale (lokal zur Zentrale, auf der Terrasse). */
  ring: PlotSlot[] | null;
  quarterId: FachbereichId | null;
  /** Winkel der Vieleckseite am Nebenplatz, an der der Hausweg beginnt. */
  side: number;
};

export type QuarterLayout = {
  id: FachbereichId;
  name: string;
  /** Index in der Farbpalette der Quartiere. */
  index: number;
  x: number;
  z: number;
  /** Richtung vom Dorfmittelpunkt zum Quartier. */
  theta: number;
  /** Apothem des Nebenplatzes. */
  rp: number;
  /** Radius der Quartiersinsel. */
  radius: number;
  houseIds: string[];
  /** Winkel der Seite am Hauptplatz, an der der Hauptweg beginnt. */
  mainSide: number;
  /** Winkel der Seite am Nebenplatz, an der der Hauptweg ankommt. */
  entrySide: number;
};

/** Vieleck-Platz: `a` = Apothem, `rot` = Drehung, `used` = Winkel der Seiten mit Wegeinmündung. */
export type PlazaPoly = {
  x: number;
  z: number;
  a: number;
  n: number;
  rot: number;
  used: number[];
  gap: number;
  main: boolean;
  quarterId: FachbereichId | null;
};

export type VillageLayout = {
  houses: Record<string, HouseLayout>;
  quarters: QuarterLayout[];
  polys: PlazaPoly[];
  paths: VillagePath[];
  /** Apothem des Hauptplatzes. */
  plazaRadius: number;
  /** Apothem der oberen Terrassenstufe unter der Zentrale (wächst mit dem Objekt-Ring). */
  terrace: number;
  /** Radius des Dorfs samt Rand (für Kamera, Gelände, Natur). */
  extent: number;
};

/** Hausgrösse wächst mit der Anzahl Objekte: 0–2 klein, 3–6 mittel, 7+ gross. */
export function houseTier(artifactCount: number): Tier {
  if (artifactCount >= 7) return 3;
  if (artifactCount >= 3) return 2;
  return 1;
}

export const TIER_FOOTPRINT: Record<Tier, number> = { 1: 1.1, 2: 1.25, 3: 1.4 };
export const ZENTRALE_FOOTPRINT = 2.3;
/** Kleinster Apothem des Hauptplatzes. */
export const PLAZA_MIN = 9.4;
/** Terrasse ohne Objekte; erster Objekt-Ring der Zentrale und Abstand zwischen den Ringen. */
export const TERRACE_MIN = 4.95;
export const ZENTRALE_RING_R = 6.2;
const RING_STEP = 1.3;
/** Vorne (+z) bleibt ein Bogen frei für Figur und Treppe. */
const RING_FRONT_GAP = 0.6;
/** Breite der Hauptwege und der Hauswege. */
export const MAIN_PATH_WIDTH = 1.9;
export const HOUSE_PATH_WIDTH = 1.5;
/** Farben der Quartiere (Weg, Kante, Platz). */
export const QUARTER_COLORS = [
  { main: "#d3c9b0", edge: "#a99f86", plaza: "#c6bca2" },
  { main: "#d6c0b8", edge: "#ad968d", plaza: "#c9b1a8" },
  { main: "#c2cdc6", edge: "#97a59c", plaza: "#b4c0b8" },
  { main: "#d9c7a0", edge: "#b29f78", plaza: "#cdbb93" },
  { main: "#c4cad0", edge: "#9aa2aa", plaza: "#b7bec5" },
  { main: "#d9b8a3", edge: "#b0907b", plaza: "#cba995" },
  { main: "#cad2b2", edge: "#a2ab88", plaza: "#bcc5a3" },
];

const TAU = Math.PI * 2;
const round = (n: number) => Math.round(n * 1000) / 1000;
const normA = (a: number) => ((a % TAU) + TAU) % TAU;
const angDiff = (a: number, b: number) => {
  const d = Math.abs(normA(a) - normA(b));
  return Math.min(d, TAU - d);
};
export const polar = (a: number, r: number) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });

/**
 * Grundstück eines Hauses: Objekte nach Kategorie sortiert, links und rechts des Gartenwegs in
 * Reihen (1/2/3 Spalten je Seite). Die Mitte bleibt für den Weg frei.
 */
export function plotFor(fp: number, tier: Tier, items: LayoutItem[]): Plot {
  const n = items.length;
  const cols = n <= 2 ? 1 : n <= 4 ? 2 : 3;
  const left = Math.ceil(n / 2);
  const rows = Math.ceil(left / cols) || 0;
  const sorted = items
    .slice()
    .sort((a, b) => ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind));
  const slots: PlotSlot[] = sorted.map((item, i) => {
    const side: -1 | 1 = i < left ? -1 : 1;
    const j = i < left ? i : i - left;
    const row = Math.floor(j / cols);
    const col = j % cols;
    return {
      ...item,
      side,
      row,
      col,
      x: side * (1.25 + col * 1.2),
      z: fp * 1.05 + 1.05 + row * 1.2,
    };
  });
  const houseHalf = tier === 3 ? fp * 2.15 : fp * 1.05;
  const hw = Math.max(houseHalf + 0.9, n ? 1.25 + (cols - 1) * 1.2 + 0.85 : 0, 2.3);
  const front = Math.max(fp * 1.05 + 1.8, n ? fp * 1.05 + 1.05 + (rows - 1) * 1.2 + 0.95 : 0);
  return { hw, front, back: fp * 1.05 + 1.1, slots };
}

/**
 * Objekt-Plätze der Zentrale: nach Kategorie sortiert im Kreis um die Zentrale, beginnend hinten,
 * vorne bleibt ein Bogen frei. Volle Ringe werden durch einen weiteren, grösseren ergänzt.
 */
export function zentraleRing(items: LayoutItem[]): PlotSlot[] {
  const sorted = items
    .slice()
    .sort((a, b) => ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind));
  const out: PlotSlot[] = [];
  let i = 0;
  for (let row = 0; i < sorted.length; row++) {
    const r = ZENTRALE_RING_R + row * RING_STEP;
    const arc = TAU - 2 * RING_FRONT_GAP;
    const cap = Math.max(1, Math.floor((arc * r) / 1.3));
    const n = Math.min(cap, sorted.length - i);
    for (let col = 0; col < n; col++, i++) {
      // gleichmässig im Bogen verteilt, zentriert um die Rückseite (−z)
      const a = -Math.PI / 2 + (col - (n - 1) / 2) * (arc / Math.max(n, Math.min(cap, 8)));
      out.push({
        ...sorted[i],
        side: 1,
        row,
        col,
        x: round(Math.cos(a) * r),
        z: round(Math.sin(a) * r),
      });
    }
  }
  return out;
}

/** Aussenradius des Objekt-Rings (0 ohne Objekte). */
export function ringOuter(ring: PlotSlot[] | null): number {
  if (!ring || ring.length === 0) return 0;
  return ZENTRALE_RING_R + Math.max(...ring.map((s) => s.row)) * RING_STEP;
}

type Pt = { x: number; z: number };

/** Ecken eines Grundstücks in Weltkoordinaten. */
export function plotCorners(x: number, z: number, ang: number, p: Plot): Pt[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return (
    [
      [-p.hw, -p.back],
      [p.hw, -p.back],
      [p.hw, p.front],
      [-p.hw, p.front],
    ] as const
  ).map(([lx, lz]) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c }));
}

/** Überlappen sich zwei konvexe Vierecke (mit Sicherheitsabstand `m`)? Separating-Axis-Test. */
export function satOverlap(A: Pt[], B: Pt[], m = 0.4): boolean {
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % 4];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      const nx = -(b.z - a.z) / l;
      const nz = (b.x - a.x) / l;
      const pa = A.map((p) => p.x * nx + p.z * nz);
      const pb = B.map((p) => p.x * nx + p.z * nz);
      if (Math.max(...pa) + m < Math.min(...pb) || Math.max(...pb) + m < Math.min(...pa)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Vieleck: jeder Weg bekommt eine eigene Seite. Die Drehung wird so gewählt, dass die Summe der
 * quadrierten Winkelabweichungen minimal ist. `asg[i]` = Seitenwinkel für den Weg i.
 */
export function polyAssign(angles: number[], n: number): { rot: number; asg: number[] } {
  const order = angles.map((a, i) => ({ a: normA(a), i })).sort((p, q) => p.a - q.a);
  let best: { rot: number; asg: number[]; cost: number } | null = null;
  for (const cand of order) {
    const used = new Set<number>();
    const asg: number[] = [];
    let cost = 0;
    for (const o of order) {
      let bk = -1;
      let bd = Infinity;
      for (let k = 0; k < n; k++) {
        if (used.has(k)) continue;
        const d = angDiff(o.a, cand.a + (TAU * k) / n);
        if (d < bd) {
          bd = d;
          bk = k;
        }
      }
      used.add(bk);
      asg[o.i] = cand.a + (TAU * bk) / n;
      cost += bd * bd;
    }
    if (!best || cost < best.cost) best = { rot: cand.a, asg, cost };
  }
  return best ?? { rot: 0, asg: [] };
}

type Info = { h: LayoutHouse; tier: Tier; fp: number; plot: Plot };
type Group = {
  id: FachbereichId;
  index: number;
  info: Info[];
  rp: number;
  radius: number;
  pos: { info: Info; lx: number; lz: number }[];
  cx: number;
  cz: number;
};

/** Häuser rund um den Nebenplatz (lokal: +x zeigt von der Zentrale weg); Slot 0 bleibt frei. */
function arrangeQuarter(info: Info[], rp: number) {
  const m = info.length;
  const hw = Math.max(...info.map((x) => x.plot.hw));
  const f = Math.max(...info.map((x) => x.plot.front));
  const D = TAU / (m + 1);
  const R = Math.max(rp + f + 2.4, f + (2 * hw + 1.6) / (2 * Math.sin(D / 2)));
  const pos = info.map((inf, i) => {
    const phi = Math.PI + (i + 1) * D;
    return { info: inf, lx: Math.cos(phi) * R, lz: Math.sin(phi) * R };
  });
  const radius = Math.max(
    rp + 1,
    ...pos.map((p) => Math.hypot(Math.hypot(p.lx, p.lz) + p.info.plot.back, p.info.plot.hw) + 0.8),
  );
  return { pos, radius };
}

function distSeg(px: number, pz: number, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2)) : 0;
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

export function computeLayout(houses: LayoutHouse[]): VillageLayout {
  const result: Record<string, HouseLayout> = {};
  const zentrale = houses.find((h) => h.kind === "zentrale");
  if (zentrale) {
    result[zentrale.id] = {
      id: zentrale.id,
      x: 0,
      z: 0,
      angle: 0,
      tier: 3,
      footprint: ZENTRALE_FOOTPRINT,
      plot: null,
      ring: zentrale.items.length ? zentraleRing(zentrale.items) : null,
      quarterId: null,
      side: 0,
    };
  }
  const others = houses.filter((h) => h.kind !== "zentrale");

  // Gruppen nach Fachbereich in fester Reihenfolge
  const groups: Group[] = [];
  for (const id of FACH_ORDER) {
    const mine = others.filter((h) => h.fach === id);
    if (mine.length === 0) continue;
    const info = mine.map((h) => {
      const tier = houseTier(h.items.length);
      const fp = TIER_FOOTPRINT[tier];
      return { h, tier, fp, plot: plotFor(fp, tier, h.items) };
    });
    const rp = Math.max(2.6, 1.3 / Math.tan(Math.PI / Math.max(5, info.length + 1)));
    const { pos, radius } = arrangeQuarter(info, rp);
    groups.push({ id, index: groups.length, info, rp, radius, pos, cx: 0, cz: 0 });
  }

  const ringR = zentrale ? ringOuter(result[zentrale.id].ring) : 0;
  const k = groups.length;
  const polyN = Math.max(5, k);
  // Hauptplatz: genug Platz für den Weg jedes Quartiers und für alle Häuser
  const plaza = Math.max(
    PLAZA_MIN,
    round((others.length * 1.95) / TAU),
    round(3.2 / Math.tan(Math.PI / polyN)),
    // Objekt-Ring der Zentrale samt Terrasse, Brunnen und Bänken
    ringR ? round(ringR + 5.2) : 0,
  );
  const terrace = ringR ? round(ringR + 0.9) : TERRACE_MIN;

  // Kompakt: Winkelanteil pro Quartier ∝ Radius, Start vorne (+z)
  const minD = (g: Group) => plaza + g.rp + 4 + g.radius * 0.45;
  const total = groups.reduce((s, g) => s + g.radius, 0);
  let cum = 0;
  const centers = groups.map((g) => {
    const th = Math.PI / 2 + (TAU * (cum + g.radius / 2)) / total;
    cum += g.radius;
    return polar(th, minD(g));
  });
  groups.forEach((g, i) => {
    g.cx = centers[i].x;
    g.cz = centers[i].z;
  });

  // Überlappungen auflösen: Inseln auseinander, Mindestabstand halten, Hauptwege frei lassen
  for (let it = 0; it < 400; it++) {
    let moved = false;
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const A = groups[i];
        const B = groups[j];
        const d = Math.hypot(A.cx - B.cx, A.cz - B.cz);
        const need = A.radius + B.radius + 1.5;
        if (d < need) {
          const far = Math.hypot(A.cx, A.cz) > Math.hypot(B.cx, B.cz) ? A : B;
          const l = Math.hypot(far.cx, far.cz);
          far.cx += (far.cx / l) * (need - d + 0.05);
          far.cz += (far.cz / l) * (need - d + 0.05);
          moved = true;
        }
      }
    }
    for (const g of groups) {
      const l = Math.hypot(g.cx, g.cz);
      const mn = minD(g);
      if (l < mn - 1e-6) {
        g.cx *= mn / l;
        g.cz *= mn / l;
        moved = true;
      }
    }
    for (const A of groups) {
      for (const B of groups) {
        if (A === B || Math.hypot(A.cx, A.cz) >= Math.hypot(B.cx, B.cz)) continue;
        if (distSeg(A.cx, A.cz, { x: 0, z: 0 }, { x: B.cx, z: B.cz }) < A.radius + 1.2) {
          const sgn = B.cx * A.cz - B.cz * A.cx > 0 ? -1 : 1;
          const rot = 0.03 * sgn;
          const cs = Math.cos(rot);
          const sn = Math.sin(rot);
          const nx = B.cx * cs - B.cz * sn;
          const nz = B.cx * sn + B.cz * cs;
          B.cx = nx;
          B.cz = nz;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Häuser in Weltkoordinaten
  const quarters: QuarterLayout[] = [];
  const houseQuarter = new Map<string, QuarterLayout>();
  const phiOf = new Map<string, number>();
  for (const g of groups) {
    const th = Math.atan2(g.cz, g.cx);
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const q: QuarterLayout = {
      id: g.id,
      name: FACHBEREICHE[g.id].name,
      index: g.index,
      x: round(g.cx),
      z: round(g.cz),
      theta: th,
      rp: g.rp,
      radius: g.radius,
      houseIds: [],
      mainSide: 0,
      entrySide: 0,
    };
    quarters.push(q);
    for (const p of g.pos) {
      const x = round(g.cx + p.lx * cs - p.lz * sn);
      const z = round(g.cz + p.lx * sn + p.lz * cs);
      result[p.info.h.id] = {
        id: p.info.h.id,
        x,
        z,
        angle: round(Math.atan2(-(x - g.cx), -(z - g.cz))),
        tier: p.info.tier,
        footprint: p.info.fp,
        plot: p.info.plot,
        ring: null,
        quarterId: g.id,
        side: 0,
      };
      q.houseIds.push(p.info.h.id);
      houseQuarter.set(p.info.h.id, q);
      phiOf.set(p.info.h.id, Math.atan2(z - g.cz, x - g.cx));
    }
  }

  // Vielecke: am Hauptplatz ein Weg pro Quartier, am Nebenplatz ein Weg pro Haus plus Hauptweg
  const polys: PlazaPoly[] = [];
  const mainAssign = polyAssign(
    quarters.map((q) => q.theta),
    polyN,
  );
  quarters.forEach((q, i) => (q.mainSide = mainAssign.asg[i]));
  polys.push({
    x: 0,
    z: 0,
    a: plaza,
    n: polyN,
    rot: mainAssign.rot,
    used: mainAssign.asg,
    gap: 3.6,
    main: true,
    quarterId: null,
  });
  for (const q of quarters) {
    const dirs = [q.theta + Math.PI, ...q.houseIds.map((id) => phiOf.get(id)!)];
    const n = Math.max(5, q.houseIds.length + 1);
    const pa = polyAssign(dirs, n);
    q.entrySide = pa.asg[0];
    q.houseIds.forEach((id, i) => (result[id].side = pa.asg[i + 1]));
    polys.push({
      x: q.x,
      z: q.z,
      a: q.rp,
      n,
      rot: pa.rot,
      used: pa.asg,
      gap: 3.0,
      main: false,
      quarterId: q.id,
    });
  }

  const extent = Math.max(8, ...quarters.map((q) => Math.hypot(q.x, q.z) + q.radius)) + 6;
  const layout: VillageLayout = {
    houses: result,
    quarters,
    polys,
    paths: [],
    plazaRadius: plaza,
    terrace,
    extent: round(extent),
  };
  layout.paths = computePaths(layout);
  return layout;
}

/** Liegt der Punkt (x, z) im Grundstück eines Hauses (plus Abstand `m`)? */
export function isInPlot(layout: Pick<VillageLayout, "houses">, x: number, z: number, m: number) {
  for (const h of Object.values(layout.houses)) {
    if (!h.plot) continue;
    const dx = x - h.x;
    const dz = z - h.z;
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < h.plot.hw + m && lz > -h.plot.back - m && lz < h.plot.front + m) return true;
  }
  return false;
}

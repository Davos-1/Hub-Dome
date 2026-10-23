/**
 * Siedlung (Generator v1): Dorfplatz in der Mitte mit neun Ausgängen. Jedes Quartier (Fachbereich) bekommt
 * einen Ausgang, einen kleinen Quartierplatz mit Tafel (je ein Haus links und rechts) und dahinter eine
 * leicht gebogene Gasse, an der weitere Häuser abwechselnd links und rechts stehen.
 *
 * Regeln für Stabilität: Alle neun Gassen sind von Anfang an als Korridor reserviert (kein Haus verbaut je
 * einen künftigen Zuweg). Gesetzt wird in fester Reihenfolge: fixierte Häuser → eigene Deko → übrige Häuser
 * nach Erstelldatum. Jedes Element prüft sich nur gegen das, was schon steht. Ein neues Haus kommt zuletzt
 * und kann deshalb kein bestehendes verschieben.
 */

import { FACH_ORDER, FACHBEREICHE, type FachbereichId } from "../fachbereiche";
import { AXIS_STEP, DIRECTIONS, laneAxis, NODE_RP, type Axis } from "./axes";
import {
  box,
  circle,
  overlaps,
  polar,
  resample,
  shapePolylineDist,
  toWorld,
  type Box,
  type Pt,
} from "./geom";
import { rng } from "./seed";
import { inWater, riverCrossings } from "./map";
import type { ClaimKind, Space } from "./space";

/** Feste Grösse jedes Grundstücks: Haus der Stufe 3 samt Anbau und 12 Objekt-Plätze (lokal: +z = Tor). */
export const PLOT = { hw: 3.45, front: 5.9, back: 2.8 } as const;
export const NODE_N = 8;
export const MAIN_PATH_WIDTH = 1.9;
export const LANE_WIDTH = 1.7;
/** Abstand Wegrand → Gartentor. */
const GATE_GAP = 0.4;
/** Halbe Breite des reservierten Korridors jeder Gasse. */
const CORRIDOR_HW = LANE_WIDTH / 2 + 0.7;
const MARGIN_PLOT = 0.6;
/** Abstand zweier Häuser auf derselben Gassenseite (Grundstücksbreite plus Lücke). */
const LANE_SPACING = PLOT.hw * 2 + 1.4;
/** Halbe Breite der Toröffnung in der Hecke. */
export const GATE = 0.95;

export type SettlementHouse = {
  id: string;
  fach: FachbereichId;
  /** Reihenfolge (aufsteigend): ältere Häuser zuerst. */
  order: number;
};

/** Bauplatz: «p0»/«p1» am Quartierplatz (links/rechts), «g<j>» an der Gasse. */
export type SlotKey = `p${0 | 1}` | `g${number}`;
export type HousePin = { r: number; s: string };
export type SettlementPins = {
  /** Ausgänge pro Quartier (der erste trägt den Quartierplatz, weitere sind Erweiterungen). */
  quartiere?: Partial<Record<FachbereichId, number[]>>;
  haeuser?: Record<string, HousePin>;
};

export type Lane = Axis & {
  /** Ausgang 0…8 am Dorfplatz. */
  dir: number;
  quarterId: FachbereichId;
  /** Trägt diese Gasse den Quartierplatz (erste Gasse des Quartiers)? */
  primary: boolean;
  /** Belegte Bauplätze. */
  slots: Partial<Record<SlotKey, string>>;
  /** Bis hierhin ist die Gasse gebaut (Bogenlänge). */
  builtT: number;
  /** Abgewiesene Bauplätze mit Grund; sie bleiben abgewiesen (das Register wächst nur). */
  rejected: Map<SlotKey, string>;
};

export type SettlementNode = {
  id: string;
  quarterId: FachbereichId;
  dir: number;
  x: number;
  z: number;
  /** Richtung zum Dorfplatz (Normale der Eingangsseite). */
  entry: number;
};

export type SettlementPath = {
  id: string;
  kind: "haupt" | "gasse";
  ownerId: string;
  quarterIndex: number | null;
  points: Pt[];
  width: number;
  seed: number;
};

export type PlacedHouse = {
  id: string;
  quarterId: FachbereichId;
  dir: number;
  slot: SlotKey;
  x: number;
  z: number;
  /** Lokale +z-Achse (Front, Tor) zeigt zum Weg. */
  angle: number;
  pinned: boolean;
};

export type Settlement = {
  plaza: { a: number; n: number; rot: number };
  /** Brücken, wo Gassen den Fluss queren. */
  bridges: { x: number; z: number; angle: number; span: number }[];
  lanes: Lane[];
  nodes: SettlementNode[];
  houses: Record<string, PlacedHouse>;
  paths: SettlementPath[];
  /** Häuser ohne gültigen Bauplatz (bleiben über Liste und Suche erreichbar). */
  unplaced: string[];
  /** Ungültige Fixierungen (wurden automatisch neu gesetzt). */
  droppedPins: string[];
};

/** Index der Quartierfarbe (stabil pro Fachbereich). */
export const quarterIndex = (q: FachbereichId) => FACH_ORDER.indexOf(q);
export { DIRECTIONS, NODE_RP };
export const quarterName = (q: FachbereichId) => FACHBEREICHE[q].name;

/** Gedrehtes Rechteck aus dem lokalen Bereich [x0,x1]×[z0,z1] eines Objekts an (x, z, angle). */
function localBox(
  x: number,
  z: number,
  angle: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
): Box {
  const c = toWorld(x, z, angle, (x0 + x1) / 2, (z0 + z1) / 2);
  return box(c.x, c.z, (x1 - x0) / 2, (z1 - z0) / 2, angle);
}

/** Grundstück eines Hauses (Hecke, Garten, Schild) als Grundfläche. */
export function plotShape(x: number, z: number, angle: number): Box {
  return localBox(x, z, angle, -PLOT.hw, PLOT.hw, -PLOT.back, PLOT.front);
}

/** Punkt, Richtung und linke Normale bei Bogenlänge t. */
function at(lane: Axis, t: number) {
  const i = Math.max(0, Math.min(lane.axis.length - 2, Math.floor(t / AXIS_STEP)));
  const a = lane.axis[i];
  const b = lane.axis[i + 1];
  const f = Math.max(0, Math.min(1, (t - lane.acc[i]) / AXIS_STEP));
  const h = Math.atan2(b.z - a.z, b.x - a.x);
  return {
    x: a.x + (b.x - a.x) * f,
    z: a.z + (b.z - a.z) * f,
    h,
    nx: -Math.sin(h),
    nz: Math.cos(h),
  };
}

/** Teilstück der Achse zwischen t0 und t1. */
function slice(lane: Axis, t0: number, t1: number): Pt[] {
  const s = at(lane, t0);
  const out: Pt[] = [{ x: s.x, z: s.z }];
  for (let i = 0; i < lane.axis.length; i++)
    if (lane.acc[i] > t0 && lane.acc[i] < t1) out.push(lane.axis[i]);
  const e = at(lane, t1);
  out.push({ x: e.x, z: e.z });
  return out;
}

/** Lage eines Bauplatzes. Am Quartierplatz links/rechts, an der Gasse versetzt abwechselnd. */
export function slotPose(lane: Axis & { primary: boolean }, key: SlotKey) {
  let t: number;
  let side: 1 | -1;
  let off: number;
  if (key === "p0" || key === "p1") {
    t = lane.nodeT;
    side = key === "p0" ? 1 : -1;
    off = NODE_RP + 0.5;
  } else {
    const j = Number(key.slice(1));
    const t0 = lane.primary ? lane.nodeT + PLOT.hw * 2 + 1.0 : 6;
    t = t0 + Math.floor(j / 2) * LANE_SPACING + (j % 2) * (LANE_SPACING / 2);
    side = j % 2 === 0 ? 1 : -1;
    off = LANE_WIDTH / 2 + GATE_GAP;
  }
  const p = at(lane, t);
  const d = off + PLOT.front; // Hausmitte seitlich der Achse
  // Front (+z lokal) zeigt zur Achse: Richtung −side·n
  return {
    x: p.x + p.nx * side * d,
    z: p.z + p.nz * side * d,
    angle: Math.atan2(-side * p.nx, -side * p.nz),
    t,
  };
}

const laneId = (k: number) => `weg-gasse-${k}`;
const corridorId = (k: number) => `korridor-${k}`;
const nodeClaimId = (q: FachbereichId) => `quartierplatz-${q}`;

/** Sichtzone vor der Quartiertafel: der Bereich zwischen Dorfplatz und Quartierplatz bleibt frei. */
export function boardZone(n: Pick<SettlementNode, "x" | "z" | "entry">) {
  const c = polar(n.entry, NODE_RP + 2.4);
  return box(n.x + c.x, n.z + c.z, 2.8, 2.0, Math.atan2(Math.cos(n.entry), Math.sin(n.entry)));
}

/** Was die Sichtzone eines Schilds verdecken würde (Wege dürfen hindurch). */
const SIGHT_BLOCKERS: ReadonlySet<ClaimKind> = new Set([
  "grundstueck",
  "deko",
  "deko-hoch",
  "merkmal",
  "knoten",
]);
/** Was ein Grundstück blockiert (Frontzonen anderer Häuser nicht: dort liegt die Gasse). */
const PLOT_BLOCKERS: ReadonlySet<ClaimKind> = new Set([
  "platz",
  "knoten",
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
]);
const TALL: ReadonlySet<ClaimKind> = new Set(["deko-hoch"]);

/** Bereich vor der Hausfront (über Tor und Weg hinaus), in dem keine hohen Elemente stehen dürfen. */
export function frontZone(x: number, z: number, angle: number): Box {
  return localBox(x, z, angle, -PLOT.hw - 0.5, PLOT.hw + 0.5, PLOT.front, PLOT.front + 3.6);
}

type Ctx = {
  seed: string;
  space: Space;
  plaza: { a: number; n: number; rot: number };
  lanes: Map<number, Lane>;
  /** Achsen aller neun Ausgänge (auch unbenutzte). */
  axes: Axis[];
  nodes: SettlementNode[];
  houses: Record<string, PlacedHouse>;
  quarterDirs: Map<FachbereichId, number[]>;
  /** Ausgänge, die sich für ein Quartier (primär/Erweiterung) schon als unmöglich erwiesen haben. */
  failed: Set<string>;
  /** Freie Länge jeder Achse bis zum ersten Hindernis der Karte (Wasser ausser Fluss, Merkmal, Rand). */
  room: number[];
};

/** Reihenfolge der Bauplätze einer Gasse: zuerst am Quartierplatz (Seite per Seed), dann die Gasse hinaus. */
function slotKeys(seed: string, space: Space, lane: Lane): SlotKey[] {
  const out: SlotKey[] = [];
  if (lane.primary)
    out.push(
      ...((rng(seed, `platz-${lane.dir}`)() < 0.5 ? ["p0", "p1"] : ["p1", "p0"]) as SlotKey[]),
    );
  const tMax = lane.acc[lane.acc.length - 1] - PLOT.hw - 2;
  for (let j = 0; j < 60; j++) {
    const p = slotPose(lane, `g${j}`);
    if (p.t > tMax || Math.hypot(p.x, p.z) > space.map.rBuild) break;
    out.push(`g${j}`);
  }
  return out;
}

/** Ist der Bauplatz frei (Grundstück und nötige Verlängerung der Gasse)? Abweisungen werden gemerkt. */
function slotFree(space: Space, lane: Lane, key: SlotKey): boolean {
  if (lane.slots[key] || lane.rejected.has(key)) return false;
  const why = slotCheck(space, lane, key);
  if (why) lane.rejected.set(key, why);
  return !why;
}

/** Grund, warum der Bauplatz nicht geht, oder `null`. */
function slotCheck(space: Space, lane: Lane, key: SlotKey): string | null {
  if ((key === "p0" || key === "p1") && !lane.primary) return "kein Quartierplatz";
  const p = slotPose(lane, key);
  const plot = plotShape(p.x, p.z, p.angle);
  // Das Tor öffnet sich zur eigenen Gasse bzw. zum eigenen Quartierplatz
  const ignore = new Set([corridorId(lane.dir)]);
  if (key === "p0" || key === "p1") ignore.add(nodeClaimId(lane.quarterId));
  const c = space.conflict(plot, {
    margin: MARGIN_PLOT,
    pathClearance: 0.3,
    ignore,
    kinds: PLOT_BLOCKERS,
    asKind: "grundstueck",
  });
  if (c) return c.grund;
  // Auch die künftige eigene Gasse (in Kurven) hält Abstand zum Grundstück
  if (shapePolylineDist(plot, slice(lane, Math.max(0, p.t - 9), p.t + 9)) < LANE_WIDTH / 2 + 0.3)
    return "Gasse zu nah";
  // Vor der Hausfront darf kein Baum stehen (sonst wäre das Haus verdeckt)
  const f = space.conflict(frontZone(p.x, p.z, p.angle), {
    margin: 0.3,
    pathClearance: 0,
    kinds: TALL,
    skipWater: true,
    skipBounds: true,
    skipPaths: true,
  });
  if (f) return "Baum vor der Front";
  if (key.startsWith("g")) {
    const end = p.t + PLOT.hw + 1.2;
    if (end > lane.builtT) {
      const ext = slice(lane, Math.max(lane.builtT - 0.5, 0), end);
      const ign = new Set([
        corridorId(lane.dir),
        laneId(lane.dir),
        nodeClaimId(lane.quarterId),
        "hauptplatz",
      ]);
      const e = space.pathConflict(ext, LANE_WIDTH / 2, ign, 0, 0, true);
      if (e) return `Gasse: ${e.grund}`;
    }
  }
  return null;
}

/** Belegt einen Bauplatz und verlängert die Gasse bei Bedarf. */
function claimSlot(ctx: Ctx, lane: Lane, key: SlotKey, houseId: string, pinned: boolean) {
  const p = slotPose(lane, key);
  ctx.space.addClaim({
    id: `haus-${houseId}`,
    kind: "grundstueck",
    shape: plotShape(p.x, p.z, p.angle),
    label: "im Garten eines Hauses",
  });
  ctx.space.addClaim({
    id: `front-${houseId}`,
    kind: "frontzone",
    shape: frontZone(p.x, p.z, p.angle),
    label: "verdeckt ein Haus",
  });
  if (key.startsWith("g") && p.t + PLOT.hw + 1.2 > lane.builtT) {
    const from = lane.builtT;
    lane.builtT = p.t + PLOT.hw + 1.2;
    ctx.space.addPath({
      id: laneId(lane.dir),
      pts: slice(lane, Math.max(0, from - 0.5), lane.builtT),
      hw: LANE_WIDTH / 2,
      label: "auf der Gasse",
    });
  }
  lane.slots[key] = houseId;
  ctx.houses[houseId] = {
    id: houseId,
    quarterId: lane.quarterId,
    dir: lane.dir,
    slot: key,
    x: p.x,
    z: p.z,
    angle: p.angle,
    pinned,
  };
}

/** Öffnet einen Ausgang für ein Quartier: Quartierplatz (bei der ersten Gasse) samt Zuweg. */
function openLane(ctx: Ctx, q: FachbereichId, k: number, primary: boolean): Lane | null {
  if (ctx.failed.has(`${k}:${primary}`)) return null;
  const lane: Lane = {
    ...ctx.axes[k],
    dir: k,
    quarterId: q,
    primary,
    slots: {},
    builtT: 0,
    rejected: new Map(),
  };
  const m = ctx.space.mark();
  const ign = new Set([corridorId(k)]);
  if (primary) {
    const c = at(lane, lane.nodeT);
    const node: SettlementNode = {
      id: nodeClaimId(q),
      quarterId: q,
      dir: k,
      x: c.x,
      z: c.z,
      entry: c.h + Math.PI,
    };
    const shape = circle(c.x, c.z, NODE_RP / Math.cos(Math.PI / NODE_N) + 0.3);
    const access = slice(lane, 0, lane.nodeT - NODE_RP + 0.35);
    if (
      ctx.space.conflict(shape, {
        margin: MARGIN_PLOT,
        pathClearance: 0.3,
        ignore: ign,
        kinds: PLOT_BLOCKERS,
      }) ||
      ctx.space.conflict(boardZone(node), {
        margin: 0.3,
        pathClearance: 0,
        ignore: ign,
        kinds: SIGHT_BLOCKERS,
      }) ||
      ctx.space.pathConflict(access, MAIN_PATH_WIDTH / 2, new Set([...ign, "hauptplatz"]), 1, 0.5)
    ) {
      ctx.failed.add(`${k}:${primary}`);
      return null;
    }
    ctx.space.addClaim({ id: node.id, kind: "knoten", shape, label: "auf dem Quartierplatz" });
    ctx.space.addClaim({
      id: `tafel-${q}`,
      kind: "sichtzone",
      shape: boardZone(node),
      label: "verdeckt die Quartiertafel",
    });
    ctx.space.addPath({
      id: `weg-zugang-${k}`,
      pts: access,
      hw: MAIN_PATH_WIDTH / 2,
      label: "auf dem Weg",
    });
    lane.builtT = lane.nodeT + NODE_RP - 0.35;
    ctx.nodes.push(node);
  }
  if (!slotKeys(ctx.seed, ctx.space, lane).some((key) => slotFree(ctx.space, lane, key))) {
    ctx.space.rollback(m);
    if (primary) ctx.nodes.pop();
    ctx.failed.add(`${k}:${primary}`);
    return null;
  }
  ctx.lanes.set(k, lane);
  const dirs = ctx.quarterDirs.get(q) ?? [];
  dirs.push(k);
  ctx.quarterDirs.set(q, dirs);
  return lane;
}

/** Wie weit reicht eine Achse, bis sie Wasser (ausser Fluss mit Brücke) oder ein Merkmal trifft? */
function axisRoom(space: Space, a: Axis): number {
  const m = space.map;
  for (let i = 0; i < a.axis.length; i += 4) {
    const p = a.axis[i];
    const s = circle(p.x, p.z, LANE_WIDTH / 2 + PLOT.front + PLOT.back);
    if (
      inWater({ ...m, river: null }, s, 0) ||
      space.claims.some((c) => c.kind === "merkmal" && overlaps(s, c.shape, 0))
    ) {
      return a.acc[i];
    }
  }
  return a.acc[a.acc.length - 1];
}

/** Freie Ausgänge, sortiert: neues Quartier möglichst weit weg von belegten, Erweiterung möglichst nahe. */
function rankDirections(ctx: Ctx, q: FachbereichId): number[] {
  const used = [...ctx.lanes.keys()];
  const own = ctx.quarterDirs.get(q) ?? [];
  const tieR = rng(ctx.seed, `richtung-${q}`);
  const tie = Array.from({ length: DIRECTIONS }, () => tieR());
  const dist = (a: number, b: number) =>
    Math.min((a - b + DIRECTIONS) % DIRECTIONS, (b - a + DIRECTIONS) % DIRECTIONS);
  const score = (k: number) => {
    if (own.length) return -Math.min(...own.map((o) => dist(k, o)));
    if (used.length === 0) return 0;
    return Math.min(...used.map((u) => dist(k, u)));
  };
  // Bei Gleichstand: Gassen mit mehr Platz (bis Wasser/Merkmal) zuerst, dann per Seed
  const room = (k: number) => Math.round(ctx.room[k] / 10);
  return Array.from({ length: DIRECTIONS }, (_, k) => k)
    .filter((k) => !ctx.lanes.has(k))
    .sort((a, b) => score(b) - score(a) || room(b) - room(a) || tie[b] - tie[a]);
}

/** Setzt ein Haus automatisch: erster freier Bauplatz des Quartiers, sonst neuer Ausgang. */
function placeAuto(ctx: Ctx, h: SettlementHouse): boolean {
  const tryLane = (lane: Lane) => {
    for (const key of slotKeys(ctx.seed, ctx.space, lane)) {
      if (slotFree(ctx.space, lane, key)) {
        claimSlot(ctx, lane, key, h.id, false);
        return true;
      }
    }
    return false;
  };
  for (const k of ctx.quarterDirs.get(h.fach) ?? []) if (tryLane(ctx.lanes.get(k)!)) return true;
  const primary = !ctx.quarterDirs.get(h.fach)?.length;
  for (const k of rankDirections(ctx, h.fach)) {
    const lane = openLane(ctx, h.fach, k, primary);
    if (lane && tryLane(lane)) return true;
  }
  return false;
}

/** Platziert die Siedlung: fixierte Quartiere und Häuser, dann `beforeAuto` (eigene Deko), dann die übrigen Häuser. */
export function placeSettlement(
  seed: string,
  space: Space,
  houses: SettlementHouse[],
  pins: SettlementPins,
  beforeAuto?: () => void,
): Settlement {
  const map = space.map;
  const plaza = map.plaza;
  const ctx: Ctx = {
    seed,
    space,
    plaza,
    lanes: new Map(),
    axes: Array.from({ length: DIRECTIONS }, (_, k) =>
      laneAxis(seed, plaza, k, map.rBuild, map.lake),
    ),
    nodes: [],
    houses: {},
    quarterDirs: new Map(),
    failed: new Set(),
    room: [],
  };
  ctx.room = ctx.axes.map((a) => axisRoom(space, a));
  const droppedPins: string[] = [];
  space.addClaim({
    id: "hauptplatz",
    kind: "platz",
    shape: circle(0, 0, plaza.a / Math.cos(Math.PI / plaza.n) + 0.4),
    label: "auf dem Dorfplatz",
  });
  // Korridore aller Ausgänge freihalten (nur für Häuser; Deko und Natur dürfen dort stehen)
  ctx.axes.forEach((a, k) => {
    space.addPath({
      id: corridorId(k),
      pts: a.axis,
      hw: CORRIDOR_HW,
      label: "auf einer künftigen Gasse",
      onlyFor: "grundstueck",
    });
  });

  // 1. Fixierte Quartiere (Ausgänge) und Häuser
  const present = new Set(houses.map((h) => h.fach));
  for (const q of FACH_ORDER) {
    const dirs = pins.quartiere?.[q];
    if (!dirs || !present.has(q)) continue;
    dirs.forEach((k, i) => {
      const ok = Number.isInteger(k) && k >= 0 && k < DIRECTIONS && !ctx.lanes.has(k);
      if (!ok || !openLane(ctx, q, k, i === 0)) droppedPins.push(`${q}:${k}`);
    });
  }
  const pinned = new Set<string>();
  for (const h of houses) {
    const pin = pins.haeuser?.[h.id];
    if (!pin) continue;
    const lane = ctx.lanes.get(pin.r);
    if (
      !lane ||
      lane.quarterId !== h.fach ||
      !/^(p[01]|g\d{1,2})$/.test(pin.s) ||
      !slotFree(space, lane, pin.s as SlotKey)
    ) {
      droppedPins.push(h.id);
      continue;
    }
    claimSlot(ctx, lane, pin.s as SlotKey, h.id, true);
    pinned.add(h.id);
  }

  // 2. Eigene Deko (vom Aufrufer), dann 3. übrige Häuser nach Alter
  beforeAuto?.();
  const unplaced: string[] = [];
  const rest = houses
    .filter((h) => !pinned.has(h.id))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  for (const h of rest) if (!placeAuto(ctx, h)) unplaced.push(h.id);

  // Wege: Zuweg zum Quartierplatz und gebaute Gasse
  const paths: SettlementPath[] = [];
  for (const lane of [...ctx.lanes.values()].sort((a, b) => a.dir - b.dir)) {
    const qi = quarterIndex(lane.quarterId);
    if (lane.primary) {
      paths.push({
        id: `haupt-${lane.quarterId}`,
        kind: "haupt",
        ownerId: lane.quarterId,
        quarterIndex: qi,
        points: resample(slice(lane, 0, lane.nodeT - NODE_RP + 0.35), 0.5),
        width: MAIN_PATH_WIDTH,
        seed: 1,
      });
    }
    const start = lane.primary ? lane.nodeT + NODE_RP - 0.35 : 0;
    if (lane.builtT > start + 0.5) {
      paths.push({
        id: `gasse-${lane.quarterId}-${lane.dir}`,
        kind: "gasse",
        ownerId: lane.quarterId,
        quarterIndex: qi,
        points: resample(slice(lane, start, lane.builtT), 0.5),
        width: LANE_WIDTH,
        seed: 2 + lane.dir,
      });
    }
  }
  const lanes = [...ctx.lanes.values()];
  const bridges = paths
    .filter((p) => p.kind === "gasse")
    .flatMap((p) => riverCrossings(map, p.points, p.width / 2))
    .map(({ x, z, angle, span }) => ({ x, z, angle, span: span + 1.2 }));
  return {
    plaza,
    bridges,
    lanes,
    nodes: ctx.nodes,
    houses: ctx.houses,
    paths,
    unplaced,
    droppedPins,
  };
}

/** Fixierungen, die den aktuellen Stand genau festhalten (Bau-Modus speichert immer alles fixiert). */
export function pinsFromSettlement(s: Settlement): Required<SettlementPins> {
  const quartiere: Partial<Record<FachbereichId, number[]>> = {};
  for (const lane of s.lanes) {
    const list = (quartiere[lane.quarterId] ??= []);
    if (lane.primary) list.unshift(lane.dir);
    else list.push(lane.dir);
  }
  const haeuser: Record<string, HousePin> = {};
  for (const h of Object.values(s.houses)) haeuser[h.id] = { r: h.dir, s: h.slot };
  return { quartiere, haeuser };
}

/** Freie Bauplätze eines Quartiers (Bau-Modus: Haus umsetzen). */
export function freeSlots(seed: string, space: Space, s: Settlement, q: FachbereichId) {
  const out: { dir: number; key: SlotKey; x: number; z: number; angle: number }[] = [];
  for (const lane of s.lanes.filter((l) => l.quarterId === q)) {
    for (const key of slotKeys(seed, space, lane)) {
      if (slotFree(space, lane, key)) out.push({ dir: lane.dir, key, ...slotPose(lane, key) });
    }
  }
  return out;
}

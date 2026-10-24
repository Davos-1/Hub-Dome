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
import { AXIS_STEP, DIRECTIONS, laneAxesOf, NODE_RP, type Axis } from "./axes";
import {
  box,
  circle,
  distPointPolyline,
  overlaps,
  polar,
  resample,
  shapePolylineDist,
  toWorld,
  type Box,
  type Pt,
} from "./geom";
import {
  CORRIDOR_HW,
  GATE_GAP,
  LANE_WIDTH,
  MAIN_PATH_WIDTH,
  NODE_N,
  PLOT,
  SPUR_WIDTH,
} from "./plot";
import {
  coreSpur,
  isPolar,
  roadCurve,
  roadsForQuarter,
  smartPaths,
  type PolarSlot,
  type QuarterFrame,
  type QuarterRoad,
} from "./roads";
import { rng } from "./seed";
import { inWater, riverCrossings, type Bridge } from "./map";
import type { ClaimKind, Space } from "./space";

export { GATE, LANE_WIDTH, MAIN_PATH_WIDTH, NODE_N, PLOT, SPUR_WIDTH } from "./plot";

const MARGIN_PLOT = 0.6;
/** Abstand zweier Häuser auf derselben Gassenseite (Grundstücksbreite plus Lücke). */
const LANE_SPACING = PLOT.hw * 2 + 1.4;
/** v2: Quartierfläche reicht bis so weit (Hausmitte) von der eigenen Gassenachse (zwei Reihen). */
export const AREA_MAX = 18.5;
/** v3: grösserer Bewegungsraum (drei Reihen, Ring und Halbkreis bis zum grössten Radius). */
export const AREA_MAX_V3 = 26;
/** Spielraum der Quartierfläche über die Mittellinie zur nächsten fremden Achse hinaus. */
const AREA_SLACK = 2.5;
/** Abstand der Hausmitte zur Achse für die erste Reihe (wie die Bauplätze an der Gasse). */
export const ROW1 = LANE_WIDTH / 2 + GATE_GAP + PLOT.front;

export type SettlementHouse = {
  id: string;
  fach: FachbereichId;
  /** Reihenfolge (aufsteigend): ältere Häuser zuerst. */
  order: number;
};

/** Bauplatz: «p0»/«p1» am Quartierplatz (links/rechts), «g<j>» an der Gasse, «k<j>» rund um den Platz (v3). */
export type SlotKey = `p${0 | 1}` | `g${number}` | `k${number}`;
/** Gültige Schlüssel eines Bauplatzes im Welt-Dokument. */
export const SLOT_RE = /^(p[01]|g\d{1,2}|k\d{1,3})$/;
/**
 * Fixierung eines Hauses: Bauplatz `s` an Gasse `r` (v1 und v2) oder freie Lage `x`, `z` (Hausmitte, nur v2;
 * die Ausrichtung ergibt sich automatisch: Front quer zur Gasse, Tor zum nächsten Weganschluss).
 */
export type HousePin = { r: number; s: string } | { r: number; x: number; z: number };
export const isFreePin = (p: HousePin): p is { r: number; x: number; z: number } => "x" in p;
export type SettlementPins = {
  /** Ausgänge pro Quartier (der erste trägt den Quartierplatz, weitere sind Erweiterungen). */
  quartiere?: Partial<Record<FachbereichId, number[]>>;
  haeuser?: Record<string, HousePin>;
  /** Quartiere, deren Ausgänge auch ohne Häuser bleiben (Prüfwelt im Bau-Modus). */
  keep?: FachbereichId[];
  /** v3: Wegform je Quartier (fehlt = Gasse). */
  roads?: Partial<Record<FachbereichId, QuarterRoad>>;
  /** v3: Eckpunkt im Stichweg eines Hauses. */
  bends?: Record<string, Pt>;
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
  /** v3, nur erste Gasse eines Quartiers: wirksame Wegform (Ring, Halbkreis, Intelligent), sonst Gasse. */
  road?: QuarterRoad;
  /** v3: Mitte des Quartierplatzes und Richtung nach aussen. */
  frame?: QuarterFrame;
  /** v3: Bauplätze rund um den Platz. */
  polar?: PolarSlot[];
  /** v3: Kernweg (Ring, Halbkreis). */
  core?: Pt[][];
  /** v3: Bis zu diesem Abstand von der Platzmitte schauen Häuser zur Mitte. */
  reach?: number;
  /** v3: Bogenlänge, ab der die Gasse für weitere Häuser beginnt (hinter Ring und Halbkreis). */
  gStart?: number;
  /** v3: Bogenlänge des ersten Bauplatzes an der Gasse (ausserhalb des Bereichs, der zur Mitte schaut). */
  gSlot0?: number;
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
  /** Zuweg, Gasse oder (v2) Stichweg vom Rückgrat zum Gartentor. */
  kind: "haupt" | "gasse" | "stich";
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
  /** Bauplatz oder «frei» (v2: freie Lage im Quartier). */
  slot: SlotKey | "frei";
  /** Lage entlang der Gasse (Bogenlänge der Projektion). */
  t: number;
  x: number;
  z: number;
  /** Lokale +z-Achse (Front, Tor) zeigt zum Weg. */
  angle: number;
  pinned: boolean;
};

export type Settlement = {
  plaza: { a: number; n: number; rot: number };
  /** Brücken, wo Gassen den Fluss queren. */
  bridges: Bridge[];
  lanes: Lane[];
  nodes: SettlementNode[];
  houses: Record<string, PlacedHouse>;
  paths: SettlementPath[];
  /** Häuser ohne gültigen Bauplatz (bleiben über Liste und Suche erreichbar). */
  unplaced: string[];
  /** Ungültige Fixierungen (wurden automatisch neu gesetzt). */
  droppedPins: string[];
  /** Nur v2: Stichweg je Haus (vom Tor zum Rückgrat). */
  spurs: Record<string, Pt[]>;
  /** Generator v3 (Wegformen, Eckpunkte). */
  v3: boolean;
  /** v3: Quartiere, deren gewählte Wegform nicht passt (sie bekommen die Gasse). */
  droppedForms: FachbereichId[];
  /** v3: Häuser, deren Eckpunkt keinen gültigen Weg ergibt (Weg ohne Eckpunkt). */
  droppedBends: string[];
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
export function slotPose(
  lane: Axis & { primary: boolean; polar?: PolarSlot[]; gSlot0?: number },
  key: SlotKey,
) {
  if (key.startsWith("k")) {
    const k = lane.polar?.find((p) => p.key === key);
    if (!k) return { x: NaN, z: NaN, angle: 0, t: 0 };
    return { x: k.x, z: k.z, angle: k.angle, t: spineAt(lane, k.x, k.z).t };
  }
  let t: number;
  let side: 1 | -1;
  let off: number;
  if (key === "p0" || key === "p1") {
    t = lane.nodeT;
    side = key === "p0" ? 1 : -1;
    off = NODE_RP + 0.5;
  } else {
    const j = Number(key.slice(1));
    const t0 =
      lane.gSlot0 !== undefined ? lane.gSlot0 : lane.primary ? lane.nodeT + PLOT.hw * 2 + 1.0 : 6;
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
const coreId = (q: FachbereichId, i: number) => `ring-${q}-${i}`;
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
  /** Generator v2: Stichwege, freie Lagen, Rückfall der Platzsuche. */
  v2: boolean;
  spurs: Record<string, Pt[]>;
  /** Generator v3: Wegformen und Eckpunkte. */
  v3: boolean;
  roads: Partial<Record<FachbereichId, QuarterRoad>>;
  bends: Record<string, Pt>;
  /** v3 «Intelligent»: Wege des Quartiers, in die neue Wege münden dürfen. */
  trunks: Map<FachbereichId, Pt[][]>;
  droppedBends: string[];
  /** v3: Wegformen gelten nur für fixierte Quartiere (sonst hinge das Ergebnis von der Reihenfolge ab). */
  pinning: boolean;
};

/** Reihenfolge der Bauplätze einer Gasse: zuerst am Quartierplatz (Seite per Seed), dann die Gasse hinaus. */
function slotKeys(seed: string, space: Space, lane: Lane): SlotKey[] {
  const out: SlotKey[] = [];
  // v3: Plätze rund um den Quartierplatz, danach die Gasse für weitere Häuser
  if (lane.polar) {
    for (const k of lane.polar)
      if (Math.hypot(k.x, k.z) <= space.map.rBuild - PLOT.hw) out.push(k.key);
  } else if (lane.primary)
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
function slotFree(space: Space, lane: Lane, key: SlotKey, ctx?: Ctx): boolean {
  if (lane.slots[key] || lane.rejected.has(key)) return false;
  const why = key.startsWith("k")
    ? ctx
      ? polarSlotCheck(ctx, lane, key)
      : "kein Bauplatz"
    : slotCheck(space, lane, key);
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
        // v3: Die Gasse beginnt am Kernweg (Ring, Halbkreis)
        ...(lane.core ?? []).map((_, i) => coreId(lane.quarterId, i)),
      ]);
      const e = space.pathConflict(ext, LANE_WIDTH / 2, ign, 0, 0, true, clearance(space));
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
    t: p.t,
    x: p.x,
    z: p.z,
    angle: p.angle,
    pinned,
  };
  // v3: Weg vom Tor zum Kernweg bzw. zum Quartierplatz
  if (key.startsWith("k")) return claimPolarSpur(ctx, lane, houseId, p);
  // v2: kurzer Stichweg vom Tor zur Gasse bzw. zum Quartierplatz (kein Grasspalt)
  if (ctx.v2) claimSpur(ctx, lane, houseId, p);
}

// ---------- v2: freie Lagen im Quartier, Stichwege ----------

/** Nächster Punkt einer Lage auf der Gassenachse: Bogenlänge `t`, Abstand `d` (links positiv), Normale. */
export function spineAt(lane: Axis, x: number, z: number) {
  let best = { d2: Infinity, i: 0, f: 0 };
  for (let i = 0; i < lane.axis.length - 1; i++) {
    const a = lane.axis[i];
    const b = lane.axis[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const f = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const d2 = (x - (a.x + dx * f)) ** 2 + (z - (a.z + dz * f)) ** 2;
    if (d2 < best.d2) best = { d2, i, f };
  }
  const p = at(lane, lane.acc[best.i] + best.f * AXIS_STEP);
  const d = (x - p.x) * p.nx + (z - p.z) * p.nz;
  return { t: lane.acc[best.i] + best.f * AXIS_STEP, d, dist: Math.sqrt(best.d2), ...p };
}

/**
 * Lage eines frei gesetzten Hauses: Mitte (x, z), Front quer zur Achse und zum Weg gedreht. v3 bei Ring,
 * Halbkreis und Intelligent: nahe am Quartierplatz schaut die Front zur Platzmitte (`polar`).
 */
export function freePose(
  lane: Axis & { frame?: QuarterFrame; reach?: number },
  x: number,
  z: number,
) {
  const s = spineAt(lane, x, z);
  const f = lane.frame;
  if (f && lane.reach && Math.hypot(x - f.x, z - f.z) <= lane.reach)
    return { x, z, angle: Math.atan2(f.x - x, f.z - z), t: s.t, d: s.d, polar: true };
  const side = s.d >= 0 ? 1 : -1;
  return { x, z, angle: Math.atan2(-side * s.nx, -side * s.nz), t: s.t, d: s.d, polar: false };
}

/** Stichweg vom Tor gerade zum Rückgrat (Gasse oder Quartierplatz); `null`, wenn das Tor schon anliegt. */
export function spurOf(
  lane: Axis & { primary: boolean },
  pose: { x: number; z: number; angle: number },
): Pt[] | null {
  const gate = toWorld(pose.x, pose.z, pose.angle, 0, PLOT.front - 0.05);
  const end = spurEnd(lane, gate);
  if (Math.hypot(gate.x - end.x, gate.z - end.z) < 0.15) return null;
  return resample([gate, end], 0.5);
}

/** Ende eines Stichwegs von `from` gerade zum Rückgrat (Gasse oder Quartierplatz), am Wegrand. */
function spurEnd(lane: Axis & { primary: boolean }, from: Pt): Pt {
  const s = spineAt(lane, from.x, from.z);
  const onNode = lane.primary && Math.abs(s.t - lane.nodeT) < NODE_RP + 0.6;
  const reach = onNode ? NODE_RP - 0.15 : LANE_WIDTH / 2 - 0.15;
  const c = onNode ? at(lane, lane.nodeT) : s;
  const dx = from.x - c.x;
  const dz = from.z - c.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: c.x + (dx / l) * reach, z: c.z + (dz / l) * reach };
}

/** Liegt ein Wegende am Quartierplatz oder an der gebauten Gasse? */
function onBuilt(lane: Lane, p: Pt): boolean {
  const s = spineAt(lane, p.x, p.z);
  if (lane.primary && Math.abs(s.t - lane.nodeT) < NODE_RP + 0.6) return true;
  const start = lane.primary ? (lane.gStart ?? lane.nodeT + NODE_RP) - 0.35 : 0;
  return s.t >= start && s.t <= lane.builtT;
}

/** v3: Stichweg über einen Eckpunkt (Tor → Eckpunkt → Rückgrat). */
function bentSpur(lane: Lane, pose: { x: number; z: number; angle: number }, bend: Pt): Pt[] {
  const gate = toWorld(pose.x, pose.z, pose.angle, 0, PLOT.front - 0.05);
  return resample([gate, bend, spurEnd(lane, bend)], 0.5);
}

/** Was ein Weg vom Tor eines Hauses nicht prüft: eigenes Grundstück, eigene Achse, Platz, Kernweg. */
function spurIgnore(lane: Lane, houseId: string): Set<string> {
  const ign = new Set([
    `haus-${houseId}`,
    `front-${houseId}`,
    corridorId(lane.dir),
    laneId(lane.dir),
    nodeClaimId(lane.quarterId),
    `tafel-${lane.quarterId}`,
  ]);
  lane.core?.forEach((_, i) => ign.add(coreId(lane.quarterId, i)));
  return ign;
}

/**
 * v3: Weg vom Tor eines Hauses mit Front zur Platzmitte. Ring und Halbkreis: gerade zum Kernweg; Intelligent:
 * geschwungen zum Platz oder in einen nahen Weg. `null` = kein Weg nötig, `false` = kein gültiger Weg.
 */
function polarSpur(
  ctx: Ctx,
  lane: Lane,
  houseId: string,
  pose: { x: number; z: number; angle: number },
  bend: Pt | null,
): Pt[] | null | false {
  const gate = toWorld(pose.x, pose.z, pose.angle, 0, PLOT.front - 0.05);
  const ign = spurIgnore(lane, houseId);
  if (lane.road?.form === "intelligent" && lane.frame) {
    const front = { x: Math.sin(pose.angle), z: Math.cos(pose.angle) };
    const trunks = ctx.trunks.get(lane.quarterId) ?? [];
    // Die eigene Achse hinter dem Platz bleibt frei (dort führt die Gasse für weitere Häuser hinaus)
    const axis = slice(lane, lane.nodeT + NODE_RP + 1, lane.acc[lane.acc.length - 1]);
    for (const c of smartPaths(lane.frame, gate, front, roadCurve(lane.road), trunks, bend)) {
      const end = c.merge ? 3.0 : 1.0;
      if (ctx.space.pathConflict(c.pts, SPUR_WIDTH / 2, ign, 0, end, false, 0.3)) continue;
      const inner = c.pts.slice(0, Math.max(1, c.pts.length - Math.ceil(end / 0.5)));
      if (
        inner.some((p) => distPointPolyline(p.x, p.z, axis) < LANE_WIDTH / 2 + SPUR_WIDTH / 2 + 0.3)
      )
        continue;
      return c.pts;
    }
    return false;
  }
  const spur = coreSpur(gate, lane.core ?? [], bend);
  if (!spur) return null;
  return ctx.space.pathConflict(spur, SPUR_WIDTH / 2, ign, 0, 0.6, false, 0.3) ? false : spur;
}

/** Stichweg eintragen (Register, Liste, bei «Intelligent» als möglicher Mündungsweg). */
function addSpur(ctx: Ctx, lane: Lane, houseId: string, pts: Pt[]) {
  ctx.spurs[houseId] = pts;
  ctx.space.addPath({
    id: `stich-${houseId}`,
    pts,
    hw: SPUR_WIDTH / 2,
    label: "auf dem Stichweg",
  });
  if (lane.road?.form === "intelligent") {
    const list = ctx.trunks.get(lane.quarterId) ?? [];
    list.push(pts);
    ctx.trunks.set(lane.quarterId, list);
  }
}

/** v3: Weg eines Hauses mit Front zur Mitte eintragen; Eckpunkt nur, wenn er einen gültigen Weg ergibt. */
function claimPolarSpur(
  ctx: Ctx,
  lane: Lane,
  houseId: string,
  pose: { x: number; z: number; angle: number },
) {
  const bend = ctx.bends[houseId];
  let spur = bend ? polarSpur(ctx, lane, houseId, pose, bend) : false;
  if (bend && !spur) ctx.droppedBends.push(houseId);
  if (!spur) spur = polarSpur(ctx, lane, houseId, pose, null);
  if (spur) addSpur(ctx, lane, houseId, spur);
}

/**
 * v3: Prüft ein Haus mit Front zur Platzmitte (Bauplatz rund um den Platz oder freie Lage nahe am Platz):
 * Quartierfläche, Grundstück (die eigene Achse bleibt frei), Front und Weg zum Tor.
 */
function polarFits(
  ctx: Ctx,
  lane: Lane,
  pose: { x: number; z: number; angle: number },
  houseId: string,
): string | null {
  const area = inQuarterArea(ctx, lane, pose.x, pose.z);
  if (area) return area;
  const c = ctx.space.conflict(plotShape(pose.x, pose.z, pose.angle), {
    margin: MARGIN_PLOT,
    pathClearance: 0.3,
    kinds: PLOT_BLOCKERS,
    asKind: "grundstueck",
  });
  if (c) return c.grund;
  const f = ctx.space.conflict(frontZone(pose.x, pose.z, pose.angle), {
    margin: 0.3,
    pathClearance: 0,
    kinds: TALL,
    skipWater: true,
    skipBounds: true,
    skipPaths: true,
  });
  if (f) return "Baum vor der Front";
  if (polarSpur(ctx, lane, houseId, pose, null) === false) return "kein Weg zum Tor";
  return null;
}

function polarSlotCheck(ctx: Ctx, lane: Lane, key: SlotKey): string | null {
  const p = slotPose(lane, key);
  if (!Number.isFinite(p.x)) return "kein Bauplatz";
  return polarFits(ctx, lane, p, "");
}

function claimSpur(
  ctx: Ctx,
  lane: Lane,
  houseId: string,
  pose: { x: number; z: number; angle: number },
) {
  let spur = spurOf(lane, pose);
  // v3: Eckpunkt, falls der Weg darüber gültig ist
  const bend = ctx.v3 ? ctx.bends[houseId] : undefined;
  if (bend) {
    const bent = bentSpur(lane, pose, bend);
    if (
      onBuilt(lane, bent[bent.length - 1]) &&
      !ctx.space.pathConflict(bent, SPUR_WIDTH / 2, spurIgnore(lane, houseId), 0, 0.6, false, 0.3)
    )
      spur = bent;
    else ctx.droppedBends.push(houseId);
  }
  if (!spur) return;
  addSpur(ctx, lane, houseId, spur);
}

/**
 * Liegt die Lage in der Quartierfläche? Feste Aufteilung nach der nächsten Achse aller Ausgänge (auch
 * unbenutzter): Sie hängt nicht davon ab, welche Gassen später dazukommen, also hält eine gespeicherte Lage.
 */
function inQuarterArea(ctx: Ctx, lane: Lane, x: number, z: number): string | null {
  const own = spineAt(lane, x, z);
  const max = ctx.v3 ? AREA_MAX_V3 : AREA_MAX;
  if (Math.abs(own.d) > max || own.dist > max + 0.5) return "zu weit weg von der Gasse";
  // Nächste fremde Achse; Häuser am Quartierplatz liegen auf der Mittellinie, daher etwas Spielraum
  let best = { k: -1, dist: Infinity };
  ctx.axes.forEach((a, k) => {
    if (ctx.lanes.get(k)?.quarterId === lane.quarterId) return;
    const d = spineAt(a, x, z).dist;
    if (d < best.dist) best = { k, dist: d };
  });
  if (own.dist > best.dist + AREA_SLACK)
    return ctx.lanes.has(best.k) ? "im Nachbarquartier" : "ausserhalb der Quartierfläche";
  if (lane.primary && own.t < lane.nodeT - NODE_RP - 1)
    return "zwischen Dorfplatz und Quartierplatz";
  return null;
}

/**
 * Prüft eine freie Lage (v2): Grundstück, Quartierfläche, künftige Gasse, Front, Stichweg und nötige
 * Verlängerung der Gasse. `null` = gültig, sonst ein kurzer Grund.
 */
function freeCheck(
  ctx: Ctx,
  lane: Lane,
  pose: { x: number; z: number; angle: number; t: number; polar?: boolean },
  houseId: string,
): string | null {
  if (pose.polar) return polarFits(ctx, lane, pose, houseId);
  const plot = plotShape(pose.x, pose.z, pose.angle);
  const area = inQuarterArea(ctx, lane, pose.x, pose.z);
  if (area) return area;
  const ignore = new Set([corridorId(lane.dir), nodeClaimId(lane.quarterId)]);
  const c = ctx.space.conflict(plot, {
    margin: MARGIN_PLOT,
    pathClearance: 0.3,
    ignore,
    kinds: PLOT_BLOCKERS,
    asKind: "grundstueck",
  });
  if (c) return c.grund;
  // Quartierplatz: Grundstück darf ihn nicht berühren (der Platz selbst ist oben ausgenommen)
  if (lane.primary) {
    const n = at(lane, lane.nodeT);
    if (overlaps(plot, circle(n.x, n.z, NODE_RP / Math.cos(Math.PI / NODE_N)), 0.2))
      return "auf dem Quartierplatz";
  }
  if (
    shapePolylineDist(plot, slice(lane, Math.max(0, pose.t - 9), pose.t + 9)) <
    LANE_WIDTH / 2 + 0.3
  )
    return "zu nah an der Gasse";
  const f = ctx.space.conflict(frontZone(pose.x, pose.z, pose.angle), {
    margin: 0.3,
    pathClearance: 0,
    kinds: TALL,
    skipWater: true,
    skipBounds: true,
    skipPaths: true,
  });
  if (f) return "Baum vor der Front";
  const spur = spurOf(lane, pose);
  if (spur) {
    const ign = new Set([
      `haus-${houseId}`,
      `front-${houseId}`,
      corridorId(lane.dir),
      laneId(lane.dir),
      `weg-zugang-${lane.dir}`,
      nodeClaimId(lane.quarterId),
    ]);
    for (const id of Object.keys(ctx.spurs)) ign.add(`stich-${id}`);
    const e = ctx.space.pathConflict(spur, SPUR_WIDTH / 2, ign, 0, 0.6, false, 0.3);
    if (e) return `kein Weg zum Tor (${e.grund})`;
    for (const [id, other] of Object.entries(ctx.spurs)) {
      if (id !== houseId && spurGap(spur, other) < SPUR_WIDTH + 0.3)
        return "kein Weg zum Tor (Stichweg)";
    }
  }
  const end = pose.t + PLOT.hw + 1.2;
  if (end > lane.builtT) {
    const ext = slice(lane, Math.max(lane.builtT - 0.5, 0), end);
    const ign = new Set([
      corridorId(lane.dir),
      laneId(lane.dir),
      nodeClaimId(lane.quarterId),
      "hauptplatz",
      // v3: Die Gasse beginnt am Kernweg (Ring, Halbkreis)
      ...(lane.core ?? []).map((_, i) => coreId(lane.quarterId, i)),
    ]);
    const e = ctx.space.pathConflict(ext, LANE_WIDTH / 2, ign, 0, 0, true, 0.3);
    if (e) return `Gasse: ${e.grund}`;
  }
  return null;
}

/** v2 prüft Wege und Grundstücke in beide Richtungen mit demselben Abstand (Reihenfolge beim Laden egal). */
const clearance = (space: Space) => (space.map.version === 2 ? 0.3 : 0.35);

/** Kleinster Abstand zweier Stichwege, ohne den letzten halben Meter an der Gasse (dort laufen sie zusammen). */
function spurGap(a: Pt[], b: Pt[]) {
  const cut = (p: Pt[]) => p.slice(0, Math.max(1, p.length - 1));
  const pa = cut(a);
  const pb = cut(b);
  let best = Infinity;
  for (const q of pa)
    best = Math.min(best, distPointPolyline(q.x, q.z, pb.length > 1 ? pb : [pb[0], pb[0]]));
  for (const q of pb)
    best = Math.min(best, distPointPolyline(q.x, q.z, pa.length > 1 ? pa : [pa[0], pa[0]]));
  return best;
}

function claimFree(
  ctx: Ctx,
  lane: Lane,
  pose: { x: number; z: number; angle: number; t: number; polar?: boolean },
  houseId: string,
  pinned: boolean,
) {
  ctx.space.addClaim({
    id: `haus-${houseId}`,
    kind: "grundstueck",
    shape: plotShape(pose.x, pose.z, pose.angle),
    label: "im Garten eines Hauses",
  });
  ctx.space.addClaim({
    id: `front-${houseId}`,
    kind: "frontzone",
    shape: frontZone(pose.x, pose.z, pose.angle),
    label: "verdeckt ein Haus",
  });
  const end = pose.t + PLOT.hw + 1.2;
  if (!pose.polar && end > lane.builtT) {
    const from = lane.builtT;
    lane.builtT = end;
    ctx.space.addPath({
      id: laneId(lane.dir),
      pts: slice(lane, Math.max(0, from - 0.5), lane.builtT),
      hw: LANE_WIDTH / 2,
      label: "auf der Gasse",
    });
  }
  ctx.houses[houseId] = {
    id: houseId,
    quarterId: lane.quarterId,
    dir: lane.dir,
    slot: "frei",
    t: pose.t,
    x: pose.x,
    z: pose.z,
    angle: pose.angle,
    pinned,
  };
  if (pose.polar) claimPolarSpur(ctx, lane, houseId, pose);
  else claimSpur(ctx, lane, houseId, pose);
}

/** Rückfall (v2): erste freie Lage im Quartier, wenn kein Bauplatz und keine neue Gasse mehr passt. */
function placeFreeAuto(ctx: Ctx, h: SettlementHouse): boolean {
  const ROW2 = ROW1 + PLOT.front + PLOT.back + 2.0;
  for (const k of ctx.quarterDirs.get(h.fach) ?? []) {
    const lane = ctx.lanes.get(k)!;
    const t0 = lane.primary ? lane.nodeT : 4;
    const tMax = lane.acc[lane.acc.length - 1] - PLOT.hw - 2;
    for (const d of [ROW1, -ROW1, ROW2, -ROW2])
      for (let t = t0; t <= tMax; t += 0.75) {
        const p = at(lane, t);
        const pose = freePose(lane, p.x + p.nx * d, p.z + p.nz * d);
        if (Math.hypot(pose.x, pose.z) > ctx.space.map.rBuild) break;
        if (!freeCheck(ctx, lane, pose, h.id)) {
          claimFree(ctx, lane, pose, h.id, false);
          return true;
        }
      }
  }
  return false;
}

/**
 * Bewegungsraum eines Quartiers (Bau-Modus): Umriss der Fläche, in der Hausmitten liegen dürfen, als Polygon
 * um den Quartierplatz (Strahlen alle 5°, Schritt 1 m). Nur die Flächenregel, nicht Gärten oder Wege.
 */
export function quarterOutline(space: Space, s: Settlement, quarterId: FachbereichId): Pt[] {
  const ctx = editCtx(space, s);
  const lanes = [...ctx.lanes.values()].filter((l) => l.quarterId === quarterId);
  const node = s.nodes.find((n) => n.quarterId === quarterId);
  if (!lanes.length || !node) return [];
  const inside = (x: number, z: number) => !inQuarterArea(ctx, pickLane(lanes, x, z), x, z);
  const out: Pt[] = [];
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    let last = 0;
    for (let r = 1; r <= 70; r += 1) {
      if (inside(node.x + Math.cos(a) * r, node.z + Math.sin(a) * r)) last = r;
      else if (r - last > 6) break;
    }
    out.push({ x: node.x + Math.cos(a) * last, z: node.z + Math.sin(a) * last });
  }
  return out;
}

/**
 * Gasse eines Quartiers für eine Lage: die mit Wegform, wenn die Lage in ihrem Bereich um den Platz liegt,
 * sonst die nächste Gassenachse.
 */
export function pickLane<L extends Lane>(lanes: L[], x: number, z: number): L {
  const polar = lanes.find((l) => freePose(l, x, z).polar);
  if (polar) return polar;
  return lanes.reduce((a, b) => (spineAt(a, x, z).dist <= spineAt(b, x, z).dist ? a : b));
}

/**
 * Prüft eine freie Lage für ein Haus im Register einer fertigen Welt (Bau-Modus, Ziehen): Das Haus selbst darf
 * darin nicht mehr stehen. Liefert die Lage samt Ausrichtung oder den Grund.
 */
export function checkFreeHouse(
  space: Space,
  settlement: Settlement,
  houseId: string,
  quarterId: FachbereichId,
  x: number,
  z: number,
): { ok: true; pose: ReturnType<typeof freePose>; dir: number } | { ok: false; grund: string } {
  const ctx = editCtx(space, settlement);
  const lanes = [...ctx.lanes.values()].filter((l) => l.quarterId === quarterId);
  if (!lanes.length) return { ok: false, grund: "kein Quartier" };
  // Nächste eigene Gasse bestimmt Ausrichtung und Weg
  const lane = pickLane(lanes, x, z);
  const pose = freePose(lane, x, z);
  if (!space.inBounds(plotShape(pose.x, pose.z, pose.angle)))
    return { ok: false, grund: "ausserhalb der Karte" };
  const why = freeCheck(ctx, lane, pose, houseId);
  return why ? { ok: false, grund: why } : { ok: true, pose, dir: lane.dir };
}

/**
 * Prüft eine Gruppe freier Lagen nacheinander (Quartier verschieben): jedes Haus gegen das Register und gegen die
 * zuvor gesetzten der Gruppe. `space` wird nicht verändert. Liefert die Lagen oder das erste abgewiesene Haus.
 */
export function checkFreeGroup(
  space: Space,
  settlement: Settlement,
  quarterId: FachbereichId,
  list: { id: string; x: number; z: number }[],
):
  | { ok: true; poses: Record<string, ReturnType<typeof freePose> & { dir: number }>; space: Space }
  | { ok: false; id: string; grund: string } {
  const ctx = editCtx(space.clone(), settlement);
  const lanes = [...ctx.lanes.values()].filter((l) => l.quarterId === quarterId);
  if (!lanes.length) return { ok: false, id: list[0]?.id ?? "", grund: "kein Quartier" };
  const poses: Record<string, ReturnType<typeof freePose> & { dir: number }> = {};
  for (const h of list) {
    const lane = pickLane(lanes, h.x, h.z);
    const pose = freePose(lane, h.x, h.z);
    if (!ctx.space.inBounds(plotShape(pose.x, pose.z, pose.angle)))
      return { ok: false, id: h.id, grund: "ausserhalb der Karte" };
    const why = freeCheck(ctx, lane, pose, h.id);
    if (why) return { ok: false, id: h.id, grund: why };
    claimFree(ctx, lane, pose, h.id, true);
    poses[h.id] = { ...pose, dir: lane.dir };
  }
  return { ok: true, poses, space: ctx.space };
}

/** Kontext für Prüfungen auf einer fertigen Welt (Gassen mit ihrer gebauten Länge, Register als Kopie). */
function editCtx(space: Space, s: Settlement): Ctx {
  const lanes = new Map(
    s.lanes.map((l) => [l.dir, { ...l, rejected: new Map(l.rejected) }] as const),
  );
  return {
    seed: space.map.seed,
    space,
    plaza: s.plaza,
    lanes,
    axes: laneAxesOf(space.map.seed, space.map),
    nodes: s.nodes,
    houses: { ...s.houses },
    quarterDirs: new Map(),
    failed: new Set(),
    room: [],
    v2: true,
    spurs: { ...s.spurs },
    v3: s.v3,
    roads: {},
    bends: {},
    trunks: trunksOf(s),
    droppedBends: [],
    pinning: false,
  };
}

/** v3 «Intelligent»: bestehende Wege je Quartier (Mündungsziele beim Prüfen im Bau-Modus). */
function trunksOf(s: Settlement): Map<FachbereichId, Pt[][]> {
  const smart = new Set(
    s.lanes.filter((l) => l.road?.form === "intelligent").map((l) => l.quarterId),
  );
  const out = new Map<FachbereichId, Pt[][]>();
  for (const [id, pts] of Object.entries(s.spurs)) {
    const q = s.houses[id]?.quarterId;
    if (!q || !smart.has(q)) continue;
    out.set(q, [...(out.get(q) ?? []), pts]);
  }
  return out;
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
    if (ctx.v2) lane.nodeT = dryNodeT(ctx.space.map, lane);
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
      // v2: Der Zuweg darf einen Bach auf einer Brücke queren
      ctx.space.pathConflict(
        access,
        MAIN_PATH_WIDTH / 2,
        new Set([...ign, "hauptplatz"]),
        1,
        0.5,
        ctx.v2,
      )
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
    // v3: Wegform des Quartiers (Ring, Halbkreis, Intelligent); passt ihr Kernweg nicht, bleibt die Gasse
    const road = ctx.v3 && ctx.pinning ? ctx.roads[q] : undefined;
    if (road && isPolar(road.form)) applyRoad(ctx, lane, q, road, { x: c.x, z: c.z, h: c.h });
  }
  const keys = slotKeys(ctx.seed, ctx.space, lane);
  if (!keys.some((key) => slotFree(ctx.space, lane, key, ctx))) {
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

/** v3: Wegform auf die erste Gasse eines Quartiers anwenden, sofern ihr Kernweg frei ist. */
function applyRoad(ctx: Ctx, lane: Lane, q: FachbereichId, road: QuarterRoad, frame: QuarterFrame) {
  const geo = roadsForQuarter(frame, road);
  const ign = new Set([
    corridorId(lane.dir),
    `weg-zugang-${lane.dir}`,
    nodeClaimId(q),
    `tafel-${q}`,
    ...geo.core.map((_, i) => coreId(q, i)),
  ]);
  for (const pts of geo.core)
    if (ctx.space.pathConflict(pts, LANE_WIDTH / 2, ign, 0, 0, false, 0.3)) return;
  geo.core.forEach((pts, i) =>
    ctx.space.addPath({ id: coreId(q, i), pts, hw: LANE_WIDTH / 2, label: "auf dem Ringweg" }),
  );
  lane.road = road;
  lane.frame = frame;
  lane.polar = geo.slots;
  lane.core = geo.core;
  lane.reach = geo.reach;
  // Häuser an der Gasse erst ausserhalb des Bereichs, in dem Häuser zur Mitte schauen
  lane.gSlot0 = lane.nodeT + geo.reach;
  if (geo.coreEnd) {
    lane.gStart = lane.nodeT + geo.coreEnd;
    lane.builtT = lane.gStart - 0.35;
  }
}

/**
 * v2: Liegt der Quartierplatz im Wasser (Bach, Teich), rückt er auf der Achse etwas näher zum Dorfplatz oder
 * über das Wasser hinaus. Hängt nur von der Karte ab, also gleich in jeder Reihenfolge.
 */
function dryNodeT(map: Space["map"], lane: Axis): number {
  const r = NODE_RP / Math.cos(Math.PI / NODE_N) + 0.3 + MARGIN_PLOT;
  for (const dt of [0, -1.5, -3, 3, 6, 9, 12]) {
    const c = at(lane, lane.nodeT + dt);
    if (!inWater(map, circle(c.x, c.z, r), 0.2)) return lane.nodeT + dt;
  }
  return lane.nodeT;
}

/** Wie weit reicht eine Achse, bis sie Wasser (ausser Fluss mit Brücke) oder ein Merkmal trifft? */
function axisRoom(space: Space, a: Axis): number {
  const m = space.map;
  for (let i = 0; i < a.axis.length; i += 4) {
    const p = a.axis[i];
    const s = circle(p.x, p.z, LANE_WIDTH / 2 + PLOT.front + PLOT.back);
    if (
      inWater({ ...m, river: null, streams: [] }, s, 0) ||
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
      if (slotFree(ctx.space, lane, key, ctx)) {
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
  /** Generator-Version der Welt (v3: Wegformen und Eckpunkte; die Karte bleibt v2). */
  worldVersion = map2(space),
): Settlement {
  const map = space.map;
  const plaza = map.plaza;
  const ctx: Ctx = {
    seed,
    space,
    plaza,
    lanes: new Map(),
    axes: laneAxesOf(seed, map),
    nodes: [],
    houses: {},
    quarterDirs: new Map(),
    failed: new Set(),
    room: [],
    v2: map.version === 2,
    spurs: {},
    v3: map.version === 2 && worldVersion >= 3,
    roads: pins.roads ?? {},
    bends: pins.bends ?? {},
    trunks: new Map(),
    droppedBends: [],
    pinning: false,
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
  const present = new Set([...houses.map((h) => h.fach), ...(pins.keep ?? [])]);
  ctx.pinning = true;
  for (const q of FACH_ORDER) {
    const dirs = pins.quartiere?.[q];
    if (!dirs || !present.has(q)) continue;
    dirs.forEach((k, i) => {
      const ok = Number.isInteger(k) && k >= 0 && k < DIRECTIONS && !ctx.lanes.has(k);
      if (!ok || !openLane(ctx, q, k, i === 0)) droppedPins.push(`${q}:${k}`);
    });
  }
  ctx.pinning = false;
  const pinned = new Set<string>();
  // Bauplätze zuerst, dann freie Lagen (jede Reihenfolge gibt dasselbe Ergebnis, die Prüfungen sind symmetrisch)
  const pinOrder = houses
    .filter((h) => pins.haeuser?.[h.id])
    .sort(
      (a, b) => Number(isFreePin(pins.haeuser![a.id])) - Number(isFreePin(pins.haeuser![b.id])),
    );
  for (const h of pinOrder) {
    const pin = pins.haeuser![h.id];
    const lane = ctx.lanes.get(pin.r);
    if (!lane || lane.quarterId !== h.fach) {
      droppedPins.push(h.id);
      continue;
    }
    if (isFreePin(pin)) {
      // Freie Lage (nur v2): Ausrichtung automatisch, gleiche Prüfung wie beim Ziehen
      const pose = ctx.v2 ? freePose(lane, pin.x, pin.z) : null;
      if (!pose || freeCheck(ctx, lane, pose, h.id)) {
        droppedPins.push(h.id);
        continue;
      }
      claimFree(ctx, lane, pose, h.id, true);
    } else {
      if (!SLOT_RE.test(pin.s) || !slotFree(space, lane, pin.s as SlotKey, ctx)) {
        droppedPins.push(h.id);
        continue;
      }
      claimSlot(ctx, lane, pin.s as SlotKey, h.id, true);
    }
    pinned.add(h.id);
  }

  // 2. Eigene Deko (vom Aufrufer), dann 3. übrige Häuser nach Alter
  beforeAuto?.();
  const unplaced: string[] = [];
  const rest = houses
    .filter((h) => !pinned.has(h.id))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  for (const h of rest) {
    if (placeAuto(ctx, h)) continue;
    // v2: Rückfall auf eine freie Lage im eigenen Quartier (zweite Reihe, Lücken)
    if (ctx.v2 && placeFreeAuto(ctx, h)) continue;
    unplaced.push(h.id);
  }

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
    const start = lane.primary ? (lane.gStart ?? lane.nodeT + NODE_RP) - 0.35 : 0;
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
  // v3: Kernwege (Ring, Halbkreis)
  for (const lane of lanes0(ctx)) {
    lane.core?.forEach((pts, i) =>
      paths.push({
        id: coreId(lane.quarterId, i),
        kind: "gasse",
        ownerId: lane.quarterId,
        quarterIndex: quarterIndex(lane.quarterId),
        points: pts,
        width: LANE_WIDTH,
        seed: 30 + i,
      }),
    );
  }
  // v2: Stichwege vom Tor zum Rückgrat (konstante Breite)
  for (const [id, pts] of Object.entries(ctx.spurs)) {
    const h = ctx.houses[id];
    if (!h) continue;
    paths.push({
      id: `stich-${id}`,
      kind: "stich",
      ownerId: h.quarterId,
      quarterIndex: quarterIndex(h.quarterId),
      points: pts,
      width: SPUR_WIDTH,
      seed: 11,
    });
  }
  const lanes = [...ctx.lanes.values()];
  const bridges = paths
    .filter((p) => p.kind === "gasse" || (map.version === 2 && p.kind === "haupt"))
    .flatMap((p) => riverCrossings(map, p.points, p.width / 2))
    .map(({ x, z, angle, span, width }) => ({
      x,
      z,
      angle,
      span: span + 1.2,
      // v2: breites Wasser bekommt eine Steinbogenbrücke (v1 kennt keinen Stil)
      ...(map.version === 2
        ? { style: width >= 4.5 ? ("stein" as const) : ("holz" as const) }
        : {}),
    }));
  return {
    plaza,
    bridges,
    lanes,
    nodes: ctx.nodes,
    houses: ctx.houses,
    paths,
    unplaced,
    droppedPins,
    spurs: ctx.spurs,
    v3: ctx.v3,
    droppedForms: ctx.v3
      ? (Object.keys(ctx.roads) as FachbereichId[]).filter(
          (q) =>
            isPolar(ctx.roads[q]?.form) &&
            lanes.some(
              (l) => l.quarterId === q && l.primary && l.road?.form !== ctx.roads[q]?.form,
            ),
        )
      : [],
    droppedBends: [...new Set(ctx.droppedBends)].filter((id) => ctx.houses[id]),
  };
}

/** Gassen in fester Reihenfolge (nach Ausgang). */
const lanes0 = (ctx: Ctx) => [...ctx.lanes.values()].sort((a, b) => a.dir - b.dir);

/** Kartenversion als Standard der Welt-Version (v1-Karte = v1, v2-Karte = v2). */
const map2 = (space: Space) => space.map.version ?? 1;

/** Fixierungen, die den aktuellen Stand genau festhalten (Bau-Modus speichert immer alles fixiert). */
export function pinsFromSettlement(
  s: Settlement,
): Required<Pick<SettlementPins, "quartiere" | "haeuser">> {
  const quartiere: Partial<Record<FachbereichId, number[]>> = {};
  for (const lane of s.lanes) {
    const list = (quartiere[lane.quarterId] ??= []);
    if (lane.primary) list.unshift(lane.dir);
    else list.push(lane.dir);
  }
  const haeuser: Record<string, HousePin> = {};
  for (const h of Object.values(s.houses))
    haeuser[h.id] =
      h.slot === "frei"
        ? { r: h.dir, x: Math.round(h.x * 100) / 100, z: Math.round(h.z * 100) / 100 }
        : { r: h.dir, s: h.slot };
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

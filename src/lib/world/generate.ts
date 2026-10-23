/**
 * Erzeugt die ganze Welt eines Dorfs aus Seed, Häusern und Platzierungen (Generator v1):
 * Karte → Siedlung (fixiert, Deko, automatisch) → Laternen → Pflanzen. Gleiche Eingabe, gleiche Welt.
 * Das Ergebnis enthält das Layout im bisherigen Format (`VillageLayout`) für Szene, Kamera und Beschriftungen.
 */

import { FACHBEREICHE, type FachbereichId } from "../fachbereiche";
import { houseTier, TIER_FOOTPRINT, ZENTRALE_FOOTPRINT } from "../house-size";
import type {
  HouseLayout,
  LayoutHouse,
  LayoutItem,
  PlazaPoly,
  Plot,
  PlotSlot,
  QuarterLayout,
  VillageLayout,
} from "../layout";
import { ARTIFACT_KINDS } from "../types";
import { dirAngle, DIRECTIONS } from "./axes";
import type { DekoItem, WorldDoc } from "./doc";
import { box, circle, polar, TAU, type Pt } from "./geom";
import { generateMap, TRAIL_WIDTH, type WorldMap } from "./map";
import { generateMapV2 } from "./map-v2";
import { applyDeko } from "./rules";
import { GENERATOR_VERSION } from "./seed";
import {
  NODE_N,
  NODE_RP,
  PLOT,
  placeSettlement,
  quarterIndex,
  type Settlement,
} from "./settlement";
import { Space } from "./space";
import { placeLamps, placeVegetation, type LampSpot, type Vegetation } from "./vegetation";

export type WorldInput = {
  seed: string;
  version?: number;
  /** Häuser samt Objekten; `order` = Reihenfolge der Entstehung (älter zuerst). */
  houses: (LayoutHouse & { order?: number })[];
  doc?: WorldDoc | null;
  /** Mobile: weniger Pflanzen, kein Waldgürtel. */
  lowDetail?: boolean;
  /** Bau-Modus: diese Quartiere behalten ihre Ausgänge auch ohne Häuser (Prüfwelt beim Ziehen). */
  keepQuarters?: FachbereichId[];
};

export type World = {
  seed: string;
  version: number;
  map: WorldMap;
  settlement: Settlement;
  layout: VillageLayout;
  deko: DekoItem[];
  rejected: { id: string; typ: string; grund: string }[];
  lamps: LampSpot[];
  vegetation: Vegetation;
  /** Register nach Häusern und Deko (ohne Laternen und Pflanzen): Grundlage für Prüfungen im Bau-Modus. */
  editSpace: Space;
  /** Brunnen und Anschlagbrett am Dorfplatz. */
  plazaDeco: {
    fountain: { x: number; z: number };
    notice: { x: number; z: number; angle: number };
  };
  /** Automatische Ausstattung des Dorfplatzes: Bänke an freien Ausgängen, Pflanzkübel dazwischen. */
  plazaProps: {
    benches: { x: number; z: number; angle: number }[];
    planters: { x: number; z: number }[];
  };
  /** Hühnerhof (eingezäunt, die Hühner bleiben darin), falls Platz ist. */
  chickenRun: { x: number; z: number; r: number } | null;
};

/** Objekt-Plätze im Garten: je Seite zwei Spalten und drei Reihen (12), ab 13 Objekten ein Archivschrank. */
export const PLOT_CAPACITY = 12;
const ROW_Z0 = 2.55;

/** Plätze der Objekte im Grundstück (lokal, +z = Tor). Gibt höchstens 12 Plätze zurück. */
export function plotSlots(items: LayoutItem[]): { slots: PlotSlot[]; archived: number } {
  const shown = items.length > PLOT_CAPACITY ? items.slice(0, PLOT_CAPACITY - 1) : items;
  const archived = items.length - shown.length;
  const sorted = shown
    .slice()
    .sort((a, b) => ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind));
  const n = sorted.length + (archived ? 1 : 0);
  const left = Math.ceil(n / 2);
  const slots: PlotSlot[] = sorted.map((item, i) => {
    const side: -1 | 1 = i < left ? -1 : 1;
    const j = i < left ? i : i - left;
    const row = Math.floor(j / 2);
    const col = j % 2;
    return { ...item, side, row, col, x: side * (1.25 + col * 1.2), z: ROW_Z0 + row * 1.2 };
  });
  return { slots, archived };
}

/** Lage des Archivschranks (letzter Platz rechts aussen). */
export function archivePos(items: number): { x: number; z: number } {
  const n = Math.min(items, PLOT_CAPACITY);
  const left = Math.ceil(n / 2);
  const j = n - 1 - left;
  return { x: 1.25 + (j % 2) * 1.2, z: ROW_Z0 + Math.floor(j / 2) * 1.2 };
}

/** Objekt-Plätze der Zentrale im Ring auf dem Dorfplatz; die Anzahl Reihen hängt von der Platzgrösse ab. */
export function zentraleRing(
  items: LayoutItem[],
  plazaA: number,
): { slots: PlotSlot[]; archived: number } {
  const R0 = 6.2;
  const STEP = 1.3;
  const rMax = plazaA - 4.0;
  const arc = TAU - 1.2;
  const rows: number[] = [];
  for (let r = R0; r <= rMax + 1e-6; r += STEP) rows.push(r);
  const caps = rows.map((r) => Math.max(1, Math.floor((arc * r) / 1.3)));
  const capacity = caps.reduce((s, c) => s + c, 0);
  const shown = items.length > capacity ? items.slice(0, capacity - 1) : items;
  const sorted = shown
    .slice()
    .sort((a, b) => ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind));
  const out: PlotSlot[] = [];
  let i = 0;
  rows.forEach((r, row) => {
    const n = Math.min(caps[row], sorted.length - i);
    for (let col = 0; col < n; col++, i++) {
      const a = -Math.PI / 2 + (col - (n - 1) / 2) * (arc / Math.max(n, Math.min(caps[row], 8)));
      out.push({
        ...sorted[i],
        side: 1,
        row,
        col,
        x: Math.round(Math.cos(a) * r * 1000) / 1000,
        z: Math.round(Math.sin(a) * r * 1000) / 1000,
      });
    }
  });
  return { slots: out, archived: items.length - shown.length };
}

/** Brunnen und Anschlagbrett zwischen zwei Ausgängen, nahe der Front (+z). */
function plazaDecoSpots(plaza: { a: number; rot: number }) {
  const mids = Array.from(
    { length: DIRECTIONS },
    (_, k) => plaza.rot + ((k + 0.5) * TAU) / DIRECTIONS,
  );
  const front = (a: number) =>
    Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)));
  const [f1, f2] = mids.sort((a, b) => front(a) - front(b));
  // links (vom Betrachter aus) der Brunnen, rechts das Anschlagbrett
  const [left, right] = Math.cos(f1) < Math.cos(f2) ? [f1, f2] : [f2, f1];
  const r = plaza.a - 1.9;
  const f = polar(left, r);
  const n = polar(right, r);
  return { fountain: f, notice: { ...n, angle: Math.atan2(-n.x, -n.z) } };
}

export function generateWorld(input: WorldInput): World {
  const seed = input.seed;
  const version = input.version ?? GENERATOR_VERSION;
  const doc = input.doc ?? null;
  // Karte nach Generator-Version (v1 bleibt eingefroren, Golden-Test)
  const map = version >= 2 ? generateMapV2(seed) : generateMap(seed);
  const space = new Space(map);
  const zentrale = input.houses.find((h) => h.kind === "zentrale");
  const homes = input.houses.filter((h) => h.kind !== "zentrale");
  const order = new Map(homes.map((h, i) => [h.id, h.order ?? i]));

  const ring = zentrale ? zentraleRing(zentrale.items, map.plaza.a) : { slots: [], archived: 0 };
  const ringOuter = ring.slots.length
    ? Math.max(...ring.slots.map((s) => Math.hypot(s.x, s.z)))
    : 0;
  const terrace = ringOuter ? Math.round((ringOuter + 0.9) * 1000) / 1000 : 4.95;
  const plazaDeco = plazaDecoSpots(map.plaza);

  let dekoResult: ReturnType<typeof applyDeko> = { placed: [], rejected: [] };
  const settlement = placeSettlement(
    seed,
    space,
    homes.map((h) => ({ id: h.id, fach: h.fach, order: order.get(h.id) ?? 0 })),
    { quartiere: doc?.quartiere, haeuser: doc?.haeuser, keep: input.keepQuarters },
    () => {
      // Zonen am Dorfplatz, die eigene Deko frei lassen muss
      // Feste Grösse (nicht von der Objektzahl abhängig): Besucher sehen keine privaten Objekte und
      // müssen trotzdem dieselbe Welt rechnen wie der Besitzer
      space.addClaim({
        id: "terrasse",
        kind: "terrasse",
        shape: circle(0, 0, map.plaza.a - 4.0 + 1.3),
        label: "vor der Zentrale",
      });
      space.addClaim({
        id: "brunnen",
        kind: "terrasse",
        shape: circle(plazaDeco.fountain.x, plazaDeco.fountain.z, 1.9),
        label: "am Brunnen",
      });
      space.addClaim({
        id: "anschlagbrett",
        kind: "terrasse",
        shape: box(plazaDeco.notice.x, plazaDeco.notice.z, 1.6, 0.9, plazaDeco.notice.angle),
        label: "vor dem Anschlagbrett",
      });
      dekoResult = applyDeko(space, doc?.deko ?? []);
    },
  );

  const editSpace = space.clone();

  // Automatik weicht allem Gesetzten aus: Platz-Ausstattung, Hühnerhof, Laternen, Pflanzen
  const plazaProps = placePlazaProps(space, map, settlement, plazaDeco);
  const chickenRun = placeChickenRun(space, seed, map, settlement);
  const exits = settlement.lanes
    .filter((l) => l.primary || l.builtT > 0)
    .map((l) => dirAngle(map.plaza, l.dir));
  const lamps = placeLamps(space, seed, settlement.paths, map.plaza, exits, settlement.nodes);
  let settlementR = map.plaza.a + 6;
  for (const h of Object.values(settlement.houses))
    settlementR = Math.max(settlementR, Math.hypot(h.x, h.z) + 5);
  const vegetation = placeVegetation(
    space,
    seed,
    settlementR,
    map.plaza,
    exits,
    input.lowDetail ? 0.4 : 1,
    !input.lowDetail,
  );

  const layout = toLayout(map, settlement, input.houses, ring.slots, terrace);
  return {
    seed,
    version,
    map,
    settlement,
    layout,
    deko: dekoResult.placed,
    rejected: dekoResult.rejected,
    lamps,
    vegetation,
    editSpace,
    plazaDeco,
    plazaProps,
    chickenRun,
  };
}

/** Bänke an unbenutzten Ausgängen (zur Mitte gedreht) und Pflanzkübel zwischen den Ausgängen. */
function placePlazaProps(
  space: Space,
  map: WorldMap,
  s: Settlement,
  deco: World["plazaDeco"],
): World["plazaProps"] {
  const used = new Set(s.lanes.map((l) => l.dir));
  const benches: World["plazaProps"]["benches"] = [];
  const planters: World["plazaProps"]["planters"] = [];
  const free = (shape: ReturnType<typeof circle> | ReturnType<typeof box>) =>
    !space.conflict(shape, {
      margin: 0.3,
      pathClearance: 0.3,
      kinds: PROP_BLOCKERS,
      asKind: "deko",
    });
  for (let k = 0; k < DIRECTIONS; k++) {
    const a = dirAngle(map.plaza, k);
    if (!used.has(k)) {
      const p = polar(a, map.plaza.a - 1.5);
      const angle = Math.atan2(-Math.cos(a), -Math.sin(a));
      const shape = box(p.x, p.z, 0.65, 0.3, angle);
      if (free(shape)) {
        benches.push({ ...p, angle });
        space.addClaim({
          id: `platzbank-${k}`,
          kind: "deko",
          shape,
          label: "zu nah an einer Bank",
        });
      }
    }
    const mid = a + Math.PI / DIRECTIONS;
    const p = polar(mid, map.plaza.a - 1.3);
    const shape = circle(p.x, p.z, 0.65);
    const nearDeco =
      Math.hypot(p.x - deco.fountain.x, p.z - deco.fountain.z) < 3 ||
      Math.hypot(p.x - deco.notice.x, p.z - deco.notice.z) < 3;
    if (!nearDeco && free(shape)) {
      planters.push(p);
      space.addClaim({
        id: `kuebel-${k}`,
        kind: "deko",
        shape,
        label: "zu nah an einem Pflanzkübel",
      });
    }
  }
  return { benches, planters };
}

/** Hühnerhof in einer Lücke zwischen zwei Gassen, nahe am Dorf (sonst keiner). */
function placeChickenRun(
  space: Space,
  seed: string,
  map: WorldMap,
  s: Settlement,
): World["chickenRun"] {
  if (Object.keys(s.houses).length === 0) return null;
  const order = Array.from({ length: DIRECTIONS }, (_, k) => k).sort(
    (a, b) =>
      ((a * 7 + seed.charCodeAt(0)) % DIRECTIONS) - ((b * 7 + seed.charCodeAt(0)) % DIRECTIONS),
  );
  for (const k of order) {
    const mid = dirAngle(map.plaza, k) + Math.PI / DIRECTIONS;
    for (let r = map.plaza.a + 9; r < map.plaza.a + 30; r += 2) {
      const p = polar(mid, r);
      const shape = circle(p.x, p.z, 2.4);
      if (!space.conflict(shape, { margin: 0.6, pathClearance: 0.6, asKind: "deko" })) {
        space.addClaim({ id: "huehnerhof", kind: "merkmal", shape, label: "am Hühnerhof" });
        return { x: p.x, z: p.z, r: 2.0 };
      }
    }
  }
  return null;
}

const PROP_BLOCKERS = new Set([
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
] as const);

/** Übersetzt die Siedlung in das Layout-Format der Szene. */
function toLayout(
  map: WorldMap,
  s: Settlement,
  houses: LayoutHouse[],
  ring: PlotSlot[],
  terrace: number,
): VillageLayout {
  const out: Record<string, HouseLayout> = {};
  const zentrale = houses.find((h) => h.kind === "zentrale");
  if (zentrale) {
    out[zentrale.id] = {
      id: zentrale.id,
      x: 0,
      z: 0,
      angle: 0,
      tier: 3,
      footprint: ZENTRALE_FOOTPRINT,
      plot: null,
      ring: ring.length ? ring : null,
      quarterId: null,
      side: 0,
    };
  }
  const byId = new Map(houses.map((h) => [h.id, h]));
  for (const p of Object.values(s.houses)) {
    const h = byId.get(p.id)!;
    const tier = houseTier(h.items.length);
    const { slots } = plotSlots(h.items);
    const plot: Plot = { hw: PLOT.hw, front: PLOT.front, back: PLOT.back, slots };
    out[p.id] = {
      id: p.id,
      x: Math.round(p.x * 1000) / 1000,
      z: Math.round(p.z * 1000) / 1000,
      angle: Math.round(p.angle * 1000) / 1000,
      tier,
      footprint: TIER_FOOTPRINT[tier],
      plot,
      ring: null,
      quarterId: p.quarterId,
      side: p.angle + Math.PI,
    };
  }

  // Quartiere: Mittelpunkt = Quartierplatz (bzw. erste Gasse), Radius über alle Häuser
  const quarters: QuarterLayout[] = [];
  const polys: PlazaPoly[] = [];
  const quarterIds = [...new Set(s.lanes.map((l) => l.quarterId))];
  for (const q of quarterIds) {
    const lanes = s.lanes.filter((l) => l.quarterId === q);
    const primary = lanes.find((l) => l.primary) ?? lanes[0];
    const node = s.nodes.find((n) => n.quarterId === q);
    const ids = Object.values(s.houses)
      .filter((h) => h.quarterId === q)
      .sort((a, b) => a.dir - b.dir || a.t - b.t || slotRank(a.slot) - slotRank(b.slot))
      .map((h) => h.id);
    const cx = node ? node.x : primary.axis[Math.min(primary.axis.length - 1, 20)].x;
    const cz = node ? node.z : primary.axis[Math.min(primary.axis.length - 1, 20)].z;
    let radius = NODE_RP + 1;
    for (const id of ids) radius = Math.max(radius, Math.hypot(out[id].x - cx, out[id].z - cz) + 5);
    const theta = Math.atan2(cz, cx);
    quarters.push({
      id: q,
      name: FACHBEREICHE[q].name,
      index: quarterIndex(q),
      x: Math.round(cx * 1000) / 1000,
      z: Math.round(cz * 1000) / 1000,
      theta,
      rp: NODE_RP,
      radius,
      houseIds: ids,
      mainSide: dirAngle(map.plaza, primary.dir),
      entrySide: node ? node.entry : theta + Math.PI,
    });
    if (node) {
      const h = node.entry + Math.PI;
      const used = [node.entry];
      const lane = s.lanes.find((l) => l.quarterId === q && l.primary)!;
      if (lane.builtT > lane.nodeT + NODE_RP) used.push(h);
      if (lane.slots.p0) used.push(h + Math.PI / 2);
      if (lane.slots.p1) used.push(h - Math.PI / 2);
      polys.push({
        x: node.x,
        z: node.z,
        a: NODE_RP,
        n: NODE_N,
        rot: node.entry,
        used,
        gap: 3.0,
        main: false,
        quarterId: q,
      });
    }
  }
  const exits = s.lanes.map((l) => dirAngle(map.plaza, l.dir));
  polys.unshift({
    x: 0,
    z: 0,
    a: map.plaza.a,
    n: map.plaza.n,
    rot: map.plaza.rot,
    used: exits,
    gap: 3.6,
    main: true,
    quarterId: null,
  });

  let extent = map.plaza.a + 12;
  for (const h of Object.values(out))
    if (h.plot) extent = Math.max(extent, Math.hypot(h.x, h.z) + 6);
  for (const n of s.nodes) extent = Math.max(extent, Math.hypot(n.x, n.z) + 6);
  return {
    houses: out,
    quarters: quarters.sort((a, b) => a.index - b.index),
    polys,
    paths: [...s.paths.map((p) => ({ ...p })), ...trailPaths(map)],
    plazaRadius: map.plaza.a,
    terrace,
    extent: Math.round(Math.max(24, extent + 4) * 1000) / 1000,
  };
}

/** Wanderweg als Fusspfad, ohne das Stück auf der Brücke (dort liegen die Bretter). */
function trailPaths(map: WorldMap): VillageLayout["paths"] {
  if (!map.trail) return [];
  const b = map.bridge;
  const parts: Pt[][] = [[]];
  for (const p of map.trail) {
    if (b && Math.hypot(p.x - b.x, p.z - b.z) < b.span / 2 + 0.2) {
      if (parts[parts.length - 1].length) parts.push([]);
    } else parts[parts.length - 1].push(p);
  }
  return parts
    .filter((pts) => pts.length > 1)
    .map((points, i) => ({
      id: `pfad-${i}`,
      kind: "pfad" as const,
      ownerId: "pfad",
      quarterIndex: null,
      points,
      width: TRAIL_WIDTH,
      seed: 7 + i,
    }));
}

/** Reihenfolge der Bauplätze für Listen und Tastatur: Quartierplatz zuerst, dann die Gasse hinaus. */
const slotRank = (k: string) => (k === "p0" ? -2 : k === "p1" ? -1 : Number(k.slice(1)));

export type { FachbereichId };

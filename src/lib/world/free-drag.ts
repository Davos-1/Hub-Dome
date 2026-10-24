/**
 * Häuser frei ziehen und Quartiere verschieben (Generator v2, P1) als reine Logik: Prüfwelt ohne die gezogenen
 * Elemente, Einrasten auf ein feines Raster und an Nachbarn, Gruppenverschiebung mit Grenze. Dieselben Regeln
 * wie Generator und Server (`settlement.ts`).
 */

import type { FachbereichId } from "../fachbereiche";
import type { DekoItem, WorldDoc } from "./doc";
import { generateWorld, type World, type WorldInput } from "./generate";
import { checkDeko } from "./rules";
import {
  AREA_MAX,
  checkFreeGroup,
  checkFreeHouse,
  freePose,
  pickLane,
  pinsFromSettlement,
  PLOT,
  spineAt,
  type Lane,
  type Settlement,
} from "./settlement";
import type { Space } from "./space";

/** Prüfwelt beim Ziehen: Welt ohne die gezogenen Häuser (und ggf. ihre Deko), alle übrigen bleiben fixiert. */
export type DragBase = {
  space: Space;
  settlement: Settlement;
  /** Gassen des Quartiers (Rückgrat bleibt fix). */
  lanes: Lane[];
  quarterId: FachbereichId;
};

/** Auf 1 cm runden: so wird die Lage gespeichert und vom Server geprüft. */
const cm = (v: number) => Math.round(v * 100) / 100;

/**
 * Prüfwelt aus der aktuellen (Entwurfs-)Welt: Alle Quartiere und Häuser bleiben, wo sie sind (fixiert), nur
 * die gezogenen Häuser und die mitbewegte Deko fehlen.
 */
export function dragBase(
  input: WorldInput,
  world: World,
  quarterId: FachbereichId,
  exclude: ReadonlySet<string>,
  excludeDeko: ReadonlySet<string> = new Set(),
): DragBase {
  const doc: WorldDoc = input.doc ?? { v: 1 };
  const pins = pinsFromSettlement(world.settlement);
  const haeuser = Object.fromEntries(
    Object.entries(pins.haeuser).filter(([id]) => !exclude.has(id)),
  );
  const base = generateWorld({
    ...input,
    lowDetail: true,
    keepQuarters: [quarterId],
    houses: input.houses.filter((h) => !exclude.has(h.id)),
    doc: {
      ...doc,
      quartiere: pins.quartiere,
      haeuser,
      deko: world.deko.filter((d) => !excludeDeko.has(d.id)),
    },
  });
  return {
    space: base.editSpace,
    settlement: base.settlement,
    lanes: base.settlement.lanes.filter((l) => l.quarterId === quarterId),
    quarterId,
  };
}

export type HouseGhost =
  | { ok: true; x: number; z: number; angle: number; dir: number; snapped: boolean }
  | { ok: false; x: number; z: number; angle: number; grund: string };

/** Punkt in Gassenkoordinaten (Bogenlänge t, Abstand d) zurück in die Welt. */
function fromSpine(lane: Lane, t: number, d: number) {
  const i = Math.max(0, Math.min(lane.axis.length - 2, Math.floor(t / 0.5)));
  const a = lane.axis[i];
  const b = lane.axis[i + 1];
  const f = Math.max(0, Math.min(1, (t - lane.acc[i]) / 0.5));
  const h = Math.atan2(b.z - a.z, b.x - a.x);
  return { x: a.x + (b.x - a.x) * f - Math.sin(h) * d, z: a.z + (b.z - a.z) * f + Math.cos(h) * d };
}

/**
 * Einrasten einer Hauslage: in Gassenkoordinaten auf 0.5 m, an Nachbarn derselben Seite (gleicher Abstand zur
 * Gasse, Standardlücke 1.4 m zwischen Grundstücken).
 */
export function snapToRow(base: DragBase, houseId: string, x: number, z: number) {
  if (!base.lanes.length) return { x, z };
  const lane = pickLane(base.lanes, x, z);
  // v3: nahe am Platz von Ring, Halbkreis und Intelligent gibt es keine Reihe an der Gasse
  if (freePose(lane, x, z).polar) return { x, z };
  const s = spineAt(lane, x, z);
  let t = Math.round(s.t * 2) / 2;
  let d = Math.round(s.d * 2) / 2;
  const width = PLOT.hw * 2;
  for (const h of Object.values(base.settlement.houses)) {
    if (h.id === houseId || h.dir !== lane.dir) continue;
    const o = spineAt(lane, h.x, h.z);
    if (Math.sign(o.d) !== Math.sign(d) || Math.abs(o.t - t) > width + 3) continue;
    if (Math.abs(o.d - d) < 0.8) d = o.d;
    const gap = Math.abs(t - o.t) - width;
    if (gap > 0.6 && gap < 2.0) t = o.t + Math.sign(t - o.t) * (width + 1.4);
  }
  // Einrasten bleibt nah am Zeiger (am Ende der Gasse oder weit weg gibt es nichts einzurasten)
  const p = fromSpine(lane, Math.max(0, t), d);
  return Math.hypot(p.x - x, p.z - z) <= 2 ? p : { x, z };
}

/**
 * Live-Prüfung beim Ziehen eines Hauses: gültig (ggf. eingerastet, höchstens 3 m) oder rot mit Grund. Die
 * Ausrichtung ist automatisch (Tor zum nächsten Weganschluss).
 */
export function houseGhost(base: DragBase, houseId: string, x: number, z: number): HouseGhost {
  const raw = snapToRow(base, houseId, x, z);
  const s = { x: cm(raw.x), z: cm(raw.z) };
  const first = checkFreeHouse(base.space, base.settlement, houseId, base.quarterId, s.x, s.z);
  if (first.ok)
    return {
      ok: true,
      x: first.pose.x,
      z: first.pose.z,
      angle: first.pose.angle,
      dir: first.dir,
      snapped: Math.hypot(s.x - x, s.z - z) > 0.05,
    };
  for (let r = 0.5; r <= 3.0001; r += 0.5) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const c = checkFreeHouse(
        base.space,
        base.settlement,
        houseId,
        base.quarterId,
        cm(s.x + Math.cos(a) * r),
        cm(s.z + Math.sin(a) * r),
      );
      if (c.ok)
        return {
          ok: true,
          x: c.pose.x,
          z: c.pose.z,
          angle: c.pose.angle,
          dir: c.dir,
          snapped: true,
        };
    }
  }
  // Rot an der Zeigerstelle, gleich ausgerichtet wie ein gültiges Haus dort
  const lane = base.lanes.length ? pickLane(base.lanes, x, z) : null;
  return { ok: false, x, z, angle: lane ? freePose(lane, x, z).angle : 0, grund: first.grund };
}

export type GroupGhost = {
  /** Verschiebung, die gilt (ggf. bis zur Grenze gekürzt). */
  dx: number;
  dz: number;
  /** Ganz verschoben, nur bis zur Grenze, oder gar nicht. */
  state: "ok" | "grenze" | "nein";
  /** Lagen der Häuser bei der geltenden Verschiebung. */
  poses: Record<string, { x: number; z: number; angle: number; dir: number }>;
  /** Grund, warum die gewünschte Verschiebung nicht ganz geht (erstes Element, das anstösst). */
  grund?: string;
  /** Deko des Quartiers bei der geltenden Verschiebung. */
  deko: DekoItem[];
};

/**
 * Quartier genau um (dx, dz) verschieben, ohne Einrasten: alle Häuser (samt Garten) und die eigene Deko des
 * Quartiers. Gültig nur, wenn jedes Element an seiner neuen Lage passt (gegen alles übrige und gegen die
 * Gruppe selbst); sonst das erste anstossende Element mit Grund. Im Bau-Modus: Ablegen an ungültiger Stelle
 * setzt das Quartier zurück.
 */
export const quarterMove = (
  base: DragBase,
  houses: { id: string; x: number; z: number }[],
  deko: DekoItem[],
  dx: number,
  dz: number,
) => tryGroup(base, houses, deko, dx, dz);

function tryGroup(
  base: DragBase,
  houses: { id: string; x: number; z: number }[],
  deko: DekoItem[],
  dx: number,
  dz: number,
) {
  const g = checkFreeGroup(
    base.space,
    base.settlement,
    base.quarterId,
    houses.map((h) => ({ id: h.id, x: cm(h.x + dx), z: cm(h.z + dz) })),
  );
  if (!g.ok) return { ok: false as const, grund: g.grund, id: g.id };
  const moved = deko.map((d) => ({
    ...d,
    x: Math.round((d.x + dx) * 4) / 4,
    z: Math.round((d.z + dz) * 4) / 4,
  }));
  for (const d of moved) {
    const c = checkDeko(g.space, d);
    if (c) return { ok: false as const, grund: c.grund, id: d.id };
  }
  return { ok: true as const, poses: g.poses, deko: moved };
}

/**
 * Quartier als Ganzes verschieben: alle Häuser (samt Garten) und die eigene Deko des Quartiers um denselben
 * Vektor (Raster 0.5 m). Geht das nicht ganz, rastet die Gruppe auf die nächste gültige Verschiebung ein
 * (sonst bis zur Grenze in derselben Richtung); der Grund des ersten anstossenden Elements wird genannt. Verbindungspunkte (Dorfplatz-Ausgang, Quartierplatz, Gassenachse)
 * bleiben, wo sie sind.
 */
export function groupGhost(
  base: DragBase,
  houses: { id: string; x: number; z: number }[],
  deko: DekoItem[],
  dx: number,
  dz: number,
  label: (id: string) => string = (id) => id,
): GroupGhost {
  const sx = Math.round(dx * 2) / 2;
  const sz = Math.round(dz * 2) / 2;
  const full = tryGroup(base, houses, deko, sx, sz);
  if (full.ok) return { dx: sx, dz: sz, state: "ok", poses: full.poses, deko: full.deko };
  const grund = `${label(full.id)}: ${full.grund}`;
  // Einrasten: gültige Verschiebung (Raster 0.5 m), die der gewünschten am nächsten liegt; nur solche, die
  // näher daran sind als «gar nicht verschieben» (also nie entgegen der Zugrichtung)
  const L = Math.hypot(sx, sz);
  const R = Math.floor(L / 0.5);
  const cands: { x: number; z: number; d: number }[] = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      const x = i * 0.5;
      const z = j * 0.5;
      const d = Math.hypot(x - sx, z - sz);
      if ((i || j) && d < L - 1e-9) cands.push({ x, z, d });
    }
  cands.sort((a, b) => a.d - b.d || Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (const c of cands.slice(0, 48)) {
    const t = tryGroup(base, houses, deko, c.x, c.z);
    if (t.ok) return { dx: c.x, dz: c.z, state: "grenze", poses: t.poses, deko: t.deko, grund };
  }
  // Sonst: grösster gültiger Anteil in derselben Richtung (Halbieren, dann auf 0.5 m)
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    if (tryGroup(base, houses, deko, sx * mid, sz * mid).ok) lo = mid;
    else hi = mid;
  }
  const len = Math.hypot(sx, sz) * lo;
  const steps = Math.floor(len / 0.5);
  const k = len > 0 ? (steps * 0.5) / Math.hypot(sx, sz) : 0;
  const part = tryGroup(base, houses, deko, sx * k, sz * k);
  if (k > 0 && part.ok)
    return { dx: sx * k, dz: sz * k, state: "grenze", poses: part.poses, deko: part.deko, grund };
  const zero = tryGroup(base, houses, deko, 0, 0);
  return {
    dx: 0,
    dz: 0,
    state: "nein",
    poses: zero.ok ? zero.poses : {},
    deko: zero.ok ? zero.deko : deko,
    grund,
  };
}

/** Eigene Deko eines Quartiers: Elemente in der Quartierfläche (nächste Gasse gehört zum Quartier). */
export function quarterDeko(world: World, quarterId: FachbereichId): DekoItem[] {
  const own = world.settlement.lanes.filter((l) => l.quarterId === quarterId);
  if (!own.length) return [];
  return world.deko.filter((d) => {
    let best = { q: null as FachbereichId | null, dist: Infinity };
    for (const l of world.settlement.lanes) {
      const s = spineAt(l, d.x, d.z);
      if (s.dist < best.dist) best = { q: l.quarterId, dist: s.dist };
    }
    return best.q === quarterId && best.dist <= AREA_MAX;
  });
}

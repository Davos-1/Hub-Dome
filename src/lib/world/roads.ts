/**
 * Wegformen eines Quartiers (Generator v3, Phase 4h) als reine Geometrie: Kernweg und Bauplätze rund um den
 * Quartierplatz, Wegvarianten vom Gartentor zum Weg. Ob etwas wirklich passt (Grundstücke, Wasser, andere
 * Wege), prüft die Siedlung mit dem Belegungsregister (`settlement.ts`); hier entsteht nur die Form.
 *
 * - **Gasse:** wie v2 (Häuser beidseits der Gasse, die vom Quartierplatz hinausführt).
 * - **Ring:** Ringweg um den Quartierplatz, Häuser aussen daran, Front zur Mitte.
 * - **Halbkreis:** Bogen auf der dem Dorfplatz abgewandten Seite, zwei Speichen zum Platz, Häuser aussen.
 * - **Intelligent:** Häuser in Reihen um den Platz, jedes mit eigenem geschwungenem Weg zum Platz; kommt ein
 *   Weg einem anderen nahe, mündet er in ihn.
 */

import { NODE_RP } from "./axes";
import { angDiff, polylineLength, resample, TAU, type Pt } from "./geom";
import { CORRIDOR_HW, GATE_GAP, LANE_WIDTH, NODE_N, PLOT } from "./plot";

export const WEGFORMEN = ["intelligent", "ring", "halbkreis", "gasse"] as const;
export type Wegform = (typeof WEGFORMEN)[number];
export const WEGFORM_LABELS: Record<Wegform, string> = {
  intelligent: "Intelligent",
  ring: "Ring",
  halbkreis: "Halbkreis",
  gasse: "Gasse",
};

/** Radius von Ring und Halbkreis (Mitte des Wegs, Meter). */
export const RADIUS = { min: 5, max: 12, start: 7 } as const;
/** Krümmung der Wege bei «Intelligent». */
export const KURVEN = ["gerade", "sanft", "mittel", "stark"] as const;
export const KURVE_START = 1;
/** Seitliche Auslenkung je Stufe (Anteil der Weglänge). */
const BOW = [0, 0.1, 0.18, 0.26] as const;

/** Wegform eines Quartiers, wie sie im Welt-Dokument steht. */
export type QuarterRoad = { form: Wegform; radius?: number; curve?: number };

export const roadRadius = (r: QuarterRoad) =>
  Math.max(RADIUS.min, Math.min(RADIUS.max, Math.round(r.radius ?? RADIUS.start)));
export const roadCurve = (r: QuarterRoad) =>
  Math.max(0, Math.min(KURVEN.length - 1, Math.round(r.curve ?? KURVE_START)));
export const isPolar = (f: Wegform | undefined) => !!f && f !== "gasse";

/** Mitte des Quartierplatzes und Richtung nach aussen (vom Dorfplatz weg, Bogenmass). */
export type QuarterFrame = { x: number; z: number; h: number };

/** Umkreis des achteckigen Quartierplatzes. */
export const NODE_CR = NODE_RP / Math.cos(Math.PI / NODE_N);
/** Hausmitte bis Weg-Mitte bei Häusern an Ring und Halbkreis (wie an der Gasse). */
const RING_OFF = LANE_WIDTH / 2 + GATE_GAP + PLOT.front;
/** Intelligent: Abstand Tor → Platzrand in der ersten Reihe, Reihenabstand (Grundstück plus Weg). */
const SMART_GAP = 4.0;
const SMART_ROW = PLOT.front + PLOT.back + 2.6;
const SMART_ROWS = 3;
/** Lücke zwischen Grundstücken einer Reihe (Ring: wie an der Gasse, Intelligent: Platz für einen Weg). */
const GAP_RING = 1.4;
const GAP_SMART = 3.2;
/** Häuser bleiben so weit von der eigenen Achse weg, dass die Gasse für weitere Häuser frei bleibt. */
const AXIS_CLEAR = CORRIDOR_HW + 0.35;

/** Punkt in Richtung `h + phi` im Abstand `r` von der Mitte. */
export const around = (f: QuarterFrame, phi: number, r: number): Pt => ({
  x: f.x + Math.cos(f.h + phi) * r,
  z: f.z + Math.sin(f.h + phi) * r,
});

/** Bogen von `a0` bis `a1` (relativ zu `h`), etwa alle 0.5 m ein Punkt. */
function arc(f: QuarterFrame, r: number, a0: number, a1: number): Pt[] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 0.5));
  return Array.from({ length: n + 1 }, (_, i) => around(f, a0 + ((a1 - a0) * i) / n, r));
}

/**
 * Kernweg einer Wegform: Ring als zwei Bögen (nah und fern, damit kein geschlossener Linienzug entsteht),
 * Halbkreis als ferner Bogen plus zwei Speichen zum Platz. Gasse und Intelligent haben keinen Kernweg.
 */
export function coreRoads(f: QuarterFrame, road: QuarterRoad): Pt[][] {
  const R = roadRadius(road);
  if (road.form === "ring")
    return [arc(f, R, -Math.PI / 2, Math.PI / 2), arc(f, R, Math.PI / 2, (3 * Math.PI) / 2)];
  if (road.form === "halbkreis") {
    const spoke = (s: 1 | -1) =>
      resample(
        [around(f, (s * Math.PI) / 2, R), around(f, (s * Math.PI) / 2, NODE_RP - 0.15)],
        0.5,
      );
    return [arc(f, R, -Math.PI / 2, Math.PI / 2), spoke(1), spoke(-1)];
  }
  return [];
}

/** Ein Bauplatz rund um den Quartierplatz (Front zur Mitte). */
export type PolarSlot = {
  key: `k${number}`;
  row: number;
  /** Winkel relativ zur Richtung nach aussen. */
  phi: number;
  x: number;
  z: number;
  angle: number;
};

/** Reihen einer Wegform: Abstand der Hausmitte, Lücke, grösster Winkel zur Richtung nach aussen. */
function rows(road: QuarterRoad): { rho: number; gap: number; max: number }[] {
  if (road.form === "ring" || road.form === "halbkreis") {
    // Halbkreis: Häuser auch etwas seitlich der Bogenenden (sie hängen an den Speichen)
    const max = road.form === "ring" ? Math.PI : 0.62 * Math.PI;
    return [{ rho: roadRadius(road) + RING_OFF, gap: GAP_RING, max }];
  }
  if (road.form === "intelligent") {
    const rho0 = NODE_CR + SMART_GAP + PLOT.front;
    return Array.from({ length: SMART_ROWS }, (_, i) => ({
      rho: rho0 + i * SMART_ROW,
      gap: GAP_SMART,
      max: 0.62 * Math.PI,
    }));
  }
  return [];
}

/**
 * Bauplätze rund um den Quartierplatz, in der Reihenfolge, in der Häuser sie belegen: innere Reihe zuerst,
 * jeweils nahe der Achse beginnend, abwechselnd links und rechts. Die eigene Achse bleibt frei (dort kann die
 * Gasse für weitere Häuser hinausführen); ungerade Reihen sind um einen halben Schritt versetzt, damit ihre
 * Wege durch die Lücken der inneren Reihe führen.
 */
export function polarSlots(f: QuarterFrame, road: QuarterRoad): PolarSlot[] {
  const out: PolarSlot[] = [];
  rows(road).forEach(({ rho, gap, max }, row) => {
    const rIn = rho - PLOT.front;
    const step = 2 * Math.atan((PLOT.hw + gap / 2) / rIn);
    // Kleinster Winkel, bei dem die innere Ecke des Grundstücks die Achse freilässt
    const phi0 =
      Math.asin(Math.min(1, AXIS_CLEAR / Math.hypot(rIn, PLOT.hw))) + Math.atan(PLOT.hw / rIn);
    const start = phi0 + (row % 2 ? step / 2 : 0);
    // Hinten (zum Dorfplatz) treffen sich die Plätze von links und rechts nie
    const lim = Math.min(max, Math.PI - step / 2);
    for (let m = 0; start + m * step <= lim + 1e-9; m++) {
      for (const s of [1, -1]) {
        const phi = s * (start + m * step);
        const p = around(f, phi, rho);
        out.push({
          key: `k${out.length}`,
          row,
          phi,
          x: p.x,
          z: p.z,
          angle: Math.atan2(f.x - p.x, f.z - p.z),
        });
      }
    }
  });
  return out;
}

/**
 * Wegform eines Quartiers als Ganzes: Kernweg, Bauplätze und der Bereich, in dem Häuser zur Mitte schauen
 * (`reach`, Abstand der Hausmitte zur Platzmitte). Grundlage für Siedlung, Bau-Modus und Tests.
 */
export function roadsForQuarter(f: QuarterFrame, road: QuarterRoad) {
  const slots = polarSlots(f, road);
  const outer = rows(road).at(-1)?.rho ?? 0;
  return {
    core: coreRoads(f, road),
    slots,
    reach: isPolar(road.form) ? outer + 3 : 0,
    /** Bogenlänge auf der Achse, ab der eine Gasse für weitere Häuser beginnt (Ring, Halbkreis). */
    coreEnd: road.form === "ring" || road.form === "halbkreis" ? roadRadius(road) : 0,
  };
}

/** Nächster Punkt auf mehreren Linienzügen. */
export function nearestOnPaths(paths: Pt[][], p: Pt): { pt: Pt; d: number; path: number } {
  let best = { pt: p, d: Infinity, path: -1 };
  paths.forEach((pts, k) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
      const q = { x: a.x + dx * t, z: a.z + dz * t };
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < best.d) best = { pt: q, d, path: k };
    }
  });
  return best;
}

/** Endpunkt eines Wegs am Rand des Zielwegs (überlappt ihn leicht, damit kein Grasspalt bleibt). */
function edgeEnd(target: Pt, from: Pt, reach: number): Pt {
  const dx = from.x - target.x;
  const dz = from.z - target.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: target.x + (dx / l) * reach, z: target.z + (dz / l) * reach };
}

/**
 * Wegvarianten vom Tor zum Kernweg (Ring, Halbkreis): gerade zum nächsten Punkt, mit Eckpunkt über diesen.
 * `null`, wenn das Tor schon am Weg liegt.
 */
export function coreSpur(gate: Pt, core: Pt[][], bend?: Pt | null): Pt[] | null {
  if (!core.length) return null;
  const via = bend ?? gate;
  const n = nearestOnPaths(core, via);
  const end = edgeEnd(n.pt, via, LANE_WIDTH / 2 - 0.15);
  if (!bend && Math.hypot(gate.x - end.x, gate.z - end.z) < 0.15) return null;
  return resample(bend ? [gate, bend, end] : [gate, end], 0.5);
}

/** Quadratische Kurve von `a` nach `b`, seitlich um `bow` (Anteil der Länge) ausgelenkt. */
function curve(a: Pt, b: Pt, bow: number): Pt[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const c = { x: (a.x + b.x) / 2 - dz * bow, z: (a.z + b.z) / 2 + dx * bow };
  const n = Math.max(2, Math.ceil(len / 0.5));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      z: u * u * a.z + 2 * u * t * c.z + t * t * b.z,
    };
  });
}

/** Mitte der Platzseite, die zu `p` zeigt (dort ist der Randstein offen). */
export function nodeDoor(f: QuarterFrame, p: Pt): { pt: Pt; side: number } {
  const entry = f.h + Math.PI;
  const a = Math.atan2(p.z - f.z, p.x - f.x);
  const k = Math.round((a - entry) / (TAU / NODE_N));
  const side = entry + (k * TAU) / NODE_N;
  return {
    pt: { x: f.x + Math.cos(side) * (NODE_RP - 0.15), z: f.z + Math.sin(side) * (NODE_RP - 0.15) },
    side,
  };
}

export type SmartPath = { pts: Pt[]; merge: boolean; bow: number };

/**
 * Wegvarianten für «Intelligent» vom Tor (Front `front`) zum Quartierplatz, beste zuerst: zuerst in einen
 * nahen Weg in ähnlicher Richtung münden, sonst direkt zur nächsten Platzseite; jeweils mit der gewünschten
 * Krümmung, dann schwächer, in beide Richtungen. Ein Eckpunkt `bend` wird immer durchlaufen. Der erste Meter
 * führt gerade aus dem Tor.
 */
export function smartPaths(
  f: QuarterFrame,
  gate: Pt,
  front: Pt,
  curveLevel: number,
  trunks: readonly Pt[][],
  bend?: Pt | null,
): SmartPath[] {
  const stub = { x: gate.x + front.x, z: gate.z + front.z };
  const from = bend ?? stub;
  const dist = Math.hypot(from.x - f.x, from.z - f.z);
  const th = Math.atan2(from.z - f.z, from.x - f.x);
  // Mündungen: Punkte auf bestehenden Wegen, näher als der Platz und in ähnlicher Richtung
  const merges: Pt[] = [];
  for (const t of trunks) {
    let best: { p: Pt; d: number } | null = null;
    for (const q of resample(t, 1)) {
      const rq = Math.hypot(q.x - f.x, q.z - f.z);
      if (rq < NODE_CR + 2) continue;
      if (angDiff(Math.atan2(q.z - f.z, q.x - f.x), th) > 0.8) continue;
      const d = Math.hypot(q.x - from.x, q.z - from.z);
      if (d < 1.5 || d > dist * 0.8) continue;
      if (!best || d < best.d) best = { p: q, d };
    }
    if (best) merges.push(best.p);
  }
  merges.sort(
    (a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z),
  );
  const door = nodeDoor(f, from).pt;
  const levels = [
    ...new Set([curveLevel, curveLevel - 1, curveLevel - 2, 0].filter((l) => l >= 0)),
  ];
  // Richtung der Auslenkung: von der eigenen Achse weg (dort bleibt Platz für eine Gasse); fest pro Lage
  const side = Math.sin(th - f.h) >= 0 ? 1 : -1;
  const head = bend ? [gate, stub, bend] : [gate, stub];
  const out: SmartPath[] = [];
  for (const [target, merge] of [
    ...merges.slice(0, 2).map((m) => [m, true] as const),
    [door, false] as const,
  ]) {
    for (const l of levels)
      for (const s of l ? [side, -side] : [1]) {
        const tail = curve(from, target, BOW[l] * s);
        out.push({ pts: resample([...head.slice(0, -1), ...tail], 0.5), merge, bow: l * s });
      }
  }
  return out.filter((p) => polylineLength(p.pts) > 0.3);
}

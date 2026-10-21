/**
 * Deterministisches Dorf-Layout (PLAN.md Abschnitt 7): Zentrale im Ursprung, Häuser auf Ringen.
 * Gleiche Daten ergeben immer dasselbe Dorf – keine Zufallswerte, kein Date.now().
 */

import { computePaths, type VillagePath } from "./paths";

export type LayoutHouse = { id: string; kind: "zentrale" | "modul" | "thema" };

export type Tier = 1 | 2 | 3;

export type HouseLayout = {
  id: string;
  x: number;
  z: number;
  /** Drehung um Y, sodass die lokale +z-Achse (Hausfront) zur Zentrale zeigt. */
  angle: number;
  ring: number;
  tier: Tier;
  /** Halbe Grundrissbreite des Hauses (für Abstände und Objekt-Slots). */
  footprint: number;
};

export type VillageLayout = {
  houses: Record<string, HouseLayout>;
  /** Wege von der Dorfplatz-Kante zu den Haustüren (organisch, berühren sich nicht). */
  paths: VillagePath[];
  /** Radius des Dorfplatzes (wächst bei sehr vielen Häusern, damit alle Wege Platz haben). */
  plazaRadius: number;
  /** Radius des äusseren Rings samt Rand (für Kamera und Begrenzung). */
  extent: number;
};

/** Bis zu dieser Anzahl stehen alle Häuser auf einem Ring; ab dem 8. Haus kommt ein zweiter Ring dazu. */
const SINGLE_RING_MAX = 7;
const FIRST_RING_EXTENT = 8;
const BASE_RADIUS = 12;
/** Abstand der beiden Ringe (Meter): genug für grosse Häuser samt Objektbögen. */
const RING_GAP = 13;
/** Nötiger seitlicher Abstand eines Wegs zu einem Haus samt Objektbogen (Meter). */
const PATH_CLEARANCE = 5.6;

/** Hausgrösse wächst mit der Anzahl Objekte: 0–2 klein, 3–6 mittel, 7+ gross. */
export function houseTier(artifactCount: number): Tier {
  if (artifactCount >= 7) return 3;
  if (artifactCount >= 3) return 2;
  return 1;
}

const TIER_FOOTPRINT: Record<Tier, number> = { 1: 1.1, 2: 1.5, 3: 1.9 };
export const ZENTRALE_FOOTPRINT = 2.3;
/** Mindestradius des Dorfplatzes, an dessen Rand die Wege beginnen. */
export const PLAZA_EDGE = ZENTRALE_FOOTPRINT + 3.9;
/** Platz, den jeder Weg am Rand des Dorfplatzes braucht (Breite plus Lücke). */
const PATH_SLOT = 1.95;

export function computeLayout(
  houses: LayoutHouse[],
  artifactCounts: Record<string, number>,
): VillageLayout {
  const result: Record<string, HouseLayout> = {};

  const zentrale = houses.find((h) => h.kind === "zentrale");
  if (zentrale) {
    result[zentrale.id] = {
      id: zentrale.id,
      x: 0,
      z: 0,
      angle: 0,
      ring: 0,
      tier: 3,
      footprint: ZENTRALE_FOOTPRINT,
    };
  }

  // Reihenfolge der Eingabe bleibt erhalten (der Aufrufer sortiert nach position_index).
  const others = houses.filter((h) => h.kind !== "zentrale");
  const n = others.length;
  const plazaRadius = Math.max(PLAZA_EDGE, round((n * PATH_SLOT) / (2 * Math.PI)));

  // Bis 7 Häuser: ein Ring. Danach zwei Ringe, Häuser wechseln sich ab (gerade Position = innen,
  // ungerade = aussen) und stehen auf Lücke. So führt kein Weg durch ein anderes Haus.
  const twoRings = n > SINGLE_RING_MAX;
  const inner = twoRings ? Math.ceil(n / 2) : n;
  const innerRadius = twoRings
    ? Math.max(BASE_RADIUS, plazaRadius + 8, PATH_CLEARANCE / Math.sin(Math.PI / inner))
    : BASE_RADIUS;
  const outerRadius = innerRadius + RING_GAP;

  const place = (h: LayoutHouse, ring: number, radius: number, theta: number) => {
    const x = round(radius * Math.cos(theta));
    const z = round(radius * Math.sin(theta));
    const tier = houseTier(artifactCounts[h.id] ?? 0);
    result[h.id] = {
      id: h.id,
      x,
      z,
      angle: round(Math.atan2(-x, -z)),
      ring,
      tier,
      footprint: TIER_FOOTPRINT[tier],
    };
  };

  // Start unten (+z, zur Kamera), im Uhrzeigersinn.
  const start = Math.PI / 2;
  others.forEach((h, i) => {
    if (!twoRings) {
      place(h, 1, innerRadius, start + (2 * Math.PI * i) / n);
    } else if (i % 2 === 0) {
      place(h, 1, innerRadius, start + (2 * Math.PI * (i / 2)) / inner);
    } else {
      place(h, 2, outerRadius, start + Math.PI / inner + (2 * Math.PI * ((i - 1) / 2)) / inner);
    }
  });

  const outer = n === 0 ? 0 : twoRings ? outerRadius : innerRadius;
  const paths = computePaths(Object.values(result), plazaRadius);
  return {
    houses: result,
    paths,
    plazaRadius,
    extent: Math.max(outer, FIRST_RING_EXTENT) + 8,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export type Slot = { x: number; y: number; z: number };

/**
 * Plätze für Objekte im lokalen Hausraster (+z = Richtung Zentrale):
 * Bögen vor dem Haus, pro Reihe mehr Platz und weiter aussen.
 */
export function artifactSlots(count: number, footprint: number): Slot[] {
  const slots: Slot[] = [];
  let row = 0;
  while (slots.length < count) {
    const capacity = 5 + row * 2;
    const inRow = Math.min(capacity, count - slots.length);
    const radius = footprint + 1.3 + row * 1.3;
    const spread = Math.PI * 0.8; // 144° vor dem Haus
    for (let i = 0; i < inRow; i++) {
      const t = inRow === 1 ? 0 : i / (inRow - 1) - 0.5;
      const a = t * spread;
      slots.push({
        x: round(Math.sin(a) * radius),
        y: 0,
        z: round(Math.cos(a) * radius),
      });
    }
    row += 1;
  }
  return slots;
}

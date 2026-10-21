/**
 * Deterministisches Dorf-Layout (PLAN.md Abschnitt 7): Zentrale im Ursprung, Häuser auf Ringen.
 * Gleiche Daten ergeben immer dasselbe Dorf – keine Zufallswerte, kein Date.now().
 */

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
  paths: { x: number; z: number }[];
  /** Radius des äusseren Rings samt Rand (für Kamera und Begrenzung). */
  extent: number;
};

/** Plätze pro Ring und Ringradius. Ab dem 8. Haus beginnt der zweite Ring. */
const RING_CAPACITY = [7, 12, 18, 24];
const RING_RADIUS = [12, 22, 32, 42];
const FIRST_RING_EXTENT = 8;

/** Hausgrösse wächst mit der Anzahl Objekte: 0–2 klein, 3–6 mittel, 7+ gross. */
export function houseTier(artifactCount: number): Tier {
  if (artifactCount >= 7) return 3;
  if (artifactCount >= 3) return 2;
  return 1;
}

const TIER_FOOTPRINT: Record<Tier, number> = { 1: 1.1, 2: 1.5, 3: 1.9 };
export const ZENTRALE_FOOTPRINT = 2.3;

export function computeLayout(
  houses: LayoutHouse[],
  artifactCounts: Record<string, number>,
): VillageLayout {
  const result: Record<string, HouseLayout> = {};
  const paths: { x: number; z: number }[] = [];

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
  let index = 0;
  let ring = 0;
  while (index < others.length) {
    const capacity = RING_CAPACITY[Math.min(ring, RING_CAPACITY.length - 1)];
    const members = others.slice(index, index + capacity);
    const radius = RING_RADIUS[Math.min(ring, RING_RADIUS.length - 1)] + Math.max(0, ring - 3) * 10;
    // Jeder Ring wird um einen halben Schritt versetzt, damit Häuser nicht hinter Häusern stehen.
    const offset = ring % 2 === 1 ? Math.PI / members.length : 0;

    members.forEach((h, i) => {
      // Start unten (+z, zur Kamera), im Uhrzeigersinn.
      const theta = Math.PI / 2 + offset + (2 * Math.PI * i) / members.length;
      const x = round(radius * Math.cos(theta));
      const z = round(radius * Math.sin(theta));
      const tier = houseTier(artifactCounts[h.id] ?? 0);
      result[h.id] = {
        id: h.id,
        x,
        z,
        angle: round(Math.atan2(-x, -z)),
        ring: ring + 1,
        tier,
        footprint: TIER_FOOTPRINT[tier],
      };
      paths.push({ x, z });
    });
    index += members.length;
    ring += 1;
  }

  const outer =
    ring === 0
      ? 0
      : RING_RADIUS[Math.min(ring - 1, RING_RADIUS.length - 1)] + Math.max(0, ring - 4) * 10;
  return { houses: result, paths, extent: Math.max(outer, FIRST_RING_EXTENT) + 8 };
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

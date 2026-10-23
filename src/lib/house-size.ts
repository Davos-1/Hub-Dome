import type { FachType } from "./fachbereiche";
/** Hausgrösse: wächst mit der Anzahl Objekte (0–2 klein, 3–6 mittel, 7+ gross). */

export type Tier = 1 | 2 | 3;

export function houseTier(artifactCount: number): Tier {
  if (artifactCount >= 7) return 3;
  if (artifactCount >= 3) return 2;
  return 1;
}

/** Halbe Grundrissbreite der Häuser pro Stufe. */
export const TIER_FOOTPRINT: Record<Tier, number> = { 1: 1.1, 2: 1.25, 3: 1.4 };
export const ZENTRALE_FOOTPRINT = 2.3;

/** Ausdehnung eines Hausmodells im Grundstück (lokal, +z = Tor), Meter. */
export type HouseExtent = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * Grösste Ausdehnung der Hausmodelle je Typ über alle Stufen (gemessen an den Modellen; ein Test in
 * `src/components/village/models/` stellt sicher, dass kein Modell darüber hinausragt). Grundlage für
 * Anbau, Gartenfeld, Bank und Baum neben dem Haus: was hier nicht Platz hat, wird nicht angeboten.
 */
export const HOUSE_EXTENTS: Record<FachType, HouseExtent> = {
  werkstatt: { minX: -2.89, maxX: 2.25, minZ: -1.68, maxZ: 1.77 },
  block: { minX: -1.86, maxX: 1.84, minZ: -1.74, maxZ: 2.58 },
  solar: { minX: -1.61, maxX: 1.61, minZ: -1.54, maxZ: 1.92 },
  atelier: { minX: -1.78, maxX: 2.96, minZ: -1.63, maxZ: 2.55 },
  stadt: { minX: -1.57, maxX: 1.57, minZ: -1.57, maxZ: 1.95 },
  turm: { minX: -2.02, maxX: 2.11, minZ: -1.69, maxZ: 1.85 },
  digital: { minX: -1.61, maxX: 3.13, minZ: -1.54, maxZ: 2.44 },
  haus: { minX: -1.79, maxX: 3.25, minZ: -1.88, maxZ: 2.29 },
};

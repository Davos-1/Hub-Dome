import type { FachbereichId } from "./fachbereiche";

/**
 * Die acht festen Hausfarben (Phase 4h, «Haus bearbeiten»). Datenfarben: Sie erscheinen in Liste, Inventar,
 * Tafeln und auf dem Schild des Hauses in der Welt. Werte aus dem Prototyp (`docs/design_handoff_4h`).
 */
export const HOUSE_COLORS = [
  "#b5523b",
  "#c96a50",
  "#c08a2b",
  "#4f7d3f",
  "#2f7d8c",
  "#3f5f8a",
  "#6b4fd8",
  "#7a3b4a",
] as const;
export type HouseColor = (typeof HOUSE_COLORS)[number];

export const HOUSE_COLOR_NAMES: Record<HouseColor, string> = {
  "#b5523b": "Ziegel",
  "#c96a50": "Terrakotta",
  "#c08a2b": "Ocker",
  "#4f7d3f": "Moos",
  "#2f7d8c": "Türkis",
  "#3f5f8a": "Taubenblau",
  "#6b4fd8": "Violett",
  "#7a3b4a": "Weinrot",
};

const BY_FACH: Record<FachbereichId, HouseColor> = {
  tragwerk: "#b5523b",
  umwelt: "#4f7d3f",
  gebaeude: "#c96a50",
  projekt: "#c08a2b",
  wirtschaft: "#7a3b4a",
  grundlagen: "#3f5f8a",
  sprache: "#2f7d8c",
  digital: "#6b4fd8",
  weitere: "#2f7d8c",
};

/** Startfarbe eines neuen Hauses: passend zum Quartier. */
export const defaultHouseColor = (fach: FachbereichId): HouseColor => BY_FACH[fach];

export const isHouseColor = (c: string): c is HouseColor =>
  (HOUSE_COLORS as readonly string[]).includes(c.toLowerCase());

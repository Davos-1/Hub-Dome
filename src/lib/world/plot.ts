/**
 * Feste Masse der Siedlung (Grundstück, Wege, Korridore), gemeinsam für Siedlung und Wegformen. Werte nie
 * ändern: Sie bestimmen alle Generator-Versionen (v1/v2 eingefroren).
 */

/** Feste Grösse jedes Grundstücks: Haus der Stufe 3 samt Anbau und 12 Objekt-Plätze (lokal: +z = Tor). */
export const PLOT = { hw: 3.45, front: 5.9, back: 2.8 } as const;
export const NODE_N = 8;
export const MAIN_PATH_WIDTH = 1.9;
export const LANE_WIDTH = 1.7;
/** Abstand Wegrand → Gartentor. */
export const GATE_GAP = 0.4;
/** Halbe Breite des reservierten Korridors jeder Gasse. */
export const CORRIDOR_HW = LANE_WIDTH / 2 + 0.7;
/** Halbe Breite der Toröffnung in der Hecke. */
export const GATE = 0.95;
/** v2: Breite der Stichwege (Tor → Rückgrat). */
export const SPUR_WIDTH = 1.1;

/**
 * Layout-Format der 3D-Szene (Häuser, Quartiere, Plätze, Wege). Berechnet wird es vom Welt-Generator
 * (`src/lib/world/`): Seed + Häuser (+ Platzierungen) ergeben immer dasselbe Dorf, neue Häuser
 * verschieben keine bestehenden.
 */

import type { FachbereichId } from "./fachbereiche";
import type { VillagePath } from "./paths";
import type { ArtifactKind } from "./types";
import { generateWorld } from "./world/generate";

export { houseTier, TIER_FOOTPRINT, ZENTRALE_FOOTPRINT, type Tier } from "./house-size";
import type { Tier } from "./house-size";

export type LayoutItem = { id: string; kind: ArtifactKind };
export type LayoutHouse = {
  id: string;
  kind: "zentrale" | "modul" | "thema";
  fach: FachbereichId;
  /** Objekte des Hauses (bestimmen Grösse und Garten). */
  items: LayoutItem[];
  /** Reihenfolge der Entstehung (älter zuerst); fehlt sie, gilt die Reihenfolge der Eingabe. */
  order?: number;
};

/** Platz eines Objekts im Grundstück (lokal: +z = zum Gartentor). */
export type PlotSlot = LayoutItem & {
  side: -1 | 1;
  row: number;
  col: number;
  x: number;
  z: number;
};
export type Plot = { hw: number; front: number; back: number; slots: PlotSlot[] };

export type HouseLayout = {
  id: string;
  x: number;
  z: number;
  /** Drehung um Y, sodass die lokale +z-Achse (Hausfront, Tor) zum Weg zeigt. */
  angle: number;
  tier: Tier;
  /** Halbe Grundrissbreite des Hauses. */
  footprint: number;
  /** Grundstück samt Objekt-Plätzen; die Zentrale hat keines. */
  plot: Plot | null;
  /** Nur Zentrale: Objekt-Plätze im Ring um die Zentrale (lokal zur Zentrale, auf dem Dorfplatz). */
  ring: PlotSlot[] | null;
  quarterId: FachbereichId | null;
  /** Richtung vom Haus zum Weg (Tor). */
  side: number;
};

export type QuarterLayout = {
  id: FachbereichId;
  name: string;
  /** Index in der Farbpalette der Quartiere. */
  index: number;
  /** Mitte des Quartierplatzes. */
  x: number;
  z: number;
  /** Richtung vom Dorfmittelpunkt zum Quartier. */
  theta: number;
  /** Apothem des Quartierplatzes. */
  rp: number;
  /** Radius über alle Häuser des Quartiers (für die Kamera). */
  radius: number;
  houseIds: string[];
  /** Ausgang am Dorfplatz (Winkel). */
  mainSide: number;
  /** Richtung der Eingangsseite des Quartierplatzes. */
  entrySide: number;
};

/** Vieleck-Platz: `a` = Apothem, `rot` = Drehung, `used` = Winkel der Seiten mit Wegeinmündung. */
export type PlazaPoly = {
  x: number;
  z: number;
  a: number;
  n: number;
  rot: number;
  used: number[];
  gap: number;
  main: boolean;
  quarterId: FachbereichId | null;
};

export type VillageLayout = {
  houses: Record<string, HouseLayout>;
  quarters: QuarterLayout[];
  polys: PlazaPoly[];
  paths: VillagePath[];
  /** Apothem des Dorfplatzes. */
  plazaRadius: number;
  /** Apothem der oberen Terrassenstufe unter der Zentrale (wächst mit dem Objekt-Ring). */
  terrace: number;
  /** Radius des bebauten Dorfs samt Rand (für Kamera und Beschriftungen). */
  extent: number;
};

/** Breite der Zuwege und Gassen. */
export const MAIN_PATH_WIDTH = 1.9;
/** Terrasse ohne Objekte. */
export const TERRACE_MIN = 4.95;

/** Farben der Quartiere (Weg, Kante, Platz), eine pro Fachbereich. */
export const QUARTER_COLORS = [
  { main: "#d3c9b0", edge: "#a99f86", plaza: "#c6bca2" },
  { main: "#d6c0b8", edge: "#ad968d", plaza: "#c9b1a8" },
  { main: "#c2cdc6", edge: "#97a59c", plaza: "#b4c0b8" },
  { main: "#d9c7a0", edge: "#b29f78", plaza: "#cdbb93" },
  { main: "#c4cad0", edge: "#9aa2aa", plaza: "#b7bec5" },
  { main: "#d9b8a3", edge: "#b0907b", plaza: "#cba995" },
  { main: "#cad2b2", edge: "#a2ab88", plaza: "#bcc5a3" },
  { main: "#cfc4d6", edge: "#a69bb0", plaza: "#c1b6c9" },
  { main: "#d2cdc2", edge: "#a8a297", plaza: "#c4beb2" },
];

/** Seed für Vorschauen und Tests ohne gespeicherte Welt. */
export const DEFAULT_SEED = "hubdome1";

export const polar = (a: number, r: number) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });

/** Layout eines Dorfs (nur Häuser; Seed optional). Für die volle Welt: `generateWorld`. */
export function computeLayout(houses: LayoutHouse[], seed = DEFAULT_SEED): VillageLayout {
  return generateWorld({ seed, houses }).layout;
}

type Pt = { x: number; z: number };

/** Ecken eines Grundstücks in Weltkoordinaten. */
export function plotCorners(x: number, z: number, ang: number, p: Plot): Pt[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return (
    [
      [-p.hw, -p.back],
      [p.hw, -p.back],
      [p.hw, p.front],
      [-p.hw, p.front],
    ] as const
  ).map(([lx, lz]) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c }));
}

/** Überlappen sich zwei konvexe Vierecke (mit Sicherheitsabstand `m`)? Separating-Axis-Test. */
export function satOverlap(A: Pt[], B: Pt[], m = 0.4): boolean {
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % 4];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      const nx = -(b.z - a.z) / l;
      const nz = (b.x - a.x) / l;
      const pa = A.map((p) => p.x * nx + p.z * nz);
      const pb = B.map((p) => p.x * nx + p.z * nz);
      if (Math.max(...pa) + m < Math.min(...pb) || Math.max(...pb) + m < Math.min(...pa)) {
        return false;
      }
    }
  }
  return true;
}

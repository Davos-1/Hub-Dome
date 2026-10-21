import { z } from "zod";

/** Stile der Zentrale; `custom` = eigenes hochgeladenes Modell (GLB). */
export const ZENTRALE_STYLES = [
  "rathaus",
  "schule",
  "hochhaus",
  "villa",
  "marskuppel",
  "leuchtturm",
  "custom",
] as const;
export type ZentraleStyle = (typeof ZENTRALE_STYLES)[number];

export const ZENTRALE_STYLE_INFO: Record<ZentraleStyle, { label: string; description: string }> = {
  rathaus: { label: "Rathaus", description: "Halle mit Säulenportal, Uhrturm und Fahne." },
  schule: {
    label: "Schulgebäude",
    description: "Langgestrecktes Schulhaus mit Glockenturm, Fahnenmast und Pausenplatz.",
  },
  hochhaus: {
    label: "Hochhaus",
    description: "Gestaffelter Glasturm mit leuchtenden Fenstern und Antenne.",
  },
  villa: {
    label: "Villa",
    description: "Herrschaftliche Villa mit Terrasse, Balustrade und Pool.",
  },
  marskuppel: {
    label: "Grosse Marskuppel",
    description: "Zentrale Kuppelstadt mit Nebenkuppeln, Röhren und Antennenschüssel.",
  },
  leuchtturm: {
    label: "Leuchtturm",
    description: "Gestreifter Turm mit drehbarem Licht und Wärterhaus auf Felsen.",
  },
  custom: {
    label: "Eigenes Modell",
    description: "Ein mit Claude erstelltes 3D-Objekt (GLB-Datei).",
  },
};

export const zentraleStyleSchema = z.enum(ZENTRALE_STYLES);

/** Grenzen für eigene Modelle (siehe docs/PLAN-4B-GESTALTUNG.md). */
export const MODEL_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxTriangles: 60_000,
  maxTextures: 4,
  /** Das Modell wird beim Laden so skaliert, dass es in diese Würfelkante (Meter) passt. */
  fitSize: 9,
} as const;

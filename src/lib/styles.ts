import { z } from "zod";

/** Stile der Zentrale. */
export const ZENTRALE_STYLES = [
  "rathaus",
  "schule",
  "hochhaus",
  "villa",
  "marskuppel",
  "leuchtturm",
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
};

export const zentraleStyleSchema = z.enum(ZENTRALE_STYLES);

import { box, circle, type Shape } from "./geom";

/**
 * Seed-Objekte (Generator v2): kleine Merkmale der Landschaft, von denen jede Welt eine Auswahl bekommt
 * (nicht alles überall), damit sich zwei Welten merklich unterscheiden. Jedes Objekt hat eine Grundfläche
 * (lokal, vor der Drehung; Front = +z) und eine Lage:
 *
 * - `land`: auf der Wiese, ganz trocken.
 * - `ufer`: Rückseite trocken am Ufer, Front (+z) reicht übers Wasser (Mühle mit Wasserrad, Fischerhütte mit Steg,
 *   Ruderboot).
 * - `quer`: quer über den Fluss (lokale z-Achse quert ihn, Mitte über der Flussmitte): Fähre, Wehr. Die Tiefe
 *   ergibt sich aus der Flussbreite (`spanFor`).
 *
 * Die Modelle (`src/components/village/seed-object-models.ts`) bleiben in ihrer Grundfläche (Test).
 */

export const SEED_OBJEKTE = [
  "wassermuehle",
  "faehre",
  "wehr",
  "fischerhuette",
  "picknickplatz",
  "ruderboot",
  "kapelle",
  "steinkreis",
  "heuhaufen",
  "holzlager",
  "bienenstoecke",
  "vogelscheuche",
  "wegkreuz",
  "findlinge",
  "schaukelbaum",
  "ruine",
  "weinberg",
] as const;
export type SeedObjektTyp = (typeof SEED_OBJEKTE)[number];

export type SeedForm = { kind: "circle"; r: number } | { kind: "box"; hw: number; hd: number };
export type SeedLage = "land" | "ufer" | "quer" | "wassernah";

export type SeedObjektEintrag = {
  /** Name (Beschreibung der Welt, Galerie). */
  name: string;
  /** Grund im roten Geisterbild («an der Kapelle»). */
  label: string;
  form: SeedForm;
  lage: SeedLage;
  /** Gewicht bei der Auswahl. */
  gewicht: number;
  /** Nur bei Flüssen ab dieser Breite (Meter). */
  minBreite?: number;
};

export const SEED_OBJEKT: Record<SeedObjektTyp, SeedObjektEintrag> = {
  wassermuehle: {
    name: "Mühle mit Wasserrad",
    label: "an der Mühle",
    form: { kind: "box", hw: 3.2, hd: 3.0 },
    lage: "ufer",
    gewicht: 3,
  },
  faehre: {
    name: "Seilfähre",
    label: "an der Fähre",
    form: { kind: "box", hw: 2.0, hd: 6 },
    lage: "quer",
    gewicht: 2,
    minBreite: 5.2,
  },
  wehr: {
    name: "Kleines Wehr",
    label: "am Wehr",
    form: { kind: "box", hw: 1.2, hd: 6 },
    lage: "quer",
    gewicht: 1.5,
  },
  fischerhuette: {
    name: "Fischerhütte mit Steg",
    label: "an der Fischerhütte",
    form: { kind: "box", hw: 2.6, hd: 3.4 },
    lage: "ufer",
    gewicht: 2.5,
    minBreite: 3.5,
  },
  picknickplatz: {
    name: "Picknickplatz am Wasser",
    label: "am Picknickplatz",
    form: { kind: "circle", r: 2.6 },
    lage: "wassernah",
    gewicht: 2,
  },
  ruderboot: {
    name: "Ruderboot am Ufer",
    label: "am Ruderboot",
    form: { kind: "box", hw: 0.9, hd: 2.1 },
    lage: "ufer",
    gewicht: 1.5,
    minBreite: 4.5,
  },
  kapelle: {
    name: "Kapelle",
    label: "an der Kapelle",
    form: { kind: "box", hw: 2.4, hd: 3.4 },
    lage: "land",
    gewicht: 2,
  },
  steinkreis: {
    name: "Steinkreis",
    label: "im Steinkreis",
    form: { kind: "circle", r: 4.0 },
    lage: "land",
    gewicht: 1.2,
  },
  heuhaufen: {
    name: "Heuballen",
    label: "bei den Heuballen",
    form: { kind: "box", hw: 3.5, hd: 2.5 },
    lage: "land",
    gewicht: 2,
  },
  holzlager: {
    name: "Holzlager",
    label: "am Holzlager",
    form: { kind: "box", hw: 2.0, hd: 1.2 },
    lage: "land",
    gewicht: 1.5,
  },
  bienenstoecke: {
    name: "Bienenstöcke",
    label: "bei den Bienenstöcken",
    form: { kind: "box", hw: 2.2, hd: 1.0 },
    lage: "land",
    gewicht: 1.5,
  },
  vogelscheuche: {
    name: "Gemüsefeld mit Vogelscheuche",
    label: "im Gemüsefeld",
    form: { kind: "box", hw: 3.0, hd: 3.0 },
    lage: "land",
    gewicht: 1.8,
  },
  wegkreuz: {
    name: "Wegkreuz",
    label: "am Wegkreuz",
    form: { kind: "circle", r: 1.0 },
    lage: "land",
    gewicht: 1,
  },
  findlinge: {
    name: "Findlinge",
    label: "bei den Findlingen",
    form: { kind: "circle", r: 3.0 },
    lage: "land",
    gewicht: 1.5,
  },
  schaukelbaum: {
    name: "Baum mit Schaukel",
    label: "am Schaukelbaum",
    form: { kind: "circle", r: 3.0 },
    lage: "land",
    gewicht: 1.8,
  },
  ruine: {
    name: "Kleine Ruine",
    label: "an der Ruine",
    form: { kind: "box", hw: 4.0, hd: 3.5 },
    lage: "land",
    gewicht: 1,
  },
  weinberg: {
    name: "Rebberg",
    label: "im Rebberg",
    form: { kind: "box", hw: 6.0, hd: 4.0 },
    lage: "land",
    gewicht: 1.2,
  },
};

/** Tiefe (halbe Länge quer zum Fluss) von Fähre und Wehr für eine Flussbreite: beidseits 2.4 m Land. */
export const spanFor = (riverWidth: number) => riverWidth / 2 + 0.85 + 2.4;

/** Platziertes Seed-Objekt (Weltkoordinaten; `angle` wie bei Häusern: lokale +z zeigt nach (sin a, cos a)). */
export type SeedObjekt = {
  typ: SeedObjektTyp;
  x: number;
  z: number;
  angle: number;
  /** Nur `quer`: halbe Länge quer zum Fluss. */
  hd?: number;
  /** Nur `quer`: Breite des Wassers an der Stelle (für das Modell). */
  water?: number;
};

/** Grundfläche eines platzierten Seed-Objekts in Weltkoordinaten. */
export function seedObjektShape(o: SeedObjekt): Shape {
  const f = SEED_OBJEKT[o.typ].form;
  if (f.kind === "circle") return circle(o.x, o.z, f.r);
  return box(o.x, o.z, f.hw, o.hd ?? f.hd, o.angle);
}

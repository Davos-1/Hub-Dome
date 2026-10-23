import { SEED_OBJEKTE, type SeedObjektTyp } from "@/lib/world/seed-objects";

/** Neben den 17 Seed-Objekten zeigt die Galerie die Trauerweide und die Steinbogenbrücke. */
export const SEED_EXTRAS = ["weide", "bruecke"] as const;
export type SeedExtra = (typeof SEED_EXTRAS)[number];
export type SeedName = SeedObjektTyp | SeedExtra;

/** Alle Namen, für `?nur=…` in der Adresse. */
export const SEED_NAMEN: readonly SeedName[] = [...SEED_OBJEKTE, ...SEED_EXTRAS];

/** Reihenfolge im Raster: Wasser vorn links, dann Wiese; die Zeilen ergeben sich aus der Breite. */
export const SEED_REIHENFOLGE: readonly SeedName[] = [
  "faehre",
  "wehr",
  "bruecke",
  "wassermuehle",
  "fischerhuette",
  "ruderboot",
  "picknickplatz",
  "kapelle",
  "steinkreis",
  "heuhaufen",
  "holzlager",
  "bienenstoecke",
  "wegkreuz",
  "vogelscheuche",
  "findlinge",
  "schaukelbaum",
  "ruine",
  "weide",
  "weinberg",
];

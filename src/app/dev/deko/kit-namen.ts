import type { KitFarben } from "@/components/village/kit-models";
import { ANBAUTEN, GAERTEN, type Anbau, type Garten } from "@/lib/world/doc";

/** Anbauten ohne «keiner»: so viele Modelle gibt es. */
export const KIT_ANBAUTEN = ANBAUTEN.filter((a): a is Exclude<Anbau, "keiner"> => a !== "keiner");
export type KitName = Exclude<Anbau, "keiner"> | Garten;
export const KIT_NAMEN: readonly KitName[] = [...KIT_ANBAUTEN, ...GAERTEN];

/** Zwei Farbsätze, um zu sehen, dass Wand, Dach und Akzent wirklich durchschlagen (`?farben=2`). */
export const KIT_FARBSAETZE: readonly KitFarben[] = [
  { wall: "#efe3c8", roof: "#b4533a", accent: "#3f7f9a" },
  { wall: "#c9d6e3", roof: "#5f7a94", accent: "#d9892b" },
];

export const KIT_LABELS: Record<KitName, string> = {
  laube: "Laube",
  schuppen: "Schuppen",
  wintergarten: "Wintergarten",
  blumen: "Blumen",
  gemuese: "Gemüse",
  stein: "Stein",
  obst: "Obst",
};

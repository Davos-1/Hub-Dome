import * as THREE from "three";
import type { Tier } from "@/lib/layout";
import type { HouseStyle, ZentraleStyle } from "@/lib/styles";
import { mergeParts, sphere, type Part } from "../geo";
import { baumhausModel } from "./house-baumhaus";
import { blockhuetteModel } from "./house-blockhuette";
import { constructionModel as construction } from "./house-construction";
import { hausModel } from "./house-haus";
import { marskuppelModel } from "./house-marskuppel";
import { tinyhausModel } from "./house-tinyhaus";
import { werkstattModel } from "./house-werkstatt";
import type { Model } from "./common";
import { hochhausModel } from "./zentrale-hochhaus";
import { leuchtturmModel } from "./zentrale-leuchtturm";
import { zentraleMarskuppelModel } from "./zentrale-marskuppel";
import { rathausModel } from "./zentrale-rathaus";
import { schuleModel } from "./zentrale-schule";
import { villaModel } from "./zentrale-villa";

export { roofColorFor, type Model } from "./common";

/** Modell eines Wohn-/Modulhauses im gewählten Stil und in der Grössenstufe. */
export function houseModel(
  style: HouseStyle,
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
): Model {
  switch (style) {
    case "blockhuette":
      return blockhuetteModel(fp, tier, wall, roof);
    case "marskuppel":
      return marskuppelModel(fp, tier, wall);
    case "werkstatt":
      return werkstattModel(fp, tier, wall);
    case "tinyhaus":
      return tinyhausModel(fp, tier, wall, roof);
    case "baumhaus":
      return baumhausModel(fp, tier, wall, roof);
    default:
      return hausModel(fp, tier, wall, roof);
  }
}

/** Baustelle (Haus ohne Objekte) passend zum Stil. */
export const constructionModel = construction;

/** Höhe über dem Boden (in Vielfachen von `fp`), für Beschriftung und Trefferfläche. */
export function houseTopFactor(style: HouseStyle, tier: Tier, empty: boolean): number {
  if (empty) return 3.3;
  const base: Record<HouseStyle, number> = {
    haus: 2.8,
    blockhuette: 2.9,
    marskuppel: 2.4,
    werkstatt: 2.5,
    tinyhaus: 2.7,
    baumhaus: 5.2,
  };
  return base[style] + (tier >= 3 ? (style === "werkstatt" ? 1.6 : 1) : 0);
}

/** Modell der Zentrale (Stil `custom` wird separat als hochgeladenes Modell geladen; hier Ersatz = Rathaus). */
export function zentraleModel(style: ZentraleStyle, fp: number): Model {
  switch (style) {
    case "schule":
      return schuleModel(fp);
    case "hochhaus":
      return hochhausModel(fp);
    case "villa":
      return villaModel(fp);
    case "marskuppel":
      return zentraleMarskuppelModel(fp);
    case "leuchtturm":
      return leuchtturmModel(fp);
    default:
      return rathausModel(fp);
  }
}

/** Höhe der Zentrale (in Vielfachen von `fp`), für Beschriftung und Trefferfläche. */
export function zentraleTopFactor(style: ZentraleStyle): number {
  const top: Record<ZentraleStyle, number> = {
    rathaus: 5.2,
    schule: 3.9,
    hochhaus: 6.6,
    villa: 3.6,
    marskuppel: 3.4,
    leuchtturm: 6.4,
    custom: 5,
  };
  return top[style];
}

/** Kleine Figur (Avatar) vor der Zentrale. */
export function figureModel(shirt: string): THREE.BufferGeometry {
  const parts: Part[] = [
    { geo: new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), color: shirt, pos: [0, 0.55, 0] },
    { geo: sphere(0.2, 14), color: "#f3c9a4", pos: [0, 1.15, 0] },
    {
      geo: new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      color: "#4a3426",
      pos: [0, 1.18, -0.01],
    },
    {
      geo: new THREE.CapsuleGeometry(0.06, 0.32, 3, 6),
      color: shirt,
      pos: [-0.27, 0.62, 0],
      rot: [0, 0, 0.25],
    },
    {
      geo: new THREE.CapsuleGeometry(0.06, 0.32, 3, 6),
      color: shirt,
      pos: [0.27, 0.62, 0],
      rot: [0, 0, -0.25],
    },
    { geo: sphere(0.03, 6), color: "#1f2937", pos: [-0.07, 1.18, 0.18] },
    { geo: sphere(0.03, 6), color: "#1f2937", pos: [0.07, 1.18, 0.18] },
  ];
  return mergeParts(parts);
}

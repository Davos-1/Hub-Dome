import * as THREE from "three";
import type { Tier } from "@/lib/layout";
import type { FachType } from "@/lib/fachbereiche";
import type { ZentraleStyle } from "@/lib/styles";
import { mergeParts, sphere, type Part } from "../geo";
import { baustelleModel } from "./house-baustelle";
import {
  atelierModel,
  blockModel,
  digitalModel,
  solarModel,
  stadtModel,
  turmModel,
  werkstattModel,
} from "./house-fach";
import { hausModel } from "./house-haus";
import type { Model } from "./common";
import { hochhausModel } from "./zentrale-hochhaus";
import { leuchtturmModel } from "./zentrale-leuchtturm";
import { zentraleMarskuppelModel } from "./zentrale-marskuppel";
import { rathausModel } from "./zentrale-rathaus";
import { schuleModel } from "./zentrale-schule";
import { villaModel } from "./zentrale-villa";

export { type Model } from "./common";

const HOUSE_CACHE = new Map<string, Model>();

type FachModel = (fp: number, tier: Tier, wall: string, roof: string, accent: string) => Model;

const FACH_MODELS: Record<Exclude<FachType, "haus">, FachModel> = {
  werkstatt: werkstattModel,
  block: blockModel,
  solar: solarModel,
  atelier: atelierModel,
  stadt: stadtModel,
  turm: turmModel,
  digital: digitalModel,
};

/**
 * Modell eines Hauses: Typ (aus dem Fachbereich), Grundmass, Stufe und Farben.
 * Modelle werden pro Schlüssel zwischengespeichert und von allen gleichartigen Häusern geteilt
 * (nicht beim Entfernen der Szene freigeben; der Zwischenspeicher bleibt klein).
 */
export function houseModel(
  type: FachType,
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
  /** Haus mit neuen Objekten: das Giebelhaus bekommt dann schon ab Stufe 1 einen Kamin (für den Rauch). */
  active = false,
): Model {
  const key = [type, fp, tier, wall, roof, accent, active].join("|");
  let model = HOUSE_CACHE.get(key);
  if (!model) {
    model =
      type === "haus"
        ? hausModel(fp, tier, wall, roof, accent, tier >= 2 || active)
        : FACH_MODELS[type](fp, tier, wall, roof, accent);
    HOUSE_CACHE.set(key, model);
  }
  return model;
}

/** Baustelle (Haus ohne Objekte), unabhängig vom Haustyp. */
export function constructionModel(fp: number): Model {
  const key = `baustelle|${fp}`;
  let model = HOUSE_CACHE.get(key);
  if (!model) {
    model = baustelleModel(fp);
    HOUSE_CACHE.set(key, model);
  }
  return model;
}

/** Position der Kaminöffnung (lokal) für den Rauch; `null` bei Typen ohne Kamin. */
export function chimneyTop(type: FachType, fp: number): [number, number, number] | null {
  if (type === "haus") return [fp * 0.55, 0.18 + fp * 1.5 + fp * 0.9, -fp * 2.1 * 0.18];
  if (type === "block") return [fp * 0.9, 0.18 + fp * 2.02, -fp * 0.4];
  return null;
}

const ZENTRALE_MODELS: Record<ZentraleStyle, (fp: number) => Model> = {
  rathaus: rathausModel,
  schule: schuleModel,
  hochhaus: hochhausModel,
  villa: villaModel,
  marskuppel: zentraleMarskuppelModel,
  leuchtturm: leuchtturmModel,
};

/**
 * Modell der Zentrale im gewählten Stil (unbekannte Werte aus älteren Daten zeigen das Rathaus).
 * Wie die Häuser zwischengespeichert, damit ein Stilwechsel keine Geometrie liegen lässt.
 */
export function zentraleModel(style: ZentraleStyle, fp: number): Model {
  const build = Object.hasOwn(ZENTRALE_MODELS, style) ? ZENTRALE_MODELS[style] : rathausModel;
  const key = `zentrale|${build === rathausModel ? "rathaus" : style}|${fp}`;
  let model = HOUSE_CACHE.get(key);
  if (!model) {
    model = build(fp);
    HOUSE_CACHE.set(key, model);
  }
  return model;
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

import * as THREE from "three";
import type { Vec3 } from "@/lib/camera-poses";
import type { HouseLayout } from "@/lib/layout";
import type { ZentraleStyle } from "@/lib/styles";
import type { VillageModel } from "@/lib/village-model";
import { modelOfHouse, ZENTRALE_LIFT } from "./buildings";
import { zentraleModel, type Model } from "./models";

/**
 * Hüllpunkte des tatsächlichen Modells für die Kamera (P5): Haus samt Garten bzw. Zentrale samt Sockel
 * (Terrasse), Objektring und Figur. Die Kamera passt diese Punkte mit Rand in den freien Bildausschnitt ein.
 */

const ZENTRALE_BOXES = new Map<string, THREE.Box3>();

/** Lokale Hüllbox eines Modells (Karosserie und Leuchtteile). */
export function modelBox(model: Model): THREE.Box3 {
  model.body.computeBoundingBox();
  model.glow.computeBoundingBox();
  const b = model.body.boundingBox!.clone();
  if (model.glow.getAttribute("position")?.count) b.union(model.glow.boundingBox!);
  return b;
}

/** Hüllbox der Zentrale je Stil und Grundmass (zwischengespeichert, das Modell wird danach freigegeben). */
export function zentraleBox(style: ZentraleStyle, fp: number): THREE.Box3 {
  const key = `${style}|${fp}`;
  let b = ZENTRALE_BOXES.get(key);
  if (!b) {
    const m = zentraleModel(style, fp);
    b = modelBox(m);
    m.body.dispose();
    m.glow.dispose();
    ZENTRALE_BOXES.set(key, b);
  }
  return b;
}

/** Ecken einer lokalen Box, gedreht und verschoben wie ein Haus (Drehung um y, dann Lage). */
function corners(b: THREE.Box3, l: Pick<HouseLayout, "x" | "z" | "angle">, lift = 0): Vec3[] {
  const c = Math.cos(l.angle);
  const s = Math.sin(l.angle);
  const out: Vec3[] = [];
  for (const x of [b.min.x, b.max.x])
    for (const y of [b.min.y, b.max.y])
      for (const z of [b.min.z, b.max.z])
        out.push([l.x + x * c + z * s, y + lift, l.z - x * s + z * c]);
  return out;
}

/** Hüllpunkte der Zentrale: Modell auf der Terrasse, Sockel, Objektring (Objekte bis 1.7 m) und Figur. */
export function zentraleHull(style: ZentraleStyle, l: HouseLayout, terrace: number): Vec3[] {
  const fp = l.footprint;
  const pts = corners(zentraleBox(style, fp), l, ZENTRALE_LIFT);
  // Sockel (Terrasse) als Achteck am Boden
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push([l.x + Math.cos(a) * terrace, 0, l.z + Math.sin(a) * terrace]);
  }
  for (const s of l.ring ?? []) {
    for (const [dx, dz] of [
      [-0.5, -0.5],
      [0.5, 0.5],
    ])
      pts.push([l.x + s.x + dx, ZENTRALE_LIFT + 1.7, l.z + s.z + dz]);
  }
  pts.push([l.x + fp * 1.35, ZENTRALE_LIFT + 1.4, l.z + fp * 1.9]);
  return pts;
}

/** Hüllpunkte eines Hauses: Modell und Grundstück (Garten mit Objekten bis 1.2 m). */
export function houseHull(model: VillageModel, id: string): Vec3[] | null {
  const l = model.layout.houses[id];
  const info = model.byId[id];
  if (!l || !info || !l.plot) return null;
  const pts = corners(modelBox(modelOfHouse(info, l)), l);
  const plot = new THREE.Box3(
    new THREE.Vector3(-l.plot.hw, 0, -l.plot.back),
    new THREE.Vector3(l.plot.hw, 1.2, l.plot.front),
  );
  return [...pts, ...corners(plot, l)];
}

/** Liefert die Hülle zu einer Haus-Id (Zentrale oder Modulhaus) für `poseFor`. */
export function hullLookup(model: VillageModel, style: ZentraleStyle) {
  return (id: string): Vec3[] | null => {
    const l = model.layout.houses[id];
    if (!l) return null;
    if (!l.plot) return zentraleHull(style, l, model.layout.terrace);
    return houseHull(model, id);
  };
}

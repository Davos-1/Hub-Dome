import * as THREE from "three";
import type { Palette } from "@/lib/world/map";
import { cyl, mergeParts, type Part } from "./geo";
import { orient } from "./models/common";

/** Gemeinsame Helfer der kleinen Modelle (Deko-Katalog, Anbauten, Gartenstile). */

export type V3 = [number, number, number];

/** Element einer Liste mit umlaufendem Index (auch negativ). */
export const at = <T>(list: readonly T[], i: number): T =>
  list[((i % list.length) + list.length) % list.length];

/** Unregelmässiger Stein (36 Dreiecke). */
export const rock = (r: number) => new THREE.DodecahedronGeometry(r, 0);

/** Hüllbox eines einzelnen Bauteils (mit Drehung und Skalierung). */
export function bounds(p: Part): THREE.Box3 {
  const g = mergeParts([p]);
  g.computeBoundingBox();
  const b = g.boundingBox!.clone();
  g.dispose();
  return b;
}

/** Hebt oder senkt ein Bauteil, bis seine Unterkante genau auf `y` liegt (gedrehte, gestreckte Steine). */
export function restOn(p: Part, y: number): Part {
  const lift = y - bounds(p).min.y;
  const [x, py, z] = p.pos ?? [0, 0, 0];
  return { ...p, pos: [x, py + lift, z] };
}

/** Bauteil genau auf den Boden (y = 0) setzen. */
export const sit = (p: Part) => restOn(p, 0);

/** Zylinder zwischen zwei Punkten (Radius `r0` bei `a`, `r1` bei `b`): Holzscheite, Seile, Halme, Rohre. */
export function between(a: V3, b: V3, r0: number, r1: number, color: string, seg = 6): Part {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  d.normalize();
  return {
    geo: cyl(r1, r0, len, seg),
    color,
    pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: orient([d.x, d.y, d.z]),
  };
}

/** Obstfarben aus den Blüten der Stimmung, ohne die Grüntöne (die verschwänden in der Krone). */
export function fruitColors(p: Palette): string[] {
  const hsl = { h: 0, s: 0, l: 0 };
  const out = p.blossom.filter((hex) => {
    new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace);
    return !(hsl.s > 0.2 && hsl.h > 0.17 && hsl.h < 0.5);
  });
  return out.length ? out : ["#e04f4f", "#f0a33a"];
}

import * as THREE from "three";
import { box, mergeParts, rbox, sphere, type Part } from "../geo";

/** Geometrie eines Gebäudes: `body` mit Vertex-Farben, `glow` = leuchtende Teile (Fenster, Laternen). */
export type Model = {
  body: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  /** Höhe der Oberkante über dem Boden (Meter), für Beschriftung und Trefferfläche. */
  top: number;
};

/** Sammelt Bauteile für Karosserie und leuchtende Teile. */
export class Builder {
  body: Part[] = [];
  glow: Part[] = [];
  add(p: Part) {
    this.body.push(p);
    return this;
  }
  light(p: Part) {
    this.glow.push(p);
    return this;
  }
  build(top = 0): Model {
    return {
      top,
      body: mergeParts(this.body),
      // mergeParts braucht mindestens ein Teil: bei Modellen ohne Leuchtteile ein unsichtbar kleines
      glow: mergeParts(
        this.glow.length ? this.glow : [{ geo: box(0.001, 0.001, 0.001), color: "#000000" }],
      ),
    };
  }
}

export const STONE = "#b8b2a7";
export const WHITE = "#f6f3ec";
export const WOOD = "#7a4a2b";
export const BRICK = "#a35a45";
export const WARM = "#ffe2a0";

export const darken = (hex: string, f: number) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
};

/** Fenster mit Rahmen, Sprossen und leuchtender Scheibe an der Vorderseite (+z). */
export function frontWindow(
  b: Builder,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  shutter: string | null,
  flowerBox = true,
) {
  b.add({ geo: rbox(w + 0.14, h + 0.14, 0.1, 0.02), color: WHITE, pos: [x, y, z] });
  b.light({ geo: box(w, h, 0.12), color: WARM, pos: [x, y, z] });
  b.add({ geo: box(0.035, h, 0.14), color: WHITE, pos: [x, y, z] });
  b.add({ geo: box(w, 0.035, 0.14), color: WHITE, pos: [x, y, z] });
  if (shutter) {
    for (const side of [-1, 1]) {
      b.add({
        geo: rbox(w * 0.38, h + 0.16, 0.06, 0.02),
        color: shutter,
        pos: [x + side * (w / 2 + w * 0.3), y, z - 0.01],
      });
    }
  }
  if (flowerBox) {
    b.add({
      geo: rbox(w + 0.1, 0.12, 0.16, 0.02),
      color: WOOD,
      pos: [x, y - h / 2 - 0.12, z + 0.1],
    });
    const flowers = ["#ec4899", "#f59e0b", "#ef4444"];
    for (let i = 0; i < 4; i++) {
      b.add({
        geo: sphere(0.05, 8),
        color: flowers[i % flowers.length],
        pos: [x - w / 2 + 0.06 + (i * (w - 0.12)) / 3, y - h / 2 - 0.03, z + 0.1],
      });
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Euler-Drehung, die die Y-Achse eines Bauteils auf die Richtung `n` ausrichtet (z.B. Bullaugen auf einer Kuppel). */
export function orient(n: [number, number, number]): [number, number, number] {
  tmpQ.setFromUnitVectors(UP, new THREE.Vector3(...n).normalize());
  tmpE.setFromQuaternion(tmpQ);
  return [tmpE.x, tmpE.y, tmpE.z];
}

/** Punkt auf einer Kugel (Radius r, Mittelpunkt (0,cy,0)) bei Azimut/Elevation (Bogenmass). */
export function onSphere(r: number, cy: number, azimuth: number, elevation: number) {
  const x = Math.sin(azimuth) * Math.cos(elevation);
  const y = Math.sin(elevation);
  const z = Math.cos(azimuth) * Math.cos(elevation);
  return {
    pos: [x * r, cy + y * r, z * r] as [number, number, number],
    normal: [x, y, z] as [number, number, number],
  };
}

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Vec3 = [number, number, number];

/** Ein Bauteil eines Modells: Geometrie, Farbe und Platzierung. */
export type Part = {
  geo: THREE.BufferGeometry;
  color: string;
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

/** Setzt `out` aus Position, Euler-Drehung (XYZ) und Skalierung. */
export function composeInto(out: THREE.Matrix4, pos: Vec3, rot: Vec3, scale: Vec3): THREE.Matrix4 {
  return out.compose(v.set(...pos), q.setFromEuler(e.set(...rot)), s.set(...scale));
}

/** Drehung um Y (Bogenmass) und Verschiebung auf (x, 0, z), wie ein Haus im Dorf steht. */
export function yawMatrix(x: number, z: number, angle: number): THREE.Matrix4 {
  return composeInto(new THREE.Matrix4(), [x, 0, z], [0, angle, 0], [1, 1, 1]);
}

/**
 * Fügt viele Bauteile zu einer einzigen Geometrie mit Vertex-Farben zusammen.
 * Ergibt pro Modell nur einen Draw Call und erlaubt viele Details ohne Performance-Verlust.
 * Die Geometrien der Bauteile werden dabei freigegeben und dürfen danach nicht mehr gezeichnet werden.
 */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    }
    g.applyMatrix4(composeInto(m4, p.pos ?? [0, 0, 0], p.rot ?? [0, 0, 0], p.scale ?? [1, 1, 1]));

    const c = new THREE.Color(p.color);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  parts.forEach((p) => p.geo.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Führt fertige Geometrien (gleiche Attribute) zu einer zusammen und gibt die Einzelteile frei.
 * Bei einer leeren Liste gibt es `null`.
 */
export function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (list.length === 0) return null;
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Abgerundeter Quader. */
export const rbox = (w: number, h: number, d: number, r = 0.05) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Zylinder mit Achse entlang Y. */
export const cyl = (rTop: number, rBottom: number, h: number, seg = 16) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, seg);

/** Zylinder mit Achse entlang z (liegend), damit eine Drehung um Y die Richtung bestimmt. */
export const cylZ = (rTop: number, rBottom: number, len: number, seg = 16) => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
};

/** Satteldach: Giebel zeigt nach +z, First verläuft entlang z, Unterkante liegt auf y=0. */
export function gable(width: number, height: number, depth: number, bevel = 0.04) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

/** Halbkreis-Bogen (Türbogen, Truhendeckel) mit Achse entlang z, Rundung nach oben. */
export const arch = (radius: number, depth: number) => {
  const g = new THREE.CylinderGeometry(radius, radius, depth, 16, 1, false, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2);
  return g;
};

export const sphere = (r: number, seg = 14) =>
  new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));

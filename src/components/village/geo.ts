import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Ein Bauteil eines Modells: Geometrie, Farbe und Platzierung. */
export type Part = {
  geo: THREE.BufferGeometry;
  color: string;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

/**
 * Fügt viele Bauteile zu einer einzigen Geometrie mit Vertex-Farben zusammen.
 * Ergibt pro Modell nur einen Draw Call und erlaubt viele Details ohne Performance-Verlust.
 */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    }
    e.set(...(p.rot ?? [0, 0, 0]));
    q.setFromEuler(e);
    v.set(...(p.pos ?? [0, 0, 0]));
    s.set(...(p.scale ?? [1, 1, 1]));
    g.applyMatrix4(m4.compose(v, q, s));

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

/** Pfeilförmiges Schild (zeigt nach +x), Dicke entlang z. */
export function arrowBoard(length: number, height: number, thickness: number) {
  const shape = new THREE.Shape();
  const tip = height * 0.55;
  shape.moveTo(-length / 2, -height / 2);
  shape.lineTo(length / 2 - tip, -height / 2);
  shape.lineTo(length / 2, 0);
  shape.lineTo(length / 2 - tip, height / 2);
  shape.lineTo(-length / 2, height / 2);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/** Zahnrad mit Loch (Achse entlang z). */
export function gearGeometry(
  teeth: number,
  rInner: number,
  rOuter: number,
  hole: number,
  depth: number,
) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [a - step * 0.28, rInner],
      [a - step * 0.16, rOuter],
      [a + step * 0.16, rOuter],
      [a + step * 0.28, rInner],
    ];
    pts.forEach(([ang, r], j) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && j === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(holePath);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export const sphere = (r: number, seg = 14) =>
  new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));

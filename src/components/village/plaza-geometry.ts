import * as THREE from "three";
import { isInPlot, polar, type PlazaPoly, type VillageLayout } from "@/lib/layout";
import { distanceToPolyline } from "@/lib/paths";
import { box, cyl, gable, mergeParts, type Part } from "./geo";
import { darken, STONE, WOOD } from "./models/common";

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Vieleck mit Umkreisradius `R` (Shape liegt in XY und wird flach gedreht, daher y = -sin). */
function polyShape(R: number, n: number, rot: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const b = rot + Math.PI / n + (TAU * i) / n;
    const x = Math.cos(b) * R;
    const y = -Math.sin(b) * R;
    if (i) s.lineTo(x, y);
    else s.moveTo(x, y);
  }
  return s;
}

/** Fläche des Platzes: Grundton, Pflasterbänder, Fugen zu den Ecken, Randstein mit Lücken an den Wegen. */
export function plazaSurface(p: PlazaPoly, fill: string, edge: string): THREE.BufferGeometry {
  const { n } = p;
  const R = p.a / Math.cos(Math.PI / n);
  const parts: Part[] = [];
  const tone = (f: number) => darken(fill, f);
  const flat = (r: number, y: number, color: string) => {
    const g = new THREE.ShapeGeometry(polyShape(r, n, p.rot));
    g.rotateX(-Math.PI / 2);
    parts.push({ geo: g, color, pos: [0, y, 0] });
  };
  const band = (r0: number, r1: number, y: number, color: string) => {
    const shape = polyShape(r1, n, p.rot);
    const hole = new THREE.Path();
    polyShape(r0, n, p.rot)
      .getPoints()
      .reverse()
      .forEach((pt, i) => {
        if (i) hole.lineTo(pt.x, pt.y);
        else hole.moveTo(pt.x, pt.y);
      });
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    parts.push({ geo: g, color, pos: [0, y, 0] });
  };

  flat(R + 0.1, 0.004, fill);
  const bands = p.main
    ? [
        [0.62, 0.65],
        [0.86, 0.885],
      ]
    : [[0.58, 0.63]];
  for (const [f0, f1] of bands) band(R * f0, R * f1, 0.007, tone(0.9));

  // Fugen von den Ecken zur Mitte
  const r0 = p.main ? R * 0.62 : R * 0.2;
  for (let i = 0; i < n; i++) {
    const b = p.rot + Math.PI / n + (TAU * i) / n;
    const r1 = R - 0.35;
    const len = r1 - r0;
    const mid = (r0 + r1) / 2;
    parts.push({
      geo: box(0.07, 0.012, len),
      color: tone(0.88),
      pos: [Math.cos(b) * mid, 0.008, Math.sin(b) * mid],
      rot: [0, Math.atan2(Math.cos(b), Math.sin(b)), 0],
    });
  }

  // Randstein je Seite, an Wegeinmündungen offen
  const side = 2 * p.a * Math.tan(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = p.rot + (TAU * k) / n;
    const used = p.used.some((u) => angDiff(u, a) < 0.02);
    const c = { x: Math.cos(a), z: Math.sin(a) };
    const t = { x: -c.z, z: c.x };
    const d = p.a - 0.12;
    const rot: [number, number, number] = [0, Math.atan2(t.x, t.z), 0];
    const seg = (o0: number, o1: number) => {
      if (o1 - o0 < 0.3) return;
      const m = (o0 + o1) / 2;
      parts.push({
        geo: box(0.28, 0.14, o1 - o0),
        color: edge,
        pos: [c.x * d + t.x * m, 0.07, c.z * d + t.z * m],
        rot,
      });
    };
    const half = side / 2 + 0.12;
    if (!used) seg(-half, half);
    else if (p.gap < side - 0.6) {
      seg(-half, -p.gap / 2);
      seg(p.gap / 2, half);
    }
  }
  return mergeParts(parts);
}

/** Zweistufige Terrasse unter der Zentrale in der Form des Hauptplatzes. */
function terraceParts(p: PlazaPoly, top: number): Part[] {
  const out: Part[] = [];
  const ex = (r: number, h: number, color: string) => {
    const g = new THREE.ExtrudeGeometry(polyShape(r, p.n, p.rot), {
      depth: h,
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    out.push({ geo: g, color });
  };
  ex(top + 0.55, 0.11, "#cfc7b4");
  ex(top, 0.22, "#ddd5c3");
  return out;
}

export function benchParts(x: number, z: number, rot: number): Part[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const at = (lx: number, lz: number): [number, number] => [
    x + lx * c + lz * s,
    z - lx * s + lz * c,
  ];
  const out: Part[] = [];
  const [sx, sz] = at(0, 0);
  out.push({ geo: box(1.1, 0.06, 0.36), color: WOOD, pos: [sx, 0.42, sz], rot: [0, rot, 0] });
  const [bx, bz] = at(0, -0.17);
  out.push({ geo: box(1.1, 0.3, 0.05), color: WOOD, pos: [bx, 0.64, bz], rot: [0, rot, 0] });
  for (const lx of [-0.48, 0.48]) {
    for (const lz of [-0.13, 0.13]) {
      const [px, pz] = at(lx, lz);
      out.push({ geo: box(0.06, 0.42, 0.06), color: "#4a3424", pos: [px, 0.21, pz] });
    }
  }
  return out;
}

function fountainParts(x: number, z: number): Part[] {
  return [
    { geo: cyl(1.35, 1.42, 0.45, 28), color: STONE, pos: [x, 0.225, z] },
    { geo: cyl(1.18, 1.18, 0.04, 28), color: "#5f9fc6", pos: [x, 0.44, z] },
    { geo: cyl(0.18, 0.22, 1.0, 12), color: STONE, pos: [x, 0.7, z] },
    { geo: cyl(0.55, 0.3, 0.18, 18), color: STONE, pos: [x, 1.2, z] },
    { geo: cyl(0.47, 0.47, 0.03, 18), color: "#6aaed6", pos: [x, 1.28, z] },
    { geo: cyl(0.035, 0.06, 0.45, 8), color: "#a9d3ea", pos: [x, 1.5, z] },
  ];
}

/** Position des Brunnens und des Anschlagbretts am Hauptplatz (rücken mit grösserem Platz nach aussen). */
const fountainPos = (plaza: number) => polar(Math.PI / 2 + 0.78, plaza - 2.2);
export const NOTICE_ANGLE = Math.PI / 2 - 0.78;
export const noticePos = (plaza: number) => polar(NOTICE_ANGLE, plaza - 2.1);

/** Pfosten und Dach des Anschlagbretts (lokal; Brett selbst kommt aus dem Atlas). */
export function noticePostParts(): Part[] {
  const parts: Part[] = [];
  for (const s of [-1.2, 1.2]) {
    parts.push({ geo: box(0.14, 2.3, 0.14), color: "#5e3c22", pos: [s, 1.15, 0] });
  }
  parts.push({
    geo: gable(2.9, 0.45, 0.6),
    color: "#8a5a44",
    pos: [0, 2.3, 0],
    rot: [0, Math.PI / 2, 0],
  });
  return parts;
}

/** Pfosten der Quartiertafel (lokal). */
export function quarterPostParts(): Part[] {
  const parts: Part[] = [];
  for (const s of [-2.35, 2.35]) {
    parts.push({ geo: box(0.18, 3.9, 0.18), color: "#5e3c22", pos: [s, 1.95, 0] });
  }
  parts.push({ geo: box(5.2, 0.14, 0.34), color: "#5e3c22", pos: [0, 3.96, 0.04] });
  return parts;
}

const jit = (i: number, s: number) => {
  const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Ausstattung des Hauptplatzes (Terrasse, Bänke, Pflanzkübel, Brunnen) und Laubbäume im Ring. */
export function mainPlazaDeco(layout: VillageLayout): {
  parts: Part[];
  trees: { x: number; z: number; s: number }[];
} {
  const main = layout.polys.find((p) => p.main);
  if (!main) return { parts: [], trees: [] };
  const fountain = fountainPos(layout.plazaRadius);
  const parts: Part[] = [
    ...terraceParts(main, layout.terrace),
    ...fountainParts(fountain.x, fountain.z),
  ];
  const trees: { x: number; z: number; s: number }[] = [];
  const { n } = main;
  const R = main.a / Math.cos(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = main.rot + (TAU * k) / n;
    const used = main.used.some((u) => angDiff(u, a) < 0.02);
    if (!used) {
      const bd = main.a - 1.5;
      parts.push(
        ...benchParts(
          Math.cos(a) * bd,
          Math.sin(a) * bd,
          Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI,
        ),
      );
    }
    // Pflanzkübel mit Baum in jeder Ecke
    const b = main.rot + Math.PI / n + (TAU * k) / n;
    const pr = R - 1.25;
    const px = Math.cos(b) * pr;
    const pz = Math.sin(b) * pr;
    parts.push(
      { geo: cyl(0.6, 0.52, 0.5, 14), color: "#b9b1a0", pos: [px, 0.25, pz] },
      { geo: cyl(0.5, 0.5, 0.04, 14), color: "#6b5240", pos: [px, 0.5, pz] },
      { geo: cyl(0.07, 0.1, 1.2, 6), color: "#6b4423", pos: [px, 1.1, pz] },
      {
        geo: new THREE.IcosahedronGeometry(0.75, 1),
        color: "#5c9b4f",
        pos: [px, 2.0, pz],
        rot: [0.4, k, 0],
      },
      {
        geo: new THREE.IcosahedronGeometry(0.5, 1),
        color: "#6aa95a",
        pos: [px + 0.25, 2.45, pz - 0.15],
      },
    );
    // Laubbaum-Ring ausserhalb, frei von Wegen, Gärten und Nebenplätzen
    for (const [ang, rr] of [
      [b, R + 3.0],
      [a, main.a + 3.2],
    ]) {
      const tx = Math.cos(ang) * rr;
      const tz = Math.sin(ang) * rr;
      if (
        layout.paths.some((q) => distanceToPolyline(tx, tz, q.points) < 2.6) ||
        isInPlot(layout, tx, tz, 1) ||
        layout.quarters.some((q) => Math.hypot(q.x - tx, q.z - tz) < q.rp + 2)
      ) {
        continue;
      }
      trees.push({ x: tx, z: tz, s: 1.0 + jit(k, ang) * 0.25 });
    }
  }
  return { parts, trees };
}

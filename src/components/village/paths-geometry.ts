import * as THREE from "three";
import type { VillagePath } from "@/lib/paths";
import { cyl, mergeParts, rbox, type Part } from "./geo";

type Pt = { x: number; z: number };

const SURFACES = [
  { main: "#d9cfb0", edge: "#b9ae8e" }, // Sand
  { main: "#bdb6a8", edge: "#99927f" }, // Kies
  { main: "#cfc8bb", edge: "#a39c8e" }, // Platten
  { main: "#86b86b", edge: "#7aab60" }, // Trittsteine (Trampelpfad im Gras)
];

/** Normalen der Linienzug-Punkte (Mittel aus den angrenzenden Segmenten). */
function normals(pts: Pt[]) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: -dz / l, z: dx / l };
  });
}

/** Band entlang eines Linienzugs, flach auf Höhe `y`, mit Breite pro Punkt. */
function ribbon(pts: Pt[], widths: number[], y: number): THREE.BufferGeometry {
  const ns = normals(pts);
  const pos: number[] = [];
  const nor: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    const ux = b[0] - a[0];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vz = c[2] - a[2];
    const up = uz * vx - ux * vz > 0; // y-Komponente von (u × v)
    const [p, q, r] = up ? [a, b, c] : [a, c, b];
    pos.push(...p, ...q, ...r);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const w0 = widths[i] / 2;
    const w1 = widths[i + 1] / 2;
    const l0 = [pts[i].x + ns[i].x * w0, y, pts[i].z + ns[i].z * w0];
    const r0 = [pts[i].x - ns[i].x * w0, y, pts[i].z - ns[i].z * w0];
    const l1 = [pts[i + 1].x + ns[i + 1].x * w1, y, pts[i + 1].z + ns[i + 1].z * w1];
    const r1 = [pts[i + 1].x - ns[i + 1].x * w1, y, pts[i + 1].z - ns[i + 1].z * w1];
    tri(l0, r0, l1);
    tri(r0, r1, l1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Punkt und Richtung bei Bogenlänge `s` entlang des Linienzugs. */
function along(pts: Pt[], s: number) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dz = pts[i + 1].z - pts[i].z;
    const l = Math.hypot(dx, dz);
    if (acc + l >= s) {
      const t = (s - acc) / l;
      return { x: pts[i].x + dx * t, z: pts[i].z + dz * t, angle: Math.atan2(dx, dz) };
    }
    acc += l;
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { x: b.x, z: b.z, angle: Math.atan2(b.x - a.x, b.z - a.z) };
}

const length = (pts: Pt[]) =>
  pts.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z)),
    0,
  );

/** Eine pseudozufällige, aber stabile Zahl 0…1 aus Index und Wegform. */
const jitter = (i: number, salt: number) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Alle Wege als eine einzige Geometrie (ein Draw Call). Pro Weg unterschiedlicher Belag:
 * Sand, Kies, Platten mit Fugen oder Trittsteine. Die Breite schwankt leicht für einen natürlichen Eindruck.
 */
export function buildPathGeometry(paths: VillagePath[]): THREE.BufferGeometry | null {
  if (paths.length === 0) return null;
  const parts: Part[] = [];

  paths.forEach((path, pi) => {
    const pts = path.points;
    const surf = SURFACES[path.surface];
    const widths = pts.map((_, i) => path.width * (0.92 + 0.16 * Math.sin(i * 0.9 + pi)));
    const total = length(pts);

    if (path.surface === 3) {
      // Trampelpfad mit Trittsteinen
      parts.push({
        geo: ribbon(
          pts,
          widths.map((w) => w * 0.7),
          0.01,
        ),
        color: surf.main,
      });
      for (let s = 0.4, k = 0; s < total - 0.3; s += 0.95 + jitter(k, pi) * 0.3, k++) {
        const p = along(pts, s);
        const side = (jitter(k, pi + 3) - 0.5) * 0.5;
        parts.push({
          geo: cyl(0.34 + jitter(k, pi + 1) * 0.12, 0.38, 0.07, 9),
          color: jitter(k, pi + 2) > 0.5 ? "#c4bdae" : "#b3ad9f",
          pos: [p.x + Math.cos(p.angle) * side, 0.04, p.z - Math.sin(p.angle) * side],
          scale: [1, 1, 0.8 + jitter(k, pi) * 0.4],
          rot: [0, jitter(k, pi + 5) * 3, 0],
        });
      }
      return;
    }

    parts.push({
      geo: ribbon(
        pts,
        widths.map((w) => w + 0.45),
        0.012,
      ),
      color: surf.edge,
    });
    parts.push({ geo: ribbon(pts, widths, 0.02), color: surf.main });

    if (path.surface === 2) {
      // Fugen zwischen Platten
      for (let s = 0.7; s < total - 0.4; s += 0.85) {
        const p = along(pts, s);
        parts.push({
          geo: rbox(path.width * 0.95, 0.012, 0.045, 0.004),
          color: surf.edge,
          pos: [p.x, 0.028, p.z],
          rot: [0, p.angle, 0],
        });
      }
    }
    if (path.surface === 1) {
      // Kieselsteine am Rand
      for (let s = 0.5, k = 0; s < total - 0.4; s += 0.55, k++) {
        const p = along(pts, s);
        const side =
          (k % 2 === 0 ? 1 : -1) * (path.width * 0.5 + 0.05) * (0.8 + jitter(k, pi) * 0.3);
        parts.push({
          geo: cyl(0.07, 0.09, 0.05, 6),
          color: "#8f897c",
          pos: [p.x + Math.cos(p.angle) * side, 0.035, p.z - Math.sin(p.angle) * side],
        });
      }
    }
  });

  return mergeParts(parts);
}

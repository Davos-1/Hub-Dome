import * as THREE from "three";
import { QUARTER_COLORS } from "@/lib/layout";
import type { VillagePath } from "@/lib/paths";
import { smooth } from "@/lib/terrain";
import { seededRandom } from "@/lib/random";

type Pt = { x: number; z: number };

/** Farben der Dorfwege (Hauptwege zu den Quartieren). */
const VILLAGE_PATH = { main: "#d3cbb5", edge: "#aaa188" };
const GRASS = "#86bf6c";

/** Punkte im festen Abstand `step` entlang des Linienzugs. */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let i = 0;
  let acc = 0;
  let next = step;
  while (i < pts.length - 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    while (acc + l >= next) {
      const t = (next - acc) / l;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      next += step;
    }
    acc += l;
    i++;
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function normals(pts: Pt[]): Pt[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: -dz / l, z: dx / l };
  });
}

/** Breite des Wegs nach Bogenlänge `s`: am Platz aufgeweitet (Einmündung), leicht schwankend. */
function widthAt(width: number, s: number, seed: number): number {
  return width * (1 + 0.7 * Math.max(0, 1 - s / 1.6) ** 2 + 0.025 * Math.sin(s * 0.6 + seed));
}

/**
 * Weg als Band mit neun Stützpunkten quer: Gras → Kante → Belag → Kante → Gras. Der Grasübergang
 * blendet an Anfang und Ende aus. UV in Metern für die Kies-Textur, die Vertexfarbe bestimmt den Ton.
 */
function ribbon(path: VillagePath, main: string, edge: string) {
  const pts = resample(path.points, 0.3);
  const ns = normals(pts);
  const cMain = new THREE.Color(main);
  const cEdge = new THREE.Color(edge);
  const cGrass = new THREE.Color(GRASS);
  const cEdgeSoft = cEdge.clone().lerp(cGrass, 0.25);
  const total = pts.reduce(
    (s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0),
    0,
  );

  type V = { x: number; y: number; z: number; c: THREE.Color; u: number; v: number };
  const rows: V[][] = [];
  let acc = 0;
  pts.forEach((p, i) => {
    if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const w = widthAt(path.width, acc, path.seed) / 2;
    const e = 0.16;
    const b = 0.45 * smooth((acc - 0.4) / 1.6) * smooth((total - acc) / 0.6 + 0.0001);
    const offs = [-(w + e + b), -(w + e), -w, -w / 2, 0, w / 2, w, w + e, w + e + b];
    const ys = [0.008, 0.014, 0.022, 0.022, 0.022, 0.022, 0.022, 0.014, 0.008];
    const cols = [cGrass, cEdgeSoft, cEdge, cMain, cMain, cMain, cEdge, cEdgeSoft, cGrass];
    rows.push(
      offs.map((o, j) => ({
        x: p.x + ns[i].x * o,
        y: ys[j],
        z: p.z + ns[i].z * o,
        c: cols[j],
        u: o / 1.4,
        v: acc / 1.4,
      })),
    );
  });

  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const push = (v: V) => {
    pos.push(v.x, v.y, v.z);
    nor.push(0, 1, 0);
    col.push(v.c.r, v.c.g, v.c.b);
    uv.push(v.u, v.v);
  };
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < 8; j++) {
      const a = rows[i][j];
      const b = rows[i][j + 1];
      const c = rows[i + 1][j];
      const d = rows[i + 1][j + 1];
      for (const [p, q, r] of [
        [a, b, c],
        [b, d, c],
      ]) {
        const up = (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z) > 0;
        if (up) {
          push(p);
          push(q);
          push(r);
        } else {
          push(p);
          push(r);
          push(q);
        }
      }
    }
  }
  return { pos, nor, col, uv };
}

/** Alle Wege des Dorfs als eine Geometrie (ein Draw Call). */
export function buildPathGeometry(paths: VillagePath[]): THREE.BufferGeometry | null {
  if (paths.length === 0) return null;
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  for (const path of paths) {
    const colors =
      path.kind === "haus" && path.quarterIndex !== null
        ? QUARTER_COLORS[path.quarterIndex % QUARTER_COLORS.length]
        : VILLAGE_PATH;
    const r = ribbon(path, colors.main, colors.edge);
    for (const k of r.pos) pos.push(k);
    for (const k of r.nor) nor.push(k);
    for (const k of r.col) col.push(k);
    for (const k of r.uv) uv.push(k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** Kachelbare Kies-Textur (hell, damit die Vertexfarbe den Ton bestimmt). */
export function gravelTexture(): THREE.CanvasTexture {
  const N = 512;
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const ctx = c.getContext("2d")!;
  const rnd = seededRandom("kies");
  ctx.fillStyle = "#f3f0e9";
  ctx.fillRect(0, 0, N, N);
  const dot = (x: number, y: number, r: number, colour: string) => {
    ctx.fillStyle = colour;
    // an allen Rändern spiegeln, damit die Textur nahtlos kachelt
    for (const dx of [-N, 0, N]) {
      for (const dy of [-N, 0, N]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * (0.7 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 260; i++) {
    dot(
      rnd() * N,
      rnd() * N,
      10 + rnd() * 22,
      `rgba(${(200 + rnd() * 30) | 0},${(195 + rnd() * 30) | 0},${(185 + rnd() * 30) | 0},0.35)`,
    );
  }
  for (let i = 0; i < 5200; i++) {
    const g = (205 + rnd() * 50) | 0;
    dot(rnd() * N, rnd() * N, 1.2 + rnd() * 3.2, `rgb(${g},${g - 4},${g - 10})`);
  }
  for (let i = 0; i < 900; i++) {
    dot(rnd() * N, rnd() * N, 0.8 + rnd() * 1.4, "rgba(255,255,255,0.7)");
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

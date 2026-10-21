import * as THREE from "three";
import type { Tier } from "@/lib/layout";
import { arch, box, cyl, gable, mergeParts, rbox, sphere, type Part } from "./geo";

/** Geometrie eines Gebäudes: `body` mit Vertex-Farben, `glow` = leuchtende Teile (Fenster, Laternen). */
export type Model = { body: THREE.BufferGeometry; glow: THREE.BufferGeometry };

const STONE = "#b8b2a7";
const WHITE = "#f6f3ec";
const WOOD = "#7a4a2b";
const BRICK = "#a35a45";
const SMOKE = "#f1f1f1";

export const ROOF_COLORS = ["#b4533a", "#4b6178", "#7a5c3e", "#5d7a52", "#8a4b5e"];

/** Stabile Dachfarbe aus einer ID. */
export function roofColorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ROOF_COLORS[h % ROOF_COLORS.length];
}

const darken = (hex: string, f: number) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
};

/** Fenster mit Rahmen, Sprossen und leuchtender Scheibe an der Vorderseite (+z). */
function frontWindow(
  body: Part[],
  glow: Part[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  shutter: string,
) {
  body.push({ geo: rbox(w + 0.14, h + 0.14, 0.1, 0.02), color: WHITE, pos: [x, y, z] });
  glow.push({ geo: box(w, h, 0.12), color: "#ffe2a0", pos: [x, y, z] });
  body.push({ geo: box(0.035, h, 0.14), color: WHITE, pos: [x, y, z] });
  body.push({ geo: box(w, 0.035, 0.14), color: WHITE, pos: [x, y, z] });
  for (const side of [-1, 1]) {
    body.push({
      geo: rbox(w * 0.38, h + 0.16, 0.06, 0.02),
      color: shutter,
      pos: [x + side * (w / 2 + w * 0.3), y, z - 0.01],
    });
  }
  // Blumenkasten
  body.push({
    geo: rbox(w + 0.1, 0.12, 0.16, 0.02),
    color: WOOD,
    pos: [x, y - h / 2 - 0.12, z + 0.1],
  });
  const flowers = ["#ec4899", "#f59e0b", "#ef4444"];
  for (let i = 0; i < 4; i++) {
    body.push({
      geo: sphere(0.05, 8),
      color: flowers[i % flowers.length],
      pos: [x - w / 2 + 0.06 + (i * (w - 0.12)) / 3, y - h / 2 - 0.03, z + 0.1],
    });
  }
}

/** Normales Wohnhaus, Grösse nach `tier`. Ursprung am Boden, Front zeigt nach +z. */
export function houseModel(fp: number, tier: Tier, wall: string, roof: string): Model {
  const body: Part[] = [];
  const glow: Part[] = [];
  const w = fp * 2;
  const d = fp * 2.1;
  const h = fp * 1.5;
  const base = 0.18;
  const shutter = darken(roof, 0.9);

  body.push({ geo: rbox(w + 0.14, base, d + 0.14, 0.04), color: STONE, pos: [0, base / 2, 0] });
  body.push({ geo: rbox(w, h, d, 0.08), color: wall, pos: [0, base + h / 2, 0] });
  body.push({ geo: gable(w + 0.6, fp * 0.95, d + 0.6), color: roof, pos: [0, base + h, 0] });
  // Dachfirst
  body.push({
    geo: rbox(0.12, 0.1, d + 0.62, 0.03),
    color: darken(roof, 0.75),
    pos: [0, base + h + fp * 0.95, 0],
  });

  // Tür mit Bogen und Stufe
  const doorW = fp * 0.55;
  const doorH = fp * 0.75;
  body.push({ geo: box(doorW, doorH, 0.1), color: WOOD, pos: [0, base + doorH / 2, d / 2 + 0.01] });
  body.push({ geo: arch(doorW / 2, 0.1), color: WOOD, pos: [0, base + doorH, d / 2 + 0.01] });
  body.push({
    geo: sphere(0.045, 8),
    color: "#e0b341",
    pos: [doorW * 0.3, base + doorH * 0.5, d / 2 + 0.08],
  });
  body.push({
    geo: rbox(doorW + 0.5, 0.1, 0.4, 0.03),
    color: STONE,
    pos: [0, base + 0.01, d / 2 + 0.22],
  });

  // Fenster vorn und seitlich
  frontWindow(body, glow, -fp * 0.66, base + h * 0.62, d / 2 + 0.03, fp * 0.36, fp * 0.42, shutter);
  frontWindow(body, glow, fp * 0.66, base + h * 0.62, d / 2 + 0.03, fp * 0.36, fp * 0.42, shutter);
  for (const side of [-1, 1]) {
    body.push({
      geo: rbox(0.1, fp * 0.56, fp * 0.5, 0.02),
      color: WHITE,
      pos: [side * (w / 2 + 0.01), base + h * 0.6, 0],
    });
    glow.push({
      geo: box(0.12, fp * 0.42, fp * 0.36),
      color: "#ffe2a0",
      pos: [side * (w / 2 + 0.01), base + h * 0.6, 0],
    });
  }

  if (tier >= 2) {
    // Kamin mit Rauch
    const cx = fp * 0.55;
    const cz = -d * 0.18;
    const cy = base + h + fp * 0.45;
    body.push({ geo: box(fp * 0.3, fp * 0.9, fp * 0.3), color: BRICK, pos: [cx, cy, cz] });
    body.push({
      geo: box(fp * 0.4, 0.08, fp * 0.4),
      color: darken(BRICK, 0.8),
      pos: [cx, cy + fp * 0.47, cz],
    });
    for (let i = 0; i < 3; i++) {
      body.push({
        geo: sphere(0.12 + i * 0.05, 8),
        color: SMOKE,
        pos: [cx + i * 0.12, cy + fp * 0.7 + i * 0.32, cz],
      });
    }
    // Vordach über der Tür
    body.push({
      geo: rbox(doorW + 0.9, 0.07, 0.6, 0.02),
      color: darken(roof, 1.1),
      pos: [0, base + doorH + 0.35, d / 2 + 0.3],
      rot: [0.15, 0, 0],
    });
    for (const side of [-1, 1]) {
      body.push({
        geo: cyl(0.04, 0.04, doorH + 0.3, 8),
        color: WHITE,
        pos: [side * (doorW / 2 + 0.35), base + (doorH + 0.3) / 2, d / 2 + 0.5],
      });
    }
  }

  if (tier >= 3) {
    // Anbau rechts mit eigenem Dach
    const aw = fp * 1.1;
    const ah = h * 0.72;
    const ad = d * 0.85;
    const ax = w / 2 + aw / 2 - 0.05;
    body.push({ geo: rbox(aw, ah, ad, 0.07), color: wall, pos: [ax, base + ah / 2, -d * 0.05] });
    body.push({
      geo: gable(ad + 0.5, fp * 0.7, aw + 0.5),
      color: roof,
      pos: [ax, base + ah, -d * 0.05],
      rot: [0, Math.PI / 2, 0],
    });
    body.push({
      geo: rbox(aw + 0.1, base, ad + 0.1, 0.03),
      color: STONE,
      pos: [ax, base / 2, -d * 0.05],
    });
    glow.push({
      geo: box(fp * 0.42, fp * 0.42, 0.12),
      color: "#ffe2a0",
      pos: [ax, base + ah * 0.55, -d * 0.05 + ad / 2],
    });
    body.push({
      geo: rbox(fp * 0.52, fp * 0.52, 0.09, 0.02),
      color: WHITE,
      pos: [ax, base + ah * 0.55, -d * 0.05 + ad / 2 - 0.02],
    });
    // Fahne auf dem First
    body.push({
      geo: cyl(0.03, 0.03, fp * 1.1, 6),
      color: "#4b5563",
      pos: [0, base + h + fp * 1.45, d * 0.3],
    });
    body.push({
      geo: box(0.55, 0.3, 0.03),
      color: "#ef4444",
      pos: [0.3, base + h + fp * 1.85, d * 0.3],
    });
    // Laterne neben der Tür
    body.push({
      geo: cyl(0.04, 0.05, 0.9, 8),
      color: "#374151",
      pos: [doorW + 0.55, 0.45, d / 2 + 0.7],
    });
    glow.push({ geo: sphere(0.12, 8), color: "#ffd479", pos: [doorW + 0.55, 0.98, d / 2 + 0.7] });
  }

  return { body: mergeParts(body), glow: mergeParts(glow) };
}

/** Die Zentrale: Haupthalle mit Säulenvorbau, Uhrturm und Fahne. */
export function zentraleModel(fp: number): Model {
  const body: Part[] = [];
  const glow: Part[] = [];
  const w = fp * 2.1;
  const d = fp * 1.7;
  const h = fp * 1.35;
  const base = 0.25;
  const wall = "#eadfc4";
  const roof = "#a94f3a";

  body.push({ geo: rbox(w + 0.3, base, d + 0.3, 0.05), color: STONE, pos: [0, base / 2, 0] });
  body.push({ geo: rbox(w, h, d, 0.1), color: wall, pos: [0, base + h / 2, 0] });
  body.push({ geo: gable(w + 0.8, fp * 0.8, d + 0.8), color: roof, pos: [0, base + h, 0] });
  body.push({
    geo: rbox(0.16, 0.12, d + 0.82, 0.03),
    color: darken(roof, 0.75),
    pos: [0, base + h + fp * 0.8, 0],
  });

  // Uhrturm
  const tw = fp * 0.85;
  const th = fp * 2.1;
  body.push({
    geo: rbox(tw, th, tw, 0.08),
    color: "#e2d3ae",
    pos: [0, base + h + th / 2 - 0.3, -d * 0.18],
  });
  body.push({
    geo: new THREE.ConeGeometry(tw * 0.78, fp * 1.1, 4),
    color: roof,
    pos: [0, base + h + th + fp * 0.25, -d * 0.18],
    rot: [0, Math.PI / 4, 0],
  });
  glow.push({
    geo: cyl(fp * 0.24, fp * 0.24, 0.08, 20),
    color: "#fff6dc",
    pos: [0, base + h + th * 0.62, -d * 0.18 + tw / 2 + 0.01],
    rot: [Math.PI / 2, 0, 0],
  });
  body.push({
    geo: box(0.04, fp * 0.17, 0.1),
    color: "#1f2937",
    pos: [0, base + h + th * 0.62 + fp * 0.06, -d * 0.18 + tw / 2 + 0.07],
  });
  body.push({
    geo: box(fp * 0.12, 0.04, 0.1),
    color: "#1f2937",
    pos: [fp * 0.05, base + h + th * 0.62, -d * 0.18 + tw / 2 + 0.07],
  });
  body.push({
    geo: cyl(0.035, 0.035, fp * 0.9, 6),
    color: "#4b5563",
    pos: [0, base + h + th + fp * 1.1, -d * 0.18],
  });
  body.push({
    geo: box(0.65, 0.35, 0.03),
    color: "#ef4444",
    pos: [0.35, base + h + th + fp * 1.35, -d * 0.18],
  });

  // Säulenvorbau mit Giebel
  const pz = d / 2 + fp * 0.55;
  for (const x of [-0.7, -0.23, 0.23, 0.7]) {
    body.push({
      geo: cyl(0.1, 0.12, h * 0.9, 12),
      color: WHITE,
      pos: [x * fp, base + (h * 0.9) / 2, pz],
    });
  }
  body.push({
    geo: rbox(fp * 1.8, 0.12, fp * 1.1, 0.03),
    color: WHITE,
    pos: [0, base + h * 0.9 + 0.06, d / 2 + fp * 0.28],
  });
  body.push({
    geo: gable(fp * 1.9, fp * 0.45, fp * 1.15, 0.03),
    color: WHITE,
    pos: [0, base + h * 0.9 + 0.12, d / 2 + fp * 0.28],
  });
  body.push({
    geo: rbox(fp * 2.0, 0.12, fp * 1.4, 0.03),
    color: STONE,
    pos: [0, base + 0.06, d / 2 + fp * 0.45],
  });
  body.push({
    geo: rbox(fp * 2.2, 0.12, fp * 1.7, 0.03),
    color: STONE,
    pos: [0, base + 0.0, d / 2 + fp * 0.6],
  });

  // Portal und Fenster
  const dw = fp * 0.7;
  const dh = fp * 0.95;
  body.push({ geo: box(dw, dh, 0.1), color: WOOD, pos: [0, base + dh / 2, d / 2 + 0.01] });
  body.push({ geo: arch(dw / 2, 0.1), color: WOOD, pos: [0, base + dh, d / 2 + 0.01] });
  for (const x of [-1.5, -0.95, 0.95, 1.5]) {
    if (Math.abs(x) < 1) continue;
    glow.push({
      geo: box(fp * 0.34, fp * 0.5, 0.1),
      color: "#ffe2a0",
      pos: [x * fp * 0.5, base + h * 0.55, d / 2 + 0.03],
    });
    body.push({
      geo: rbox(fp * 0.46, fp * 0.62, 0.08, 0.02),
      color: WHITE,
      pos: [x * fp * 0.5, base + h * 0.55, d / 2],
    });
  }
  for (const side of [-1, 1]) {
    glow.push({
      geo: box(0.1, fp * 0.5, fp * 0.4),
      color: "#ffe2a0",
      pos: [side * (w / 2 + 0.01), base + h * 0.55, 0],
    });
  }
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

/** Baustelle (Haus ohne Objekte): Gerüst, Ziegelstapel, Kran. */
export function constructionModel(fp: number): Model {
  const body: Part[] = [];
  const glow: Part[] = [];
  const yellow = "#f4c430";
  body.push({ geo: rbox(fp * 2.2, 0.16, fp * 2.2, 0.03), color: "#a8a29e", pos: [0, 0.08, 0] });
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    body.push({
      geo: box(0.09, fp * 2, 0.09),
      color: yellow,
      pos: [x * fp * 0.9, fp + 0.1, z * fp * 0.9],
    });
  }
  for (const y of [0.8, 1.5, 2.2]) {
    if (y > fp * 2) continue;
    body.push({ geo: box(fp * 1.85, 0.06, 0.06), color: yellow, pos: [0, y, fp * 0.9] });
    body.push({ geo: box(fp * 1.85, 0.06, 0.06), color: yellow, pos: [0, y, -fp * 0.9] });
    body.push({ geo: box(0.06, 0.06, fp * 1.85), color: yellow, pos: [fp * 0.9, y, 0] });
    body.push({ geo: box(0.06, 0.06, fp * 1.85), color: yellow, pos: [-fp * 0.9, y, 0] });
  }
  body.push({ geo: box(fp * 1.7, 0.07, fp * 1.7), color: "#b08968", pos: [0, 0.8, 0] });
  // Ziegelstapel
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2 - Math.min(i, 1); j++) {
      body.push({
        geo: rbox(0.5, 0.2, 0.25, 0.02),
        color: BRICK,
        pos: [fp * 0.2 + j * 0.52, 0.26 + i * 0.21, fp * 0.55],
      });
    }
  }
  // Kran
  body.push({
    geo: box(0.14, fp * 2.8, 0.14),
    color: "#fb923c",
    pos: [-fp * 1.3, fp * 1.4, -fp * 0.9],
  });
  body.push({
    geo: box(fp * 2.4, 0.12, 0.12),
    color: "#fb923c",
    pos: [-fp * 0.2, fp * 2.8, -fp * 0.9],
  });
  body.push({
    geo: cyl(0.015, 0.015, 0.9, 4),
    color: "#1f2937",
    pos: [fp * 0.6, fp * 2.35, -fp * 0.9],
  });
  body.push({
    geo: rbox(0.25, 0.18, 0.25, 0.02),
    color: "#6b7280",
    pos: [fp * 0.6, fp * 1.85, -fp * 0.9],
  });
  // Warnkegel
  for (const x of [-0.6, 0.6]) {
    body.push({
      geo: new THREE.ConeGeometry(0.15, 0.4, 10),
      color: "#f97316",
      pos: [x * fp, 0.36, fp * 1.15],
    });
    body.push({
      geo: new THREE.ConeGeometry(0.1, 0.1, 10),
      color: "#ffffff",
      pos: [x * fp, 0.36, fp * 1.15],
    });
  }
  glow.push({ geo: sphere(0.07, 8), color: "#ff8a3d", pos: [-fp * 1.3, fp * 2.88, -fp * 0.9] });
  return { body: mergeParts(body), glow: mergeParts(glow) };
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

import * as THREE from "three";
import { box, cyl, gable, rbox, sphere } from "../geo";
import { Builder, darken, STONE, WARM, WHITE, WOOD, type Model } from "./common";

/** Schulgebäude: zwei Stockwerke, Mittelrisalit mit Uhr, Glockenturm, Fahnenmast und Schaukel. */
export function schuleModel(fp: number): Model {
  const b = new Builder();
  const w = fp * 2.7;
  const d = fp * 1.35;
  const h = fp * 1.55;
  const base = 0.22;
  const wall = "#e9c9a0";
  const trim = "#f7f1e3";
  const roof = "#9a4f3b";

  b.add({ geo: rbox(w + 0.3, base, d + 0.3, 0.04), color: STONE, pos: [0, base / 2, 0] });
  b.add({ geo: rbox(w, h, d, 0.08), color: wall, pos: [0, base + h / 2, 0] });
  b.add({ geo: rbox(w + 0.2, 0.14, d + 0.2, 0.03), color: trim, pos: [0, base + h + 0.05, 0] });
  b.add({ geo: rbox(w + 0.12, 0.08, d + 0.12, 0.02), color: trim, pos: [0, base + h * 0.5, 0] });
  b.add({
    geo: gable(w * 0.62, fp * 0.5, d * 0.95),
    color: roof,
    pos: [0, base + h + 0.12, 0],
    scale: [1, 1, 1],
  });

  // Fensterreihen (zwei Geschosse), Fensterbänke
  const cols = 7;
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + (w / cols) * (i + 0.5);
    if (Math.abs(x) < fp * 0.55) continue;
    for (const fy of [0.27, 0.74]) {
      const y = base + h * fy;
      b.add({ geo: rbox(fp * 0.34, fp * 0.5, 0.08, 0.02), color: trim, pos: [x, y, d / 2 + 0.01] });
      b.light({ geo: box(fp * 0.26, fp * 0.42, 0.1), color: WARM, pos: [x, y, d / 2 + 0.03] });
      b.add({ geo: box(0.03, fp * 0.42, 0.12), color: trim, pos: [x, y, d / 2 + 0.04] });
    }
  }
  for (const s of [-1, 1]) {
    for (const fy of [0.27, 0.74]) {
      b.light({
        geo: box(0.1, fp * 0.42, fp * 0.5),
        color: WARM,
        pos: [s * (w / 2 + 0.01), base + h * fy, 0],
      });
    }
  }

  // Mittelrisalit mit Eingang, Giebel und Uhr
  const rw = fp * 1.05;
  b.add({
    geo: rbox(rw, h + 0.1, fp * 0.45, 0.06),
    color: darken(wall, 1.06),
    pos: [0, base + (h + 0.1) / 2, d / 2 + 0.2],
  });
  b.add({
    geo: gable(rw + 0.35, fp * 0.45, fp * 0.6, 0.03),
    color: trim,
    pos: [0, base + h + 0.1, d / 2 + 0.2],
  });
  b.light({
    geo: cyl(fp * 0.17, fp * 0.17, 0.06, 18),
    color: "#fff6dc",
    pos: [0, base + h + fp * 0.2, d / 2 + 0.52],
    rot: [Math.PI / 2, 0, 0],
  });
  const dw = fp * 0.55;
  const dh = fp * 0.8;
  b.add({ geo: box(dw, dh, 0.1), color: WOOD, pos: [0, base + dh / 2, d / 2 + 0.43] });
  b.add({
    geo: box(dw * 0.46, dh, 0.12),
    color: darken(WOOD, 1.15),
    pos: [-dw * 0.25, base + dh / 2, d / 2 + 0.44],
  });
  b.add({
    geo: rbox(dw + 0.5, 0.1, 0.5, 0.02),
    color: trim,
    pos: [0, base + dh + 0.15, d / 2 + 0.55],
  });
  for (const i of [0, 1, 2]) {
    b.add({
      geo: rbox(rw + 0.5 - i * 0.2, 0.1, 0.35, 0.02),
      color: STONE,
      pos: [0, base - 0.02 + i * 0.05 - 0.05, d / 2 + 0.75 + (2 - i) * 0.3],
    });
  }
  b.light({
    geo: box(fp * 0.34, fp * 0.34, 0.1),
    color: WARM,
    pos: [0, base + h * 0.78, d / 2 + 0.43],
  });

  // Glockentürmchen auf dem Dach
  const tx = -w * 0.28;
  b.add({
    geo: rbox(fp * 0.55, fp * 0.7, fp * 0.55, 0.04),
    color: trim,
    pos: [tx, base + h + fp * 0.55, -d * 0.1],
  });
  b.add({
    geo: new THREE.ConeGeometry(fp * 0.45, fp * 0.55, 4),
    color: roof,
    pos: [tx, base + h + fp * 1.15, -d * 0.1],
    rot: [0, Math.PI / 4, 0],
  });
  b.light({
    geo: box(fp * 0.2, fp * 0.28, 0.1),
    color: WARM,
    pos: [tx, base + h + fp * 0.6, -d * 0.1 + fp * 0.28],
  });
  b.add({ geo: sphere(0.09, 8), color: "#d4a73a", pos: [tx, base + h + fp * 1.5, -d * 0.1] });

  // Fahnenmast
  b.add({
    geo: cyl(0.04, 0.05, fp * 3.0, 8),
    color: "#9ca3af",
    pos: [-w / 2 - 0.9, fp * 1.5, d / 2 + 0.9],
  });
  b.add({
    geo: box(0.8, 0.5, 0.03),
    color: "#dc2626",
    pos: [-w / 2 - 0.5, fp * 2.75, d / 2 + 0.9],
  });
  b.add({ geo: box(0.28, 0.08, 0.04), color: WHITE, pos: [-w / 2 - 0.5, fp * 2.75, d / 2 + 0.93] });
  b.add({ geo: box(0.08, 0.28, 0.04), color: WHITE, pos: [-w / 2 - 0.5, fp * 2.75, d / 2 + 0.93] });

  // Schaukel
  const sx = w / 2 + 1.2;
  for (const z of [-0.5, 0.5]) {
    b.add({
      geo: cyl(0.04, 0.04, 1.5, 6),
      color: "#2563eb",
      pos: [sx - 0.5, 0.7, z + d * 0.2],
      rot: [0, 0, 0.25],
    });
    b.add({
      geo: cyl(0.04, 0.04, 1.5, 6),
      color: "#2563eb",
      pos: [sx + 0.5, 0.7, z + d * 0.2],
      rot: [0, 0, -0.25],
    });
  }
  b.add({
    geo: cyl(0.04, 0.04, 1.2, 6),
    color: "#2563eb",
    pos: [sx, 1.38, d * 0.2],
    rot: [Math.PI / 2, 0, 0],
  });
  for (const z of [-0.18, 0.18]) {
    b.add({ geo: cyl(0.01, 0.01, 0.9, 4), color: "#374151", pos: [sx, 0.9, d * 0.2 + z * 1.2] });
    b.add({
      geo: rbox(0.3, 0.04, 0.2, 0.01),
      color: "#f59e0b",
      pos: [sx, 0.45, d * 0.2 + z * 1.2],
    });
  }
  return b.build();
}

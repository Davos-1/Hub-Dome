import * as THREE from "three";
import { arch, box, cyl, gable, rbox } from "../geo";
import { Builder, darken, STONE, WARM, WHITE, WOOD, type Model } from "./common";

/** Rathaus: Haupthalle mit Säulenvorbau, Uhrturm und Fahne. */
export function rathausModel(fp: number): Model {
  const b = new Builder();
  const w = fp * 2.1;
  const d = fp * 1.7;
  const h = fp * 1.35;
  const base = 0.25;
  const wall = "#eadfc4";
  const roof = "#a94f3a";

  b.add({ geo: rbox(w + 0.3, base, d + 0.3, 0.05), color: STONE, pos: [0, base / 2, 0] });
  b.add({ geo: rbox(w, h, d, 0.1), color: wall, pos: [0, base + h / 2, 0] });
  b.add({ geo: gable(w + 0.8, fp * 0.8, d + 0.8), color: roof, pos: [0, base + h, 0] });
  b.add({
    geo: rbox(0.16, 0.12, d + 0.82, 0.03),
    color: darken(roof, 0.75),
    pos: [0, base + h + fp * 0.8, 0],
  });

  const tw = fp * 0.85;
  const th = fp * 2.1;
  b.add({
    geo: rbox(tw, th, tw, 0.08),
    color: "#e2d3ae",
    pos: [0, base + h + th / 2 - 0.3, -d * 0.18],
  });
  b.add({
    geo: new THREE.ConeGeometry(tw * 0.78, fp * 1.1, 4),
    color: roof,
    pos: [0, base + h + th + fp * 0.25, -d * 0.18],
    rot: [0, Math.PI / 4, 0],
  });
  b.light({
    geo: cyl(fp * 0.24, fp * 0.24, 0.08, 20),
    color: "#fff6dc",
    pos: [0, base + h + th * 0.62, -d * 0.18 + tw / 2 + 0.01],
    rot: [Math.PI / 2, 0, 0],
  });
  b.add({
    geo: box(0.04, fp * 0.17, 0.1),
    color: "#1f2937",
    pos: [0, base + h + th * 0.62 + fp * 0.06, -d * 0.18 + tw / 2 + 0.07],
  });
  b.add({
    geo: box(fp * 0.12, 0.04, 0.1),
    color: "#1f2937",
    pos: [fp * 0.05, base + h + th * 0.62, -d * 0.18 + tw / 2 + 0.07],
  });
  b.add({
    geo: cyl(0.035, 0.035, fp * 0.9, 6),
    color: "#4b5563",
    pos: [0, base + h + th + fp * 1.1, -d * 0.18],
  });
  b.add({
    geo: box(0.65, 0.35, 0.03),
    color: "#ef4444",
    pos: [0.35, base + h + th + fp * 1.35, -d * 0.18],
  });

  const pz = d / 2 + fp * 0.55;
  for (const x of [-0.7, -0.23, 0.23, 0.7]) {
    b.add({
      geo: cyl(0.1, 0.12, h * 0.9, 12),
      color: WHITE,
      pos: [x * fp, base + (h * 0.9) / 2, pz],
    });
  }
  b.add({
    geo: rbox(fp * 1.8, 0.12, fp * 1.1, 0.03),
    color: WHITE,
    pos: [0, base + h * 0.9 + 0.06, d / 2 + fp * 0.28],
  });
  b.add({
    geo: gable(fp * 1.9, fp * 0.45, fp * 1.15, 0.03),
    color: WHITE,
    pos: [0, base + h * 0.9 + 0.12, d / 2 + fp * 0.28],
  });
  b.add({
    geo: rbox(fp * 2.0, 0.12, fp * 1.4, 0.03),
    color: STONE,
    pos: [0, base + 0.06, d / 2 + fp * 0.45],
  });
  b.add({
    geo: rbox(fp * 2.2, 0.12, fp * 1.7, 0.03),
    color: STONE,
    pos: [0, base, d / 2 + fp * 0.6],
  });

  const dw = fp * 0.7;
  const dh = fp * 0.95;
  b.add({ geo: box(dw, dh, 0.1), color: WOOD, pos: [0, base + dh / 2, d / 2 + 0.01] });
  b.add({ geo: arch(dw / 2, 0.1), color: WOOD, pos: [0, base + dh, d / 2 + 0.01] });
  for (const x of [-1.5, 1.5]) {
    b.light({
      geo: box(fp * 0.34, fp * 0.5, 0.1),
      color: WARM,
      pos: [x * fp * 0.5, base + h * 0.55, d / 2 + 0.03],
    });
    b.add({
      geo: rbox(fp * 0.46, fp * 0.62, 0.08, 0.02),
      color: WHITE,
      pos: [x * fp * 0.5, base + h * 0.55, d / 2],
    });
  }
  for (const side of [-1, 1]) {
    b.light({
      geo: box(0.1, fp * 0.5, fp * 0.4),
      color: WARM,
      pos: [side * (w / 2 + 0.01), base + h * 0.55, 0],
    });
  }
  return b.build();
}

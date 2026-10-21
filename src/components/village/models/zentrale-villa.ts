import * as THREE from "three";
import { arch, box, cyl, gable, rbox, sphere } from "../geo";
import { Builder, darken, STONE, WARM, WHITE, WOOD, type Model } from "./common";

/** Villa: Hauptbau mit Walmdach und Säulenbalkon, Seitenflügel, Terrasse mit Balustrade, Pool und Palmen. */
export function villaModel(fp: number): Model {
  const b = new Builder();
  const base = 0.25;
  const cream = "#f3ead6";
  const terracotta = "#b9573b";

  b.add({ geo: rbox(fp * 3.2, base, fp * 2.4, 0.05), color: STONE, pos: [0, base / 2, 0] });

  const w = fp * 1.7;
  const d = fp * 1.4;
  const h = fp * 1.35;
  b.add({ geo: rbox(w, h, d, 0.08), color: cream, pos: [0, base + h / 2, 0] });
  // Walmdach als vierseitige Pyramide
  b.add({
    geo: new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, fp * 0.85, 4),
    color: terracotta,
    pos: [0, base + h + fp * 0.4, 0],
    rot: [0, Math.PI / 4, 0],
    scale: [(w / Math.hypot(w, d)) * 1.18, 1, (d / Math.hypot(w, d)) * 1.18],
  });
  b.add({
    geo: cyl(0.2, 0.22, fp * 0.7, 10),
    color: "#a35a45",
    pos: [fp * 0.45, base + h + fp * 0.55, -d * 0.2],
  });

  // Seitenflügel
  for (const s of [-1, 1]) {
    const sw = fp * 0.95;
    const sh = h * 0.72;
    const sx = s * (w / 2 + sw / 2 - 0.05);
    b.add({ geo: rbox(sw, sh, d * 0.8, 0.07), color: cream, pos: [sx, base + sh / 2, -d * 0.05] });
    b.add({
      geo: gable(d * 0.8 + 0.5, fp * 0.5, sw + 0.5),
      color: terracotta,
      pos: [sx, base + sh, -d * 0.05],
      rot: [0, Math.PI / 2, 0],
    });
    b.add({
      geo: arch(fp * 0.14, 0.08),
      color: WHITE,
      pos: [sx, base + sh * 0.62, d * 0.35 + 0.03],
    });
    b.light({
      geo: box(fp * 0.28, fp * 0.46, 0.1),
      color: WARM,
      pos: [sx, base + sh * 0.5, d * 0.35 + 0.03],
    });
  }

  // Bogenfenster, Portal mit Säulen und Balkon
  for (const x of [-0.62, 0.62]) {
    b.add({
      geo: rbox(fp * 0.34, fp * 0.62, 0.09, 0.02),
      color: WHITE,
      pos: [x * fp, base + h * 0.42, d / 2 + 0.01],
    });
    b.add({
      geo: arch(fp * 0.17, 0.09),
      color: WHITE,
      pos: [x * fp, base + h * 0.42 + fp * 0.31, d / 2 + 0.01],
    });
    b.light({
      geo: box(fp * 0.26, fp * 0.55, 0.1),
      color: WARM,
      pos: [x * fp, base + h * 0.42, d / 2 + 0.03],
    });
    b.light({
      geo: box(fp * 0.26, fp * 0.45, 0.1),
      color: WARM,
      pos: [x * fp, base + h * 0.82, d / 2 + 0.03],
    });
  }
  b.add({
    geo: box(fp * 0.5, fp * 0.82, 0.1),
    color: WOOD,
    pos: [0, base + fp * 0.41, d / 2 + 0.01],
  });
  b.add({ geo: arch(fp * 0.25, 0.1), color: WOOD, pos: [0, base + fp * 0.82, d / 2 + 0.01] });
  for (const x of [-0.42, 0.42]) {
    b.add({
      geo: cyl(0.09, 0.11, h * 0.62, 12),
      color: WHITE,
      pos: [x * fp, base + (h * 0.62) / 2, d / 2 + 0.55],
    });
  }
  b.add({
    geo: rbox(fp * 1.25, 0.1, 1.0, 0.03),
    color: WHITE,
    pos: [0, base + h * 0.62 + 0.05, d / 2 + 0.5],
  });
  for (let i = 0; i < 9; i++) {
    b.add({
      geo: cyl(0.03, 0.03, 0.34, 6),
      color: WHITE,
      pos: [-fp * 0.58 + (i * fp * 1.16) / 8, base + h * 0.62 + 0.27, d / 2 + 0.95],
    });
  }
  b.add({
    geo: box(fp * 1.2, 0.05, 0.07),
    color: WHITE,
    pos: [0, base + h * 0.62 + 0.46, d / 2 + 0.95],
  });

  // Terrasse mit Treppe
  b.add({
    geo: rbox(fp * 2.2, 0.12, fp * 0.9, 0.03),
    color: "#d8d1c0",
    pos: [0, base + 0.06, d / 2 + fp * 0.55],
  });
  b.add({
    geo: rbox(fp * 1.2, 0.1, 0.5, 0.02),
    color: STONE,
    pos: [0, base + 0.02, d / 2 + fp * 1.15],
  });

  // Pool
  const px = fp * 1.7;
  b.add({
    geo: rbox(fp * 1.6, 0.12, fp * 1.1, 0.04),
    color: WHITE,
    pos: [px, base + 0.06, fp * 0.5],
  });
  b.light({
    geo: rbox(fp * 1.4, 0.05, fp * 0.9, 0.03),
    color: "#7dd3fc",
    pos: [px, base + 0.13, fp * 0.5],
  });
  for (const z of [-0.3, 0.3])
    b.add({
      geo: cyl(0.03, 0.03, 0.3, 6),
      color: "#d1d5db",
      pos: [px + fp * 0.5, base + 0.24, fp * 0.5 + z * fp],
    });

  // Palmen
  for (const [x, z] of [
    [-fp * 1.85, d / 2 + 0.6],
    [fp * 1.2, d / 2 + fp * 1.2],
  ] as const) {
    b.add({
      geo: cyl(0.06, 0.1, fp * 1.4, 8),
      color: "#8a6a45",
      pos: [x, fp * 0.7 + base, z],
      rot: [0, 0, 0.1],
    });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.add({
        geo: sphere(0.28, 8),
        color: "#4f9a58",
        pos: [x + Math.cos(a) * 0.35 + 0.1, fp * 1.4 + base + 0.05, z + Math.sin(a) * 0.35],
        scale: [1.4, 0.3, 0.6],
        rot: [0, -a, 0.2],
      });
    }
  }
  void darken;
  return b.build();
}

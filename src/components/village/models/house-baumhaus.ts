import type { Tier } from "@/lib/layout";
import { box, cyl, gable, rbox, sphere } from "../geo";
import { Builder, darken, mix, WARM, WOOD, type Model } from "./common";

const BARK = "#6b4a2e";
const LEAVES = ["#4f9a58", "#5ba861", "#3f8a4e", "#6cb56a"];

/** Plattform mit Rundum-Geländer. */
function platform(b: Builder, x: number, y: number, z: number, r: number, wood: string) {
  b.add({ geo: cyl(r, r * 0.96, 0.14, 14), color: wood, pos: [x, y, z] });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    // vorn (zur Zentrale, +z) bleibt eine Lücke für die Leiter
    if (Math.cos(a - Math.PI / 2) > 0.92) continue;
    b.add({
      geo: cyl(0.035, 0.035, 0.5, 6),
      color: WOOD,
      pos: [x + Math.cos(a) * (r - 0.06), y + 0.32, z + Math.sin(a) * (r - 0.06)],
    });
  }
}

/** Baumhaus: grosser Baum mit Hütte auf der Plattform, Leiter; grösser mit Seilbrücke, Nebenplattform und Aussichtshütte. */
export function baumhausModel(fp: number, tier: Tier, wall: string, roof: string): Model {
  const b = new Builder();
  const wood = mix("#b08a5b", wall, 0.15);
  const trunkH = fp * 3.6;

  // Wurzeln und Stamm
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.4;
    b.add({
      geo: sphere(0.22, 8),
      color: BARK,
      pos: [Math.cos(a) * fp * 0.38, 0.1, Math.sin(a) * fp * 0.38 - 0.1],
      scale: [1.5, 0.6, 1],
    });
  }
  b.add({ geo: cyl(fp * 0.28, fp * 0.4, trunkH, 12), color: BARK, pos: [0, trunkH / 2, -0.1] });
  // Äste
  for (const [rx, rz, y] of [
    [0.5, 0, 0.62],
    [-0.5, 0.3, 0.7],
    [0.1, -0.6, 0.8],
  ] as const) {
    b.add({
      geo: cyl(fp * 0.08, fp * 0.15, fp * 1.3, 8),
      color: BARK,
      pos: [rx * fp * 0.55, trunkH * y, rz * fp * 0.5 - 0.1],
      rot: [rz * 1.0, 0, -rx * 1.0],
    });
  }
  // Blätterdach
  const crown: [number, number, number, number][] = [
    [0, 0.98, 0, 1.25],
    [0.9, 0.86, 0.3, 0.95],
    [-0.9, 0.9, -0.2, 1.0],
    [0.2, 0.9, 0.95, 0.9],
    [-0.3, 0.85, -0.9, 0.95],
    [0.1, 1.12, 0.1, 0.9],
  ];
  crown.forEach(([x, y, z, s], i) => {
    b.add({
      geo: sphere(fp * s, 12),
      color: LEAVES[i % LEAVES.length],
      pos: [x * fp, trunkH * y + fp * 0.3, z * fp - 0.1],
    });
  });

  // Hauptplattform mit Hütte
  const py = fp * 1.5;
  platform(b, 0, py, 0, fp * 1.5, wood);
  const hw = fp * 1.5;
  const hd = fp * 1.3;
  const hh = fp * 1.0;
  b.add({
    geo: rbox(hw, hh, hd, 0.06),
    color: wall,
    pos: [0.15 * fp, py + 0.07 + hh / 2, -fp * 0.2],
  });
  b.add({
    geo: gable(hw + 0.5, fp * 0.6, hd + 0.5),
    color: roof,
    pos: [0.15 * fp, py + 0.07 + hh, -fp * 0.2],
  });
  b.add({
    geo: rbox(fp * 0.4, fp * 0.7, 0.08, 0.02),
    color: WOOD,
    pos: [0.15 * fp, py + 0.07 + fp * 0.35, -fp * 0.2 + hd / 2 + 0.01],
  });
  b.light({
    geo: box(fp * 0.34, fp * 0.34, 0.1),
    color: WARM,
    pos: [0.15 * fp - fp * 0.5, py + 0.07 + hh * 0.62, -fp * 0.2 + hd / 2 + 0.02],
  });
  b.light({
    geo: box(fp * 0.34, fp * 0.34, 0.1),
    color: WARM,
    pos: [0.15 * fp + fp * 0.5, py + 0.07 + hh * 0.62, -fp * 0.2 + hd / 2 + 0.02],
  });
  b.light({ geo: sphere(0.1, 8), color: "#ffd479", pos: [-fp * 0.9, py + 0.7, fp * 0.7] });
  b.add({ geo: cyl(0.02, 0.02, 0.3, 6), color: "#374151", pos: [-fp * 0.9, py + 0.55, fp * 0.7] });

  // Leiter zum Boden (Richtung Zentrale, +z)
  const lz = fp * 1.55;
  const run = lz + 0.2;
  const tilt = Math.atan2(run - 0.6, py);
  for (const s of [-0.28, 0.28]) {
    b.add({
      geo: cyl(0.035, 0.035, py / Math.cos(tilt) + 0.1, 6),
      color: WOOD,
      pos: [s, py / 2, (lz + 0.5) / 2 + 0.2],
      rot: [tilt, 0, 0],
    });
  }
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    b.add({
      geo: box(0.6, 0.04, 0.05),
      color: "#a97c50",
      pos: [0, py * (1 - t), 0.3 + (lz + 0.2) * t],
      rot: [0, 0, 0],
    });
  }

  if (tier >= 2) {
    // Nebenplattform mit Seilbrücke
    const sx = fp * 2.4;
    const sy = py - fp * 0.55;
    platform(b, sx, sy, fp * 0.2, fp * 0.75, wood);
    b.add({
      geo: cyl(fp * 0.05, fp * 0.08, sy, 8),
      color: BARK,
      pos: [sx, sy / 2 - 0.05, fp * 0.2],
    });
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = fp * 1.5 + (sx - fp * 0.75 - fp * 1.5) * t + fp * 0.1;
      const sag = Math.sin(t * Math.PI) * 0.18;
      b.add({
        geo: rbox(0.14, 0.04, 0.55, 0.01),
        color: "#b08a5b",
        pos: [x, py - (py - sy) * t - sag - 0.02, fp * 0.2],
      });
    }
    for (const s of [-0.3, 0.3]) {
      b.add({
        geo: cyl(0.015, 0.015, sx - fp * 2.2, 4),
        color: "#8a6a45",
        pos: [fp * 1.75 + (sx - fp * 2.2) / 2 - fp * 0.1, py - (py - sy) / 2 + 0.38, fp * 0.2 + s],
        rot: [0, 0, Math.PI / 2 - Math.atan2(py - sy, sx - fp * 2.2) * 0.9],
      });
    }
    b.light({ geo: sphere(0.09, 8), color: "#ffd479", pos: [sx + fp * 0.5, sy + 0.55, fp * 0.5] });
    b.add({
      geo: rbox(fp * 0.6, fp * 0.5, fp * 0.5, 0.04),
      color: darken(wall, 1.1),
      pos: [sx, sy + 0.07 + fp * 0.25, -fp * 0.05],
    });
    b.add({
      geo: gable(fp * 0.8, fp * 0.35, fp * 0.7),
      color: roof,
      pos: [sx, sy + 0.07 + fp * 0.5, -fp * 0.05],
    });
  }

  if (tier >= 3) {
    // Aussichtshütte oben mit Fahne und Lichterkette
    const ty = fp * 2.75;
    platform(b, 0, ty, -0.1, fp * 0.85, wood);
    b.add({
      geo: rbox(fp * 0.7, fp * 0.55, fp * 0.7, 0.04),
      color: wall,
      pos: [0, ty + 0.07 + fp * 0.28, -0.1],
    });
    b.add({
      geo: gable(fp * 0.95, fp * 0.45, fp * 0.95),
      color: roof,
      pos: [0, ty + 0.07 + fp * 0.55, -0.1],
    });
    b.light({
      geo: box(fp * 0.25, fp * 0.22, 0.1),
      color: WARM,
      pos: [0, ty + 0.07 + fp * 0.3, -0.1 + fp * 0.36],
    });
    b.add({ geo: cyl(0.03, 0.03, fp * 0.9, 6), color: "#4b5563", pos: [0, ty + fp * 1.4, -0.1] });
    b.add({ geo: box(0.55, 0.3, 0.03), color: "#ef4444", pos: [0.3, ty + fp * 1.7, -0.1] });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      b.light({
        geo: sphere(0.05, 6),
        color: i % 2 ? "#ffd479" : "#ffb3c7",
        pos: [
          Math.cos(a) * fp * 1.4,
          py + 0.75 + Math.sin(a * 2) * 0.1,
          Math.sin(a) * fp * 1.4 - 0.1,
        ],
      });
    }
  }
  return b.build();
}

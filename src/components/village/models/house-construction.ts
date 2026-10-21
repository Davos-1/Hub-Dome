import * as THREE from "three";
import type { HouseStyle } from "@/lib/styles";
import { box, cyl, cylZ, gable, rbox, sphere } from "../geo";
import { BRICK, Builder, darken, STONE, WOOD, type Model } from "./common";

const YELLOW = "#f4c430";

function cones(b: Builder, fp: number) {
  for (const x of [-0.6, 0.6]) {
    b.add({
      geo: new THREE.ConeGeometry(0.15, 0.4, 10),
      color: "#f97316",
      pos: [x * fp, 0.36, fp * 1.35],
    });
    b.add({
      geo: new THREE.ConeGeometry(0.1, 0.1, 10),
      color: "#ffffff",
      pos: [x * fp, 0.36, fp * 1.35],
    });
  }
  // Absperrband
  b.add({ geo: box(fp * 1.3, 0.05, 0.03), color: "#ef4444", pos: [0, 0.55, fp * 1.35] });
  b.add({ geo: box(fp * 1.3, 0.05, 0.03), color: "#ffffff", pos: [0.15, 0.62, fp * 1.35] });
}

function scaffold(b: Builder, fp: number, levels: number[]) {
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    b.add({
      geo: box(0.08, fp * 1.9, 0.08),
      color: YELLOW,
      pos: [x * fp * 0.95, fp * 0.95 + 0.1, z * fp * 0.95],
    });
  }
  for (const y of levels) {
    for (const z of [-1, 1])
      b.add({ geo: box(fp * 1.9, 0.05, 0.05), color: YELLOW, pos: [0, y, z * fp * 0.95] });
    for (const x of [-1, 1])
      b.add({ geo: box(0.05, 0.05, fp * 1.9), color: YELLOW, pos: [x * fp * 0.95, y, 0] });
    b.add({ geo: box(fp * 1.7, 0.05, fp * 1.7), color: "#b08968", pos: [0, y - 0.05, 0] });
  }
}

function crane(b: Builder, fp: number, x = -1.35) {
  b.add({ geo: box(0.13, fp * 2.8, 0.13), color: "#fb923c", pos: [x * fp, fp * 1.4, -fp * 0.9] });
  b.add({
    geo: box(fp * 2.4, 0.11, 0.11),
    color: "#fb923c",
    pos: [(x + 1.1) * fp, fp * 2.8, -fp * 0.9],
  });
  b.add({
    geo: cyl(0.015, 0.015, 0.9, 4),
    color: "#1f2937",
    pos: [(x + 2.1) * fp, fp * 2.35, -fp * 0.9],
  });
  b.add({
    geo: rbox(0.25, 0.18, 0.25, 0.02),
    color: "#6b7280",
    pos: [(x + 2.1) * fp, fp * 1.85, -fp * 0.9],
  });
  b.light({ geo: sphere(0.07, 8), color: "#ff8a3d", pos: [x * fp, fp * 2.88, -fp * 0.9] });
}

/**
 * Baustelle für ein Haus ohne Objekte. Passend zum gewählten Stil ist der Rohbau sichtbar
 * (Mauern, Stämme, Kuppelrippen, Stahlrahmen, Fahrgestell oder Baumplattform).
 */
export function constructionModel(style: HouseStyle, fp: number): Model {
  const b = new Builder();
  b.add({ geo: rbox(fp * 2.3, 0.14, fp * 2.3, 0.03), color: "#a8a29e", pos: [0, 0.07, 0] });

  switch (style) {
    case "blockhuette": {
      const r = 0.13;
      for (let i = 0; i < 4; i++) {
        const y = 0.14 + r + i * 2 * r;
        for (const s of [-1, 1]) {
          b.add({
            geo: cyl(r, r, fp * 2.2, 10),
            color: i % 2 ? "#8a5a2b" : "#a0693a",
            pos: [0, y, s * (fp - r)],
            rot: [0, 0, Math.PI / 2],
          });
          b.add({
            geo: cyl(r, r, fp * 2.2, 10),
            color: i % 2 ? "#a0693a" : "#8a5a2b",
            pos: [s * (fp - r), y + 0.02, 0],
            rot: [Math.PI / 2, 0, 0],
          });
        }
      }
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 3 - i; k++) {
          b.add({
            geo: cyl(0.12, 0.12, 1.1, 8),
            color: k % 2 ? "#a47241" : "#8a5a2b",
            pos: [fp * 1.35 + (k + i * 0.5) * 0.25, 0.26 + i * 0.22, -fp * 0.3],
            rot: [Math.PI / 2, 0, 0],
          });
        }
      }
      b.add({
        geo: cyl(0.1, 0.1, fp * 2.1, 8),
        color: "#a0693a",
        pos: [0, fp * 1.5, 0],
        rot: [0, 0, Math.PI / 2],
      });
      scaffold(b, fp, [0.9]);
      cones(b, fp);
      crane(b, fp);
      break;
    }
    case "marskuppel": {
      const R = fp * 1.1;
      b.add({ geo: cyl(R * 1.06, R * 1.12, 0.3, 24), color: "#d6d3d1", pos: [0, 0.29, 0] });
      for (let i = 0; i < 4; i++) {
        b.add({
          geo: new THREE.TorusGeometry(R, 0.05, 6, 22, Math.PI * 0.62),
          color: "#9ca3af",
          pos: [0, 0.44, 0],
          rot: [0, (i * Math.PI) / 4, 0],
        });
      }
      b.add({
        geo: new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 0.55, 0, Math.PI / 4.5),
        color: "#e7e5e4",
        pos: [0, 0.44, 0],
        rot: [0, 0.3, 0],
      });
      for (let i = 0; i < 4; i++) {
        b.add({
          geo: rbox(0.5, 0.05, 0.35, 0.01),
          color: "#cbd5e1",
          pos: [fp * 1.4, 0.2 + i * 0.05, -fp * 0.3 + (i % 2) * 0.1],
        });
      }
      scaffold(b, fp, [0.8]);
      cones(b, fp);
      crane(b, fp);
      break;
    }
    case "werkstatt": {
      const h = fp * 1.25;
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [0, -1],
        [0, 1],
      ] as const) {
        b.add({
          geo: box(0.1, h, 0.1),
          color: "#6b7280",
          pos: [x * fp * 0.98, 0.14 + h / 2, z * fp * 0.98],
        });
      }
      for (const z of [-1, 1])
        b.add({ geo: box(fp * 2, 0.1, 0.1), color: "#6b7280", pos: [0, 0.14 + h, z * fp * 0.98] });
      for (const x of [-1, 1])
        b.add({ geo: box(0.1, 0.1, fp * 2), color: "#6b7280", pos: [x * fp * 0.98, 0.14 + h, 0] });
      for (const z of [-1, 1]) {
        b.add({
          geo: box(fp * 1.0, h * 0.55, 0.04),
          color: "#9ca3af",
          pos: [-fp * 0.45, 0.14 + h * 0.3, z * fp * 0.98],
        });
      }
      scaffold(b, fp, [0.7]);
      cones(b, fp);
      crane(b, fp);
      break;
    }
    case "tinyhaus": {
      const w = fp * 1.9;
      const d = fp * 1.15;
      b.add({ geo: rbox(w, 0.16, d, 0.03), color: "#374151", pos: [0, 0.54, 0] });
      for (const x of [-w * 0.27, w * 0.27]) {
        for (const s of [-1, 1]) {
          b.add({
            geo: cylZ(0.32, 0.32, 0.14, 16),
            color: "#1f2937",
            pos: [x, 0.32, s * (d / 2 + 0.04)],
          });
        }
      }
      // Ständerwerk
      for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += w / 6) {
        for (const z of [-1, 1])
          b.add({
            geo: box(0.07, fp * 1.2, 0.07),
            color: "#c9a26a",
            pos: [x, 0.62 + fp * 0.6, z * (d / 2 - 0.05)],
          });
      }
      b.add({ geo: box(w, 0.07, 0.07), color: "#c9a26a", pos: [0, 0.62 + fp * 1.2, d / 2 - 0.05] });
      b.add({
        geo: box(w, 0.07, 0.07),
        color: "#c9a26a",
        pos: [0, 0.62 + fp * 1.2, -d / 2 + 0.05],
      });
      b.add({
        geo: gable(d + 0.2, fp * 0.5, 0.07),
        color: "#c9a26a",
        pos: [-w * 0.2, 0.62 + fp * 1.2, 0],
        rot: [0, Math.PI / 2, 0],
      });
      b.add({
        geo: gable(d + 0.2, fp * 0.5, 0.07),
        color: "#c9a26a",
        pos: [w * 0.2, 0.62 + fp * 1.2, 0],
        rot: [0, Math.PI / 2, 0],
      });
      for (let i = 0; i < 5; i++) {
        b.add({
          geo: rbox(0.8, 0.05, 0.3, 0.01),
          color: "#d6b98a",
          pos: [fp * 1.3, 0.15 + i * 0.06, fp * 0.8],
        });
      }
      cones(b, fp);
      break;
    }
    case "baumhaus": {
      const trunkH = fp * 3.2;
      b.add({
        geo: cyl(fp * 0.26, fp * 0.38, trunkH, 12),
        color: "#6b4a2e",
        pos: [0, trunkH / 2, -0.1],
      });
      for (const [x, y, z, s] of [
        [0, 0.98, 0, 1.15],
        [0.8, 0.86, 0.3, 0.85],
        [-0.8, 0.9, -0.2, 0.9],
      ] as const) {
        b.add({
          geo: sphere(fp * s, 12),
          color: ["#4f9a58", "#5ba861", "#3f8a4e"][Math.round(x + 1)],
          pos: [x * fp, trunkH * y + fp * 0.3, z * fp - 0.1],
        });
      }
      // halbfertige Plattform mit Bohlen und Leiter
      const py = fp * 1.4;
      b.add({
        geo: cyl(fp * 1.3, fp * 1.25, 0.12, 14),
        color: "#b08a5b",
        pos: [0, py, 0],
        scale: [1, 1, 1],
      });
      for (let i = 0; i < 3; i++) {
        b.add({
          geo: rbox(fp * 0.9, 0.05, 0.22, 0.01),
          color: "#d6b98a",
          pos: [fp * 0.8, py + 0.1 + i * 0.05, fp * 0.2 + i * 0.1],
          rot: [0, 0.3, 0],
        });
      }
      b.add({
        geo: cyl(0.04, 0.04, py + 0.1, 6),
        color: WOOD,
        pos: [-0.3, py / 2, fp * 0.9],
        rot: [0.35, 0, 0],
      });
      b.add({
        geo: cyl(0.04, 0.04, py + 0.1, 6),
        color: WOOD,
        pos: [0.3, py / 2, fp * 0.9],
        rot: [0.35, 0, 0],
      });
      for (let i = 1; i <= 4; i++)
        b.add({
          geo: box(0.6, 0.04, 0.05),
          color: "#a97c50",
          pos: [0, py * (1 - i / 6), 0.2 + fp * 0.6 * (i / 5)],
        });
      // Flaschenzug mit Eimer
      b.add({
        geo: cyl(0.015, 0.015, py * 0.8, 4),
        color: "#8a6a45",
        pos: [fp * 1.1, py * 0.6, fp * 0.3],
      });
      b.add({
        geo: cyl(0.14, 0.1, 0.2, 10),
        color: "#9ca3af",
        pos: [fp * 1.1, py * 0.2, fp * 0.3],
      });
      cones(b, fp);
      break;
    }
    default: {
      // Einfaches Haus: halbhohe Ziegelmauern, Dachstuhl, Ziegelstapel
      const h = fp * 0.9;
      for (const z of [-1, 1])
        b.add({
          geo: rbox(fp * 2, h, 0.2, 0.02),
          color: BRICK,
          pos: [0, 0.14 + h / 2, z * fp * 0.9],
        });
      b.add({
        geo: rbox(0.2, h, fp * 1.8, 0.02),
        color: BRICK,
        pos: [-fp * 0.95, 0.14 + h / 2, 0],
      });
      b.add({
        geo: rbox(0.2, h * 0.45, fp * 0.7, 0.02),
        color: BRICK,
        pos: [fp * 0.95, 0.14 + h * 0.225, -fp * 0.5],
      });
      for (let i = 0; i < 3; i++) {
        b.add({
          geo: gable(fp * 1.9, fp * 0.7, 0.07),
          color: "#c9a26a",
          pos: [0, 0.14 + h + 0.05, -fp * 0.7 + i * fp * 0.7],
        });
      }
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2 - Math.min(i, 1); j++) {
          b.add({
            geo: rbox(0.5, 0.2, 0.25, 0.02),
            color: BRICK,
            pos: [fp * 0.3 + j * 0.52, 0.26 + i * 0.21, fp * 0.65],
          });
        }
      }
      scaffold(b, fp, [0.85, 1.55]);
      cones(b, fp);
      crane(b, fp);
      void WOOD;
      void STONE;
      void darken;
    }
  }
  return b.build();
}

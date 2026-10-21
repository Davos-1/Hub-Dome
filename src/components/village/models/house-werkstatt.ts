import type { Tier } from "@/lib/layout";
import { box, cyl, gable, gearGeometry, rbox, sphere } from "../geo";
import { BRICK, Builder, darken, STONE, WARM, type Model } from "./common";

const METAL = "#6b7280";
const YELLOW = "#f4c430";

function barrel(b: Builder, x: number, z: number, color: string) {
  b.add({ geo: cyl(0.2, 0.2, 0.5, 12), color, pos: [x, 0.25, z] });
  b.add({ geo: cyl(0.205, 0.205, 0.04, 12), color: darken(color, 0.7), pos: [x, 0.3, z] });
  b.add({ geo: cyl(0.205, 0.205, 0.04, 12), color: darken(color, 0.7), pos: [x, 0.42, z] });
}

/** Werkstatt: Wellblech-Halle mit Rolltor, Oberlichtband, Zahnrad-Emblem; grösser mit Kran, Schuppen, Silo und Schlot. */
export function werkstattModel(fp: number, tier: Tier, wall: string): Model {
  const b = new Builder();
  const w = fp * 2.1;
  const d = fp * 2.1;
  const h = fp * 1.25;
  const base = 0.14;
  const ribs = darken(wall, 0.9);

  b.add({ geo: rbox(w + 0.2, base, d + 0.2, 0.03), color: "#9a958b", pos: [0, base / 2, 0] });
  b.add({ geo: rbox(w, h, d, 0.04), color: wall, pos: [0, base + h / 2, 0] });
  // Wellblech-Rippen an Vorder- und Seitenwänden
  for (let x = -w / 2 + 0.15; x < w / 2; x += 0.24) {
    b.add({ geo: box(0.07, h - 0.1, 0.05), color: ribs, pos: [x, base + h / 2, d / 2 + 0.02] });
    b.add({ geo: box(0.07, h - 0.1, 0.05), color: ribs, pos: [x, base + h / 2, -d / 2 - 0.02] });
  }
  for (let z = -d / 2 + 0.15; z < d / 2; z += 0.24) {
    for (const s of [-1, 1]) {
      b.add({
        geo: box(0.05, h - 0.1, 0.07),
        color: ribs,
        pos: [s * (w / 2 + 0.02), base + h / 2, z],
      });
    }
  }
  // Flaches Dach mit Rand
  b.add({ geo: gable(w + 0.5, fp * 0.38, d + 0.5, 0.03), color: METAL, pos: [0, base + h, 0] });
  b.add({
    geo: rbox(w + 0.4, 0.09, 0.12, 0.02),
    color: darken(METAL, 0.8),
    pos: [0, base + h + 0.02, d / 2 + 0.25],
  });

  // Rolltor mit Lamellen und Warnrahmen
  const gw = fp * 1.1;
  const gh = fp * 0.95;
  b.add({
    geo: rbox(gw + 0.2, gh + 0.12, 0.08, 0.02),
    color: YELLOW,
    pos: [0, base + gh / 2 + 0.03, d / 2 + 0.05],
  });
  b.add({ geo: rbox(gw, gh, 0.1, 0.02), color: "#aab2bb", pos: [0, base + gh / 2, d / 2 + 0.08] });
  for (let i = 1; i < 7; i++) {
    b.add({
      geo: box(gw, 0.02, 0.12),
      color: "#8d949c",
      pos: [0, base + (gh / 7) * i, d / 2 + 0.09],
    });
  }
  // Oberlichtband und Seitenfenster
  b.light({ geo: box(w * 0.78, 0.2, 0.1), color: WARM, pos: [0, base + h - 0.22, d / 2 + 0.03] });
  for (const s of [-1, 1]) {
    b.light({
      geo: box(0.1, 0.3, d * 0.5),
      color: WARM,
      pos: [s * (w / 2 + 0.03), base + h * 0.62, 0],
    });
  }
  // Zahnrad-Emblem über dem Tor
  b.add({
    geo: gearGeometry(10, 0.22, 0.3, 0.08, 0.1),
    color: "#f59e0b",
    pos: [0, base + h - 0.5, d / 2 + 0.1],
  });

  // Büro-Anbau links
  const ow = fp * 0.75;
  b.add({
    geo: rbox(ow, h * 0.6, fp * 0.9, 0.04),
    color: darken(wall, 1.1),
    pos: [-w / 2 - ow / 2 + 0.05, base + h * 0.3, d * 0.25],
  });
  b.add({
    geo: rbox(ow + 0.15, 0.08, fp * 0.9 + 0.15, 0.02),
    color: METAL,
    pos: [-w / 2 - ow / 2 + 0.05, base + h * 0.6 + 0.04, d * 0.25],
  });
  b.light({
    geo: box(ow * 0.55, h * 0.28, 0.1),
    color: WARM,
    pos: [-w / 2 - ow / 2 + 0.05, base + h * 0.34, d * 0.25 + fp * 0.45],
  });

  // Abluftrohr und Fässer
  b.add({
    geo: cyl(0.1, 0.1, fp * 0.9, 10),
    color: "#9ca3af",
    pos: [w * 0.3, base + h + fp * 0.5, -d * 0.2],
  });
  b.add({
    geo: cyl(0.16, 0.12, 0.12, 10),
    color: "#4b5563",
    pos: [w * 0.3, base + h + fp * 0.98, -d * 0.2],
  });
  barrel(b, w / 2 + 0.4, d * 0.3, "#2563eb");
  barrel(b, w / 2 + 0.7, d * 0.2, "#dc2626");
  b.add({ geo: rbox(0.5, 0.4, 0.5, 0.03), color: "#b4833d", pos: [w / 2 + 0.5, 0.2, d * 0.5] });

  if (tier >= 2) {
    // Schuppen rechts und Kran
    const sw = fp * 1.0;
    const sx = w / 2 + sw / 2 + 0.2;
    b.add({
      geo: box(0.09, h * 0.7, 0.09),
      color: METAL,
      pos: [sx + sw / 2, base + h * 0.35, d * 0.4],
    });
    b.add({
      geo: box(0.09, h * 0.7, 0.09),
      color: METAL,
      pos: [sx + sw / 2, base + h * 0.35, -d * 0.1],
    });
    b.add({
      geo: rbox(sw + 0.3, 0.07, d * 0.6, 0.02),
      color: METAL,
      pos: [sx, base + h * 0.72, d * 0.15],
      rot: [0, 0, 0.12],
    });
    b.add({
      geo: box(0.14, fp * 2.4, 0.14),
      color: "#fb923c",
      pos: [-w * 0.35, fp * 1.2 + base, -d / 2 - 0.45],
    });
    b.add({
      geo: box(fp * 1.9, 0.1, 0.1),
      color: "#fb923c",
      pos: [-w * 0.35 + fp * 0.8, fp * 2.35 + base, -d / 2 - 0.45],
    });
    b.add({
      geo: cyl(0.015, 0.015, 0.8, 4),
      color: "#1f2937",
      pos: [-w * 0.35 + fp * 1.5, fp * 1.95 + base, -d / 2 - 0.45],
    });
    b.add({
      geo: rbox(0.2, 0.16, 0.2, 0.02),
      color: "#6b7280",
      pos: [-w * 0.35 + fp * 1.5, fp * 1.5 + base, -d / 2 - 0.45],
    });
    barrel(b, sx, d * 0.3, "#16a34a");
    barrel(b, sx + 0.35, d * 0.35, "#f59e0b");
  }

  if (tier >= 3) {
    // Ziegelschlot und Silo
    b.add({
      geo: cyl(0.2, 0.28, fp * 3.2, 12),
      color: BRICK,
      pos: [w * 0.05, base + fp * 1.6, -d / 2 - 0.5],
    });
    b.add({
      geo: cyl(0.3, 0.22, 0.14, 12),
      color: darken(BRICK, 0.8),
      pos: [w * 0.05, base + fp * 3.2, -d / 2 - 0.5],
    });
    for (let i = 0; i < 3; i++) {
      b.add({
        geo: sphere(0.16 + i * 0.06, 8),
        color: "#f1f1f1",
        pos: [w * 0.05 + i * 0.15, base + fp * 3.5 + i * 0.35, -d / 2 - 0.5],
      });
    }
    const sx = -w / 2 - fp * 0.5;
    b.add({
      geo: cyl(fp * 0.42, fp * 0.42, fp * 1.9, 16),
      color: "#cbd5e1",
      pos: [sx - 0.6, base + fp * 0.95, -d * 0.3],
    });
    b.add({
      geo: cyl(0.02, fp * 0.42, fp * 0.35, 16),
      color: "#94a3b8",
      pos: [sx - 0.6, base + fp * 2.05, -d * 0.3],
    });
    for (const y of [0.4, 1.0, 1.6]) {
      b.add({
        geo: cyl(fp * 0.43, fp * 0.43, 0.05, 16),
        color: "#94a3b8",
        pos: [sx - 0.6, y * fp * 0.9, -d * 0.3],
      });
    }
    b.add({
      geo: box(0.07, fp * 1.6, 0.07),
      color: STONE,
      pos: [sx - 0.6 + fp * 0.5, fp * 0.8, -d * 0.3 + 0.1],
    });
  }
  return b.build();
}

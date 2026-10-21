import type { Tier } from "@/lib/layout";
import { box, cyl, cylZ, gable, rbox, sphere } from "../geo";
import { Builder, darken, STONE, WARM, WHITE, WOOD, type Model } from "./common";

const CHASSIS = "#374151";

function wheel(b: Builder, x: number, z: number) {
  b.add({ geo: cylZ(0.32, 0.32, 0.14, 16), color: "#1f2937", pos: [x, 0.32, z] });
  b.add({ geo: cylZ(0.16, 0.16, 0.16, 12), color: "#9ca3af", pos: [x, 0.32, z] });
}

/** Tinyhaus auf Rädern. Lange Seite zeigt zur Zentrale (Tür vorn). */
export function tinyhausModel(fp: number, tier: Tier, wall: string, roof: string): Model {
  const b = new Builder();
  const w = fp * 1.95;
  const d = fp * 1.2;
  const h = fp * 1.25;
  const y0 = 0.52; // Oberkante Fahrgestell

  // Fahrgestell, Räder, Deichsel
  b.add({ geo: rbox(w + 0.1, 0.16, d + 0.1, 0.03), color: CHASSIS, pos: [0, y0 - 0.08, 0] });
  for (const x of [-w * 0.27, w * 0.27]) {
    for (const s of [-1, 1]) wheel(b, x, s * (d / 2 + 0.04));
  }
  b.add({
    geo: box(0.08, 0.08, 0.9),
    color: CHASSIS,
    pos: [-w / 2 - 0.35, y0 - 0.12, 0],
    rot: [0, Math.PI / 2, 0],
  });
  b.add({ geo: cyl(0.08, 0.08, 0.12, 8), color: "#9ca3af", pos: [-w / 2 - 0.75, y0 - 0.2, 0] });

  // Korpus mit Verkleidung, steiles Dach (First entlang x)
  b.add({ geo: rbox(w, h, d, 0.07), color: wall, pos: [0, y0 + h / 2, 0] });
  for (let x = -w / 2 + 0.2; x < w / 2; x += 0.3) {
    b.add({
      geo: box(0.025, h - 0.1, 0.03),
      color: darken(wall, 0.92),
      pos: [x, y0 + h / 2, d / 2 + 0.02],
    });
  }
  b.add({
    geo: gable(d + 0.5, fp * 0.75, w + 0.4, 0.04),
    color: roof,
    pos: [0, y0 + h, 0],
    rot: [0, Math.PI / 2, 0],
  });
  b.add({
    geo: rbox(w + 0.42, 0.08, 0.1, 0.02),
    color: darken(roof, 0.75),
    pos: [0, y0 + h + fp * 0.75, 0],
  });

  // Tür (links) mit Treppe, grosses Fenster (rechts), rundes Giebelfenster
  const doorW = fp * 0.45;
  const doorH = fp * 0.95;
  const dx = -w * 0.28;
  b.add({
    geo: rbox(doorW, doorH, 0.1, 0.03),
    color: WOOD,
    pos: [dx, y0 + doorH / 2, d / 2 + 0.02],
  });
  b.light({
    geo: box(doorW * 0.55, doorH * 0.35, 0.12),
    color: WARM,
    pos: [dx, y0 + doorH * 0.68, d / 2 + 0.03],
  });
  b.add({
    geo: sphere(0.04, 8),
    color: "#d4a73a",
    pos: [dx + doorW * 0.32, y0 + doorH * 0.45, d / 2 + 0.09],
  });
  b.add({
    geo: rbox(doorW + 0.2, 0.1, 0.4, 0.02),
    color: "#a97c50",
    pos: [dx, y0 - 0.12, d / 2 + 0.25],
  });
  b.add({ geo: rbox(doorW + 0.2, 0.1, 0.4, 0.02), color: "#a97c50", pos: [dx, 0.2, d / 2 + 0.55] });
  const wx = w * 0.2;
  b.add({
    geo: rbox(fp * 0.85, fp * 0.65, 0.1, 0.03),
    color: WHITE,
    pos: [wx, y0 + h * 0.58, d / 2 + 0.02],
  });
  b.light({
    geo: box(fp * 0.7, fp * 0.5, 0.12),
    color: WARM,
    pos: [wx, y0 + h * 0.58, d / 2 + 0.03],
  });
  b.add({ geo: box(0.03, fp * 0.5, 0.14), color: WHITE, pos: [wx, y0 + h * 0.58, d / 2 + 0.03] });
  b.light({
    geo: cyl(fp * 0.2, fp * 0.2, 0.1, 14),
    color: WARM,
    pos: [w / 2 + 0.01, y0 + h + fp * 0.3, 0],
    rot: [0, 0, Math.PI / 2],
  });
  // Ofenrohr
  b.add({
    geo: cyl(0.07, 0.07, fp * 0.6, 8),
    color: "#4b5563",
    pos: [w * 0.38, y0 + h + fp * 0.7, -d * 0.2],
  });
  for (let i = 0; i < 2; i++) {
    b.add({
      geo: sphere(0.1 + i * 0.05, 8),
      color: "#f1f1f1",
      pos: [w * 0.38 + i * 0.1, y0 + h + fp * 1.15 + i * 0.3, -d * 0.2],
    });
  }

  if (tier >= 2) {
    // Holzterrasse mit Geländer, Pflanzkübeln und Solarpanel
    b.add({
      geo: rbox(w * 0.55, 0.1, 1.1, 0.02),
      color: "#b08a5b",
      pos: [w * 0.12, y0 - 0.1, d / 2 + 0.65],
    });
    for (const x of [-0.25, 0.5]) {
      b.add({
        geo: cyl(0.03, 0.03, 0.55, 6),
        color: WHITE,
        pos: [w * x + w * 0.12, y0 + 0.2, d / 2 + 1.15],
      });
    }
    b.add({
      geo: cyl(0.03, 0.03, w * 0.55, 6),
      color: WHITE,
      pos: [w * 0.12, y0 + 0.48, d / 2 + 1.15],
      rot: [0, 0, Math.PI / 2],
    });
    for (const x of [0.3, 0.45]) {
      b.add({
        geo: cyl(0.12, 0.09, 0.2, 10),
        color: "#c2693f",
        pos: [w * x, y0 + 0.1, d / 2 + 0.95],
      });
      b.add({ geo: sphere(0.14, 8), color: "#4f9a58", pos: [w * x, y0 + 0.3, d / 2 + 0.95] });
    }
    const slope = Math.atan((fp * 0.75) / (d / 2 + 0.25));
    const zp = d * 0.12;
    b.add({
      geo: rbox(w * 0.45, 0.05, 0.6, 0.01),
      color: "#1e3a5f",
      pos: [-w * 0.1, y0 + h + fp * 0.75 * (1 - zp / (d / 2 + 0.25)) + 0.06, zp],
      rot: [slope, 0, 0],
    });
  }

  if (tier >= 3) {
    // Zweites kleines Häuschen, Lichterkette, Markise und Hochbeet
    const sx = w / 2 + fp * 0.75;
    const sw = fp * 0.9;
    b.add({
      geo: rbox(sw, h * 0.75, fp * 0.9, 0.05),
      color: darken(wall, 1.12),
      pos: [sx, 0.2 + (h * 0.75) / 2, -0.15],
    });
    b.add({
      geo: rbox(sw + 0.3, 0.08, fp * 1.1, 0.02),
      color: roof,
      pos: [sx, 0.2 + h * 0.75 + 0.04, -0.15],
      rot: [0, 0, 0.1],
    });
    b.light({
      geo: box(sw * 0.5, h * 0.25, 0.1),
      color: WARM,
      pos: [sx, 0.2 + h * 0.45, -0.15 + fp * 0.45 + 0.02],
    });
    b.add({
      geo: rbox(sw, 0.05, fp * 0.45, 0.01),
      color: "#e11d48",
      pos: [sx, 0.2 + h * 0.62, fp * 0.5],
      rot: [0.25, 0, 0],
    });
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = -w * 0.35 + t * w * 1.05;
      const sag = Math.sin(t * Math.PI) * 0.22;
      b.light({
        geo: sphere(0.045, 6),
        color: i % 2 ? "#ffd479" : "#ffb3c7",
        pos: [x, y0 + h * 0.95 - sag, d / 2 + 1.0],
      });
    }
    for (const x of [-w * 0.35, w * 0.7]) {
      b.add({
        geo: cyl(0.03, 0.03, y0 + h * 0.95, 6),
        color: WOOD,
        pos: [x, (y0 + h * 0.95) / 2, d / 2 + 1.0],
      });
    }
    b.add({
      geo: rbox(0.9, 0.18, 0.4, 0.02),
      color: "#8a5a2b",
      pos: [-w * 0.1, 0.09, d / 2 + 1.5],
    });
    b.add({
      geo: rbox(0.8, 0.06, 0.32, 0.02),
      color: "#5b3f26",
      pos: [-w * 0.1, 0.2, d / 2 + 1.5],
    });
    for (let i = 0; i < 4; i++) {
      b.add({
        geo: sphere(0.07, 6),
        color: ["#4f9a58", "#ef4444", "#f59e0b", "#4f9a58"][i],
        pos: [-w * 0.1 - 0.3 + i * 0.2, 0.28, d / 2 + 1.5],
      });
    }
    b.add({ geo: rbox(0.5, 0.05, 0.3, 0.02), color: STONE, pos: [0, 0.03, d / 2 + 1.2] });
  }
  return b.build();
}

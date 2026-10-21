import type { Tier } from "@/lib/layout";
import { box, cyl, gable, rbox, sphere } from "../geo";
import { Builder, darken, mix, STONE, WARM, WOOD, type Model } from "./common";

/** Rundholz-Hütte: waagrechte Stämme mit überstehenden Ecken, Steinkamin, Veranda und Holzstapel. */
export function blockhuetteModel(fp: number, tier: Tier, wall: string, roof: string): Model {
  const b = new Builder();
  const w = fp * 2;
  const d = fp * 2;
  const rows = 8;
  const h = fp * 1.45;
  const r = h / rows / 2;
  const base = 0.2;
  const logA = mix(wall, "#8a5a2b", 0.84);
  const logB = darken(logA, 0.88);
  const shingles = mix(roof, "#4a3a2a", 0.6);

  b.add({ geo: rbox(w + 0.3, base, d + 0.3, 0.05), color: "#8f8a80", pos: [0, base / 2, 0] });

  // Stämme: Vorder-/Rückwand entlang x, Seitenwände entlang z, Enden stehen an den Ecken über
  for (let i = 0; i < rows; i++) {
    const y = base + r + i * 2 * r;
    const color = i % 2 === 0 ? logA : logB;
    for (const s of [-1, 1]) {
      b.add({
        geo: cyl(r, r, w + 0.34, 10),
        color,
        pos: [0, y, s * (d / 2 - r)],
        rot: [0, 0, Math.PI / 2],
      });
      b.add({
        geo: cyl(r, r, d + 0.34, 10),
        color: i % 2 === 0 ? logB : logA,
        pos: [s * (w / 2 - r), y + r * 0.08, 0],
        rot: [Math.PI / 2, 0, 0],
      });
    }
  }
  // Giebelfüllung und Dach aus Schindeln, Firstbalken als Rundholz
  b.add({
    geo: gable(w + 0.2, fp * 0.85, d + 0.2),
    color: logB,
    pos: [0, base + h, 0],
    scale: [0.98, 1, 0.98],
  });
  b.add({
    geo: gable(w + 0.9, fp * 0.95, d + 0.9, 0.05),
    color: shingles,
    pos: [0, base + h + 0.04, 0],
  });
  b.add({
    geo: cyl(0.1, 0.1, d + 1.0, 8),
    color: logA,
    pos: [0, base + h + fp * 0.95 + 0.04, 0],
    rot: [Math.PI / 2, 0, 0],
  });

  // Tür und Fenster
  const doorW = fp * 0.55;
  const doorH = fp * 0.9;
  b.add({
    geo: rbox(doorW, doorH, 0.1, 0.03),
    color: "#4a2e1a",
    pos: [0, base + doorH / 2, d / 2 + r * 0.7],
  });
  b.add({
    geo: sphere(0.045, 8),
    color: "#d4a73a",
    pos: [doorW * 0.32, base + doorH * 0.5, d / 2 + r * 0.7 + 0.07],
  });
  for (const x of [-0.68, 0.68]) {
    b.add({
      geo: rbox(fp * 0.5, fp * 0.5, 0.1, 0.02),
      color: "#4a2e1a",
      pos: [x * fp, base + h * 0.6, d / 2 + r * 0.7],
    });
    b.light({
      geo: box(fp * 0.36, fp * 0.36, 0.12),
      color: WARM,
      pos: [x * fp, base + h * 0.6, d / 2 + r * 0.7],
    });
    b.add({
      geo: box(0.03, fp * 0.36, 0.14),
      color: "#4a2e1a",
      pos: [x * fp, base + h * 0.6, d / 2 + r * 0.7],
    });
  }
  b.light({
    geo: box(0.12, fp * 0.4, fp * 0.36),
    color: WARM,
    pos: [w / 2 + 0.02, base + h * 0.6, 0],
  });
  b.light({
    geo: box(0.12, fp * 0.4, fp * 0.36),
    color: WARM,
    pos: [-w / 2 - 0.02, base + h * 0.6, 0],
  });

  // Steinkamin an der Seite
  const cx = -w / 2 - 0.2;
  b.add({
    geo: rbox(0.55, h + fp * 0.9, 0.7, 0.05),
    color: "#8d867b",
    pos: [cx, base + (h + fp * 0.9) / 2, -d * 0.1],
  });
  b.add({
    geo: rbox(0.7, 0.1, 0.85, 0.03),
    color: "#6f695f",
    pos: [cx, base + h + fp * 0.9, -d * 0.1],
  });
  for (let i = 0; i < 3; i++) {
    b.add({
      geo: sphere(0.12 + i * 0.05, 8),
      color: "#f1f1f1",
      pos: [cx, base + h + fp * 1.2 + i * 0.32, -d * 0.1],
    });
  }

  // Holzstapel
  const stackX = w / 2 + 0.2;
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 4 - row; k++) {
      b.add({
        geo: cyl(0.1, 0.1, 0.7, 8),
        color: k % 2 ? "#a47241" : "#8a5a2b",
        pos: [stackX + 0.3, 0.12 + row * 0.19, -d * 0.15 + (k + row * 0.5) * 0.21],
        rot: [0, 0, Math.PI / 2],
      });
    }
  }

  if (tier >= 2) {
    // Veranda mit Pfosten, Geländer und Dach
    const vz = d / 2 + 0.7;
    b.add({
      geo: rbox(w * 0.85, 0.12, 1.2, 0.03),
      color: darken(logA, 1.1),
      pos: [0, base + 0.06, vz],
    });
    for (const x of [-0.8, 0.8]) {
      b.add({
        geo: cyl(0.07, 0.07, h * 0.7, 8),
        color: logA,
        pos: [x * fp, base + (h * 0.7) / 2, vz + 0.45],
      });
    }
    b.add({
      geo: gable(w * 0.85 + 0.4, fp * 0.35, 1.5, 0.03),
      color: shingles,
      pos: [0, base + h * 0.7, vz],
      scale: [1, 1, 1],
    });
    for (const x of [-0.8, 0.8]) {
      b.add({
        geo: cyl(0.03, 0.03, 0.55, 6),
        color: logB,
        pos: [x * fp * 0.55, base + 0.4, vz + 0.55],
      });
    }
    b.add({
      geo: cyl(0.03, 0.03, fp * 1.5, 6),
      color: logB,
      pos: [0, base + 0.68, vz + 0.55],
      rot: [0, 0, Math.PI / 2],
    });
  }

  if (tier >= 3) {
    // Zweite kleine Hütte als Anbau und Aussichtsturm-Luke mit Fahne
    const aw = fp * 1.0;
    const ax = w / 2 + aw / 2 + 0.55;
    const ah = h * 0.65;
    const ar = ah / 6 / 2;
    for (let i = 0; i < 6; i++) {
      const y = base + ar + i * 2 * ar;
      for (const s of [-1, 1]) {
        b.add({
          geo: cyl(ar, ar, aw + 0.2, 10),
          color: i % 2 ? logB : logA,
          pos: [ax, y, s * (d * 0.35 - ar)],
          rot: [0, 0, Math.PI / 2],
        });
        b.add({
          geo: cyl(ar, ar, d * 0.7 + 0.2, 10),
          color: i % 2 ? logA : logB,
          pos: [ax + s * (aw / 2 - ar), y, 0],
          rot: [Math.PI / 2, 0, 0],
        });
      }
    }
    b.add({
      geo: gable(d * 0.7 + 0.5, fp * 0.55, aw + 0.6),
      color: shingles,
      pos: [ax, base + ah, 0],
      rot: [0, Math.PI / 2, 0],
    });
    b.light({
      geo: box(fp * 0.3, fp * 0.3, 0.12),
      color: WARM,
      pos: [ax, base + ah * 0.55, d * 0.35 + 0.03],
    });
    b.add({
      geo: cyl(0.03, 0.03, fp * 1.1, 6),
      color: "#4b5563",
      pos: [0, base + h + fp * 1.55, -d * 0.2],
    });
    b.add({
      geo: box(0.55, 0.3, 0.03),
      color: "#2563eb",
      pos: [0.3, base + h + fp * 1.95, -d * 0.2],
    });
    b.add({ geo: cyl(0.04, 0.05, 0.9, 8), color: WOOD, pos: [-fp * 0.9, 0.45, d / 2 + 0.7] });
    b.light({ geo: sphere(0.12, 8), color: "#ffd479", pos: [-fp * 0.9, 0.98, d / 2 + 0.7] });
    b.add({ geo: rbox(0.5, 0.05, 0.3, 0.02), color: STONE, pos: [0, base + 0.03, d / 2 + 0.15] });
  }
  return b.build();
}

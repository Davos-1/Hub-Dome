import * as THREE from "three";
import type { Tier } from "@/lib/layout";
import { box, cyl, cylZ, gable } from "../geo";
import { Builder, darken, STONE, WARM, WHITE, WOOD, type Model } from "./common";

/**
 * Haustypen der Fachbereiche (Port aus dem Design-Prototyp). Alle Modelle: Front zeigt nach +z,
 * drei Wachstumsstufen (Tier 1–3), Leuchtteile (Fenster) getrennt im `glow`.
 */

const FLAT_BASE = 0.18;

function slab(b: Builder, w: number, d: number) {
  b.add({ geo: box(w + 0.14, FLAT_BASE, d + 0.14), color: STONE, pos: [0, FLAT_BASE / 2, 0] });
}

function frontDoor(b: Builder, x: number, z: number, w: number, h: number, color: string) {
  b.add({ geo: box(w, h, 0.1), color, pos: [x, 0.18 + h / 2, z] });
  b.add({ geo: box(w + 0.5, 0.1, 0.4), color: STONE, pos: [x, 0.19, z + 0.2] });
}

/** Werkstatt: breites Haus mit Rolltor, Werkstattlicht; Stufe 2 Pergola, Stufe 3 Silo. */
export function werkstattModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 2.3;
  const d = fp * 2.0;
  const h = fp * 1.15;
  const base = FLAT_BASE;
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  b.add({
    geo: gable(d + 0.4, fp * 0.45, w + 0.4),
    color: roof,
    pos: [0, base + h, 0],
    rot: [0, Math.PI / 2, 0],
  });
  const dw = fp * 1.2;
  const dh = h * 0.78;
  b.add({ geo: box(dw, dh, 0.08), color: "#8c8f94", pos: [0, base + dh / 2, d / 2 + 0.02] });
  for (let i = 1; i < 6; i++) {
    b.add({
      geo: box(dw, 0.025, 0.1),
      color: "#6b6e73",
      pos: [0, base + (dh * i) / 6, d / 2 + 0.03],
    });
  }
  b.add({
    geo: box(dw + 0.2, 0.12, 0.14),
    color: accent,
    pos: [0, base + dh + 0.06, d / 2 + 0.03],
  });
  for (const sx of [-1, 1]) {
    b.light({
      geo: box(fp * 0.3, fp * 0.3, 0.1),
      color: WARM,
      pos: [sx * (dw / 2 + fp * 0.35), base + h * 0.6, d / 2 + 0.02],
    });
  }
  b.light({
    geo: box(w * 0.7, 0.06, 0.3),
    color: WARM,
    pos: [0, base + h + fp * 0.3, 0.15],
    rot: [-0.4, 0, 0],
  });
  if (tier >= 2) {
    for (const sz of [-1, 1]) {
      b.add({
        geo: box(0.12, h + 0.9, 0.12),
        color: accent,
        pos: [w / 2 + 0.5, (h + 0.9) / 2 + base, sz * d * 0.35],
      });
    }
    b.add({
      geo: box(0.12, 0.14, d * 0.7 + 0.12),
      color: accent,
      pos: [w / 2 + 0.5, base + h + 0.9, 0],
    });
  }
  if (tier >= 3) {
    b.add({
      geo: cyl(fp * 0.45, fp * 0.45, h * 1.8, 16),
      color: "#c9ccd0",
      pos: [-w / 2 - fp * 0.4, base + h * 0.9, -d * 0.2],
    });
    b.add({
      geo: new THREE.ConeGeometry(fp * 0.47, fp * 0.35, 16),
      color: "#9aa0a6",
      pos: [-w / 2 - fp * 0.4, base + h * 1.8 + fp * 0.17, -d * 0.2],
    });
  }
  return b.build(base + h + fp * 0.45 + (tier >= 2 ? 0.5 : 0));
}

/** Blockhaus aus Rundholz mit Kamin; Stufe 2 Veranda, Stufe 3 Holzstapel. */
export function blockModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 2;
  const d = fp * 2.0;
  const h = fp * 1.2;
  const base = FLAT_BASE;
  const n = 7;
  const lr = h / n / 2;
  slab(b, w, d);
  b.add({
    geo: box(w - lr * 2, h, d - lr * 2),
    color: darken(wall, 0.85),
    pos: [0, base + h / 2, 0],
  });
  for (let i = 0; i < n; i++) {
    const y = base + lr + i * lr * 2;
    const c = i % 2 ? wall : darken(wall, 0.92);
    b.add({ geo: cylZ(lr, lr, d + 0.3, 8), color: c, pos: [-w / 2 + lr, y, 0] });
    b.add({ geo: cylZ(lr, lr, d + 0.3, 8), color: c, pos: [w / 2 - lr, y, 0] });
    b.add({
      geo: cylZ(lr, lr, w + 0.3, 8),
      color: c,
      pos: [0, y + lr, d / 2 - lr],
      rot: [0, Math.PI / 2, 0],
    });
    b.add({
      geo: cylZ(lr, lr, w + 0.3, 8),
      color: c,
      pos: [0, y + lr, -d / 2 + lr],
      rot: [0, Math.PI / 2, 0],
    });
  }
  b.add({ geo: gable(w + 0.7, fp * 1.05, d + 0.6), color: roof, pos: [0, base + h, 0] });
  frontDoor(b, 0, d / 2 + 0.03, fp * 0.55, fp * 0.8, darken(wall, 0.6));
  for (const sx of [-1, 1]) {
    b.light({
      geo: box(fp * 0.34, fp * 0.34, 0.1),
      color: WARM,
      pos: [sx * fp * 0.62, base + h * 0.6, d / 2 + 0.05],
    });
    b.add({
      geo: box(fp * 0.42, 0.06, 0.12),
      color: accent,
      pos: [sx * fp * 0.62, base + h * 0.6 - fp * 0.2, d / 2 + 0.08],
    });
  }
  b.add({
    geo: box(fp * 0.4, fp * 1.6, fp * 0.4),
    color: "#9b958a",
    pos: [w / 2 - fp * 0.1, base + fp * 0.8 + h * 0.35, -d * 0.2],
  });
  if (tier >= 2) {
    b.add({ geo: box(w + 0.6, 0.08, 1.0), color: WOOD, pos: [0, base + 0.02, d / 2 + 0.55] });
    for (const sx of [-1, 1]) {
      b.add({
        geo: cyl(0.06, 0.06, h * 0.9, 6),
        color: WOOD,
        pos: [sx * (w / 2 + 0.2), base + h * 0.45, d / 2 + 0.95],
      });
    }
    b.add({
      geo: box(w + 0.7, 0.07, 1.1),
      color: roof,
      pos: [0, base + h * 0.92, d / 2 + 0.55],
      rot: [0.2, 0, 0],
    });
  }
  if (tier >= 3) {
    for (let i = 0; i < 6; i++) {
      b.add({
        geo: cylZ(0.12, 0.12, 0.9, 8),
        color: "#a0703f",
        pos: [
          -w / 2 - 0.35,
          0.12 + (i % 3) * 0.23 + Math.floor(i / 3) * 0.02,
          -d * 0.1 + Math.floor(i / 3) * 0.25,
        ],
      });
    }
  }
  return b.build(base + h + fp * 1.05 + 0.2);
}

/** Flachdach-Haus mit Panoramafenster und Solarpaneelen; Stufe 2 zweite Reihe, Stufe 3 Aufbau. */
export function solarModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 2.1;
  const d = fp * 2.0;
  const h = fp * 1.3;
  const base = FLAT_BASE;
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  b.add({ geo: box(w + 0.1, 0.18, d + 0.1), color: roof, pos: [0, base + h + 0.09, 0] });
  b.light({
    geo: box(w * 0.8, h * 0.32, 0.08),
    color: "#cfe8f0",
    pos: [0, base + h * 0.62, d / 2 + 0.02],
  });
  b.add({
    geo: box(w * 0.8 + 0.12, 0.08, 0.14),
    color: accent,
    pos: [0, base + h * 0.44, d / 2 + 0.04],
  });
  frontDoor(b, w * 0.3, d / 2 + 0.03, fp * 0.5, fp * 0.75, accent);
  const rows = tier >= 2 ? 2 : 1;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 3; i++) {
      const x = -w * 0.3 + i * w * 0.3;
      const z = -d * 0.2 + r * d * 0.38;
      b.add({
        geo: box(w * 0.26, 0.04, d * 0.3),
        color: "#2b3f5c",
        pos: [x, base + h + 0.35, z],
        rot: [-0.45, 0, 0],
      });
      b.add({
        geo: box(0.04, 0.3, 0.04),
        color: "#8b9198",
        pos: [x, base + h + 0.2, z - d * 0.1],
      });
    }
  }
  if (tier >= 3) {
    b.add({
      geo: box(w * 0.6, h * 0.7, d * 0.6),
      color: wall,
      pos: [-w * 0.15, base + h + 0.18 + h * 0.35, -d * 0.15],
    });
    b.add({
      geo: box(w * 0.62, 0.12, d * 0.62),
      color: roof,
      pos: [-w * 0.15, base + h * 1.7 + 0.24, -d * 0.15],
    });
    b.light({
      geo: box(w * 0.4, h * 0.25, 0.08),
      color: "#cfe8f0",
      pos: [-w * 0.15, base + h * 1.45, -d * 0.15 + d * 0.3 + 0.02],
    });
  }
  return b.build(base + h + (tier >= 3 ? h * 0.8 + 0.3 : 0.5));
}

/** Stadthaus mit Walmdach, Säulenvorbau und mehreren Fensterreihen. */
export function stadtModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 1.9;
  const d = fp * 1.9;
  const h = fp * (tier >= 2 ? 2.3 : 1.8);
  const base = FLAT_BASE;
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  b.add({
    geo: box(w + 0.16, 0.12, d + 0.16),
    color: darken(wall, 0.85),
    pos: [0, base + h, 0],
  });
  b.add({
    geo: new THREE.ConeGeometry((w + 0.3) * 0.72, fp * 0.9, 4),
    color: roof,
    pos: [0, base + h + fp * 0.45 + 0.06, 0],
    rot: [0, Math.PI / 4, 0],
  });
  const floors = tier >= 2 ? 2 : 1;
  for (let f = 0; f < floors + 1; f++) {
    for (const sx of [-1, 0, 1]) {
      if (f === 0 && sx === 0) continue;
      const y = base + h * (0.2 + f * (0.7 / (floors + 0.3)));
      b.light({
        geo: box(fp * 0.3, fp * 0.42, 0.1),
        color: WARM,
        pos: [sx * fp * 0.6, y + fp * 0.2, d / 2 + 0.02],
      });
      b.add({
        geo: box(fp * 0.38, 0.06, 0.14),
        color: WHITE,
        pos: [sx * fp * 0.6, y - 0.02, d / 2 + 0.04],
      });
    }
  }
  frontDoor(b, 0, d / 2 + 0.03, fp * 0.5, fp * 0.85, accent);
  for (const sx of [-1, 1]) {
    b.add({
      geo: cyl(0.07, 0.08, fp * 1.0, 10),
      color: WHITE,
      pos: [sx * fp * 0.42, base + fp * 0.5, d / 2 + 0.35],
    });
  }
  b.add({ geo: box(fp * 1.1, 0.1, 0.55), color: WHITE, pos: [0, base + fp * 1.02, d / 2 + 0.3] });
  if (tier >= 3) {
    b.add({
      geo: cyl(0.03, 0.03, 1.2, 6),
      color: "#4b5563",
      pos: [w * 0.3, base + h + 0.6, d * 0.3],
    });
    b.add({
      geo: box(0.6, 0.35, 0.03),
      color: accent,
      pos: [w * 0.3 + 0.32, base + h + 1.0, d * 0.3],
    });
  }
  return b.build(base + h + fp * 0.9);
}

/** Atelier mit Pultdach, grosser Glasfront und Lamellen; Stufe 2 Vordach, Stufe 3 Anbau. */
export function atelierModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 2.2;
  const d = fp * 1.9;
  const hf = fp * 1.7;
  const hb = fp * 0.9;
  const base = FLAT_BASE;
  slab(b, w, d);
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2, 0);
  sh.lineTo(d / 2, 0);
  sh.lineTo(d / 2, hf);
  sh.lineTo(-d / 2, hb);
  sh.closePath();
  const body = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  body.translate(0, 0, -w / 2);
  b.add({ geo: body, color: wall, pos: [0, base, 0], rot: [0, -Math.PI / 2, 0] });
  b.add({
    geo: new THREE.BoxGeometry(w + 0.4, 0.1, Math.hypot(d, hf - hb) + 0.5),
    color: roof,
    pos: [0, base + (hf + hb) / 2 + 0.06, 0],
    rot: [-Math.atan2(hf - hb, d), 0, 0],
  });
  for (let i = 0; i < 9; i++) {
    b.add({
      geo: box(0.04, hb * 0.95, 0.04),
      color: darken(wall, 0.85),
      pos: [-w / 2 + 0.1 + (i * (w - 0.2)) / 8, base + hb / 2, -d / 2 - 0.02],
    });
  }
  b.light({
    geo: box(w * 0.72, hf * 0.62, 0.08),
    color: "#d6ecf2",
    pos: [-w * 0.1, base + hf * 0.45, d / 2 + 0.02],
  });
  for (let i = 0; i < 4; i++) {
    b.add({
      geo: box(0.05, hf * 0.62, 0.1),
      color: accent,
      pos: [-w * 0.46 + (i * w * 0.72) / 3, base + hf * 0.45, d / 2 + 0.04],
    });
  }
  frontDoor(b, w * 0.38, d / 2 + 0.03, fp * 0.45, fp * 0.8, accent);
  if (tier >= 2) {
    b.add({ geo: box(w * 0.5, 0.08, 1.2), color: WOOD, pos: [-w * 0.1, base + 0.02, d / 2 + 0.6] });
    b.add({
      geo: box(w * 0.55, 0.06, 1.0),
      color: accent,
      pos: [-w * 0.1, base + hf * 0.95, d / 2 + 0.5],
      rot: [0.15, 0, 0],
    });
  }
  if (tier >= 3) {
    b.add({
      geo: box(fp * 0.9, hf * 0.9, fp * 1.0),
      color: wall,
      pos: [w / 2 + fp * 0.45, base + hf * 0.45, -d * 0.15],
    });
    b.add({
      geo: box(fp * 1.0, 0.1, fp * 1.1),
      color: roof,
      pos: [w / 2 + fp * 0.45, base + hf * 0.9 + 0.05, -d * 0.15],
    });
  }
  return b.build(base + hf + 0.4);
}

/** Haus mit rundem Turm und Kegeldach; Stufe 2 höherer Turm, Stufe 3 Wimpel. */
export function turmModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 1.8;
  const d = fp * 1.9;
  const h = fp * 1.5;
  const base = FLAT_BASE;
  slab(b, w + fp * 0.9, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [-fp * 0.3, base + h / 2, 0] });
  b.add({ geo: gable(w + 0.5, fp * 0.95, d + 0.5), color: roof, pos: [-fp * 0.3, base + h, 0] });
  const tr = fp * 0.55;
  const th = h * (tier >= 2 ? 2.0 : 1.6);
  const tx = w / 2 + tr * 0.4 - fp * 0.3;
  b.add({
    geo: cyl(tr, tr, th, 18),
    color: darken(wall, 0.95),
    pos: [tx, base + th / 2, d * 0.15],
  });
  b.add({
    geo: new THREE.ConeGeometry(tr * 1.25, fp * 1.1, 18),
    color: roof,
    pos: [tx, base + th + fp * 0.55, d * 0.15],
  });
  for (let i = 0; i < 3; i++) {
    b.light({
      geo: box(0.18, fp * 0.32, 0.1),
      color: WARM,
      pos: [tx, base + th * (0.3 + i * 0.25), d * 0.15 + tr],
    });
  }
  frontDoor(b, -fp * 0.3, d / 2 + 0.03, fp * 0.55, fp * 0.8, accent);
  for (const sx of [-1, 1]) {
    b.light({
      geo: box(fp * 0.32, fp * 0.38, 0.1),
      color: WARM,
      pos: [-fp * 0.3 + sx * fp * 0.55, base + h * 0.62, d / 2 + 0.02],
    });
  }
  b.add({
    geo: box(w * 0.9, 0.1, 0.12),
    color: accent,
    pos: [-fp * 0.3, base + h * 0.36, d / 2 + 0.04],
  });
  if (tier >= 3) {
    b.add({
      geo: cyl(0.025, 0.025, 0.9, 6),
      color: "#4b5563",
      pos: [tx, base + th + fp * 1.1 + 0.4, d * 0.15],
    });
    b.add({
      geo: box(0.45, 0.28, 0.02),
      color: accent,
      pos: [tx + 0.24, base + th + fp * 1.1 + 0.72, d * 0.15],
    });
  }
  return b.build(base + th + fp * 1.1);
}

/**
 * Digital & Daten: Flachdach-Kubus mit leuchtendem Fensterband um das Obergeschoss, Antenne und
 * Serverkasten auf dem Dach. Stufe 2 Vordach in Akzentfarbe, Stufe 3 zweiter, versetzter Kubus.
 */
export function digitalModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent: string,
): Model {
  const b = new Builder();
  const w = fp * 2.1;
  const d = fp * 2.0;
  const h = fp * 1.4;
  const base = FLAT_BASE;
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  b.add({ geo: box(w + 0.1, 0.16, d + 0.1), color: roof, pos: [0, base + h + 0.08, 0] });

  // Fensterband um das Obergeschoss (Front, Rückseite, Seiten)
  const by = base + h * 0.68;
  const bh = h * 0.2;
  b.light({ geo: box(w * 0.9, bh, 0.08), color: "#cfe0ff", pos: [0, by, d / 2 + 0.02] });
  b.light({ geo: box(w * 0.9, bh, 0.08), color: "#cfe0ff", pos: [0, by, -d / 2 - 0.02] });
  for (const sx of [-1, 1]) {
    b.light({ geo: box(0.08, bh, d * 0.9), color: "#cfe0ff", pos: [sx * (w / 2 + 0.02), by, 0] });
  }
  b.add({
    geo: box(w * 0.9 + 0.1, 0.06, 0.12),
    color: accent,
    pos: [0, by - bh / 2 - 0.04, d / 2 + 0.03],
  });
  b.add({
    geo: box(w * 0.9 + 0.1, 0.06, 0.12),
    color: accent,
    pos: [0, by + bh / 2 + 0.04, d / 2 + 0.03],
  });
  frontDoor(b, -w * 0.28, d / 2 + 0.03, fp * 0.5, fp * 0.75, accent);

  // Dach: Antenne und Serverkasten
  const rt = base + h + 0.16;
  b.add({
    geo: cyl(0.025, 0.035, fp * 1.3, 6),
    color: "#8b9198",
    pos: [w * 0.3, rt + fp * 0.65, -d * 0.2],
  });
  b.add({ geo: box(0.3, 0.03, 0.03), color: "#8b9198", pos: [w * 0.3, rt + fp * 1.0, -d * 0.2] });
  b.light({ geo: box(0.06, 0.06, 0.06), color: accent, pos: [w * 0.3, rt + fp * 1.32, -d * 0.2] });
  b.add({
    geo: box(w * 0.34, fp * 0.38, d * 0.3),
    color: "#5b5870",
    pos: [-w * 0.22, rt + fp * 0.19, -d * 0.18],
  });
  b.light({
    geo: box(w * 0.26, 0.05, 0.02),
    color: accent,
    pos: [-w * 0.22, rt + fp * 0.25, -d * 0.18 + d * 0.15 + 0.01],
  });

  if (tier >= 2) {
    b.add({
      geo: box(w * 0.7, 0.07, 1.0),
      color: accent,
      pos: [-w * 0.1, base + fp * 1.05, d / 2 + 0.5],
      rot: [0.1, 0, 0],
    });
    for (const sx of [-1, 1]) {
      b.add({
        geo: cyl(0.04, 0.04, fp * 1.0, 8),
        color: WHITE,
        pos: [-w * 0.1 + sx * w * 0.33, base + fp * 0.5, d / 2 + 0.95],
      });
    }
  }
  if (tier >= 3) {
    const ax = w / 2 + fp * 0.55;
    const ah = h * 0.78;
    b.add({ geo: box(fp * 1.1, ah, fp * 1.2), color: wall, pos: [ax, base + ah / 2, -d * 0.2] });
    b.add({
      geo: box(fp * 1.2, 0.14, fp * 1.3),
      color: roof,
      pos: [ax, base + ah + 0.07, -d * 0.2],
    });
    b.light({
      geo: box(fp * 0.8, ah * 0.2, 0.08),
      color: "#cfe0ff",
      pos: [ax, base + ah * 0.62, -d * 0.2 + fp * 0.6 + 0.02],
    });
  }
  return b.build(base + h + fp * 1.3);
}

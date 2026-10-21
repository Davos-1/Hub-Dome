import type { Tier } from "@/lib/layout";
import { arch, box, cyl, gable, rbox, sphere } from "../geo";
import {
  BRICK,
  Builder,
  darken,
  frontWindow,
  STONE,
  WARM,
  WHITE,
  WOOD,
  type Model,
} from "./common";

/** Einfaches Haus: Satteldach, Läden, Blumenkästen; ab Stufe 2 Kamin und Vordach, ab Stufe 3 Anbau. */
export function hausModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent?: string,
  chimney?: boolean,
): Model {
  const b = new Builder();
  const w = fp * 2;
  const d = fp * 2.1;
  const h = fp * 1.5;
  const base = 0.18;
  const shutter = accent ?? darken(roof, 0.9);
  const doorColor = accent ? darken(accent, 0.85) : WOOD;

  b.add({ geo: rbox(w + 0.14, base, d + 0.14, 0.04), color: STONE, pos: [0, base / 2, 0] });
  b.add({ geo: rbox(w, h, d, 0.08), color: wall, pos: [0, base + h / 2, 0] });
  b.add({ geo: gable(w + 0.6, fp * 0.95, d + 0.6), color: roof, pos: [0, base + h, 0] });
  b.add({
    geo: rbox(0.12, 0.1, d + 0.62, 0.03),
    color: darken(roof, 0.75),
    pos: [0, base + h + fp * 0.95, 0],
  });

  const doorW = fp * 0.55;
  const doorH = fp * 0.75;
  b.add({
    geo: box(doorW, doorH, 0.1),
    color: doorColor,
    pos: [0, base + doorH / 2, d / 2 + 0.01],
  });
  b.add({ geo: arch(doorW / 2, 0.1), color: doorColor, pos: [0, base + doorH, d / 2 + 0.01] });
  b.add({
    geo: sphere(0.045, 8),
    color: "#e0b341",
    pos: [doorW * 0.3, base + doorH * 0.5, d / 2 + 0.08],
  });
  b.add({
    geo: rbox(doorW + 0.5, 0.1, 0.4, 0.03),
    color: STONE,
    pos: [0, base + 0.01, d / 2 + 0.22],
  });

  frontWindow(b, -fp * 0.66, base + h * 0.62, d / 2 + 0.03, fp * 0.36, fp * 0.42, shutter);
  frontWindow(b, fp * 0.66, base + h * 0.62, d / 2 + 0.03, fp * 0.36, fp * 0.42, shutter);
  for (const side of [-1, 1]) {
    b.add({
      geo: rbox(0.1, fp * 0.56, fp * 0.5, 0.02),
      color: WHITE,
      pos: [side * (w / 2 + 0.01), base + h * 0.6, 0],
    });
    b.light({
      geo: box(0.12, fp * 0.42, fp * 0.36),
      color: WARM,
      pos: [side * (w / 2 + 0.01), base + h * 0.6, 0],
    });
  }

  if (chimney ?? tier >= 2) {
    const cx = fp * 0.55;
    const cz = -d * 0.18;
    const cy = base + h + fp * 0.45;
    b.add({ geo: box(fp * 0.3, fp * 0.9, fp * 0.3), color: BRICK, pos: [cx, cy, cz] });
    b.add({
      geo: box(fp * 0.4, 0.08, fp * 0.4),
      color: darken(BRICK, 0.8),
      pos: [cx, cy + fp * 0.47, cz],
    });
  }

  if (tier >= 2) {
    b.add({
      geo: rbox(doorW + 0.9, 0.07, 0.6, 0.02),
      color: darken(roof, 1.1),
      pos: [0, base + doorH + 0.35, d / 2 + 0.3],
      rot: [0.15, 0, 0],
    });
    for (const side of [-1, 1]) {
      b.add({
        geo: cyl(0.04, 0.04, doorH + 0.3, 8),
        color: WHITE,
        pos: [side * (doorW / 2 + 0.35), base + (doorH + 0.3) / 2, d / 2 + 0.5],
      });
    }
  }

  if (tier >= 3) {
    const aw = fp * 1.1;
    const ah = h * 0.72;
    const ad = d * 0.85;
    const ax = w / 2 + aw / 2 - 0.05;
    b.add({ geo: rbox(aw, ah, ad, 0.07), color: wall, pos: [ax, base + ah / 2, -d * 0.05] });
    b.add({
      geo: gable(ad + 0.5, fp * 0.7, aw + 0.5),
      color: roof,
      pos: [ax, base + ah, -d * 0.05],
      rot: [0, Math.PI / 2, 0],
    });
    b.add({
      geo: rbox(aw + 0.1, base, ad + 0.1, 0.03),
      color: STONE,
      pos: [ax, base / 2, -d * 0.05],
    });
    b.light({
      geo: box(fp * 0.42, fp * 0.42, 0.12),
      color: WARM,
      pos: [ax, base + ah * 0.55, -d * 0.05 + ad / 2],
    });
    b.add({
      geo: rbox(fp * 0.52, fp * 0.52, 0.09, 0.02),
      color: WHITE,
      pos: [ax, base + ah * 0.55, -d * 0.05 + ad / 2 - 0.02],
    });
    b.add({
      geo: cyl(0.03, 0.03, fp * 1.1, 6),
      color: "#4b5563",
      pos: [0, base + h + fp * 1.45, d * 0.3],
    });
    b.add({
      geo: box(0.55, 0.3, 0.03),
      color: "#ef4444",
      pos: [0.3, base + h + fp * 1.85, d * 0.3],
    });
    b.add({
      geo: cyl(0.04, 0.05, 0.9, 8),
      color: "#374151",
      pos: [doorW + 0.55, 0.45, d / 2 + 0.7],
    });
    b.light({ geo: sphere(0.12, 8), color: "#ffd479", pos: [doorW + 0.55, 0.98, d / 2 + 0.7] });
  }
  return b.build(base + h + fp * 0.95 + (tier >= 2 ? fp * 0.4 : 0));
}

import type { Tier } from "@/lib/layout";
import { box, cyl, rbox } from "../geo";
import {
  BRICK,
  BRASS,
  Builder,
  Frame,
  IRON,
  LEAF,
  STONE,
  WOOD,
  WHITE,
  canopy,
  chimney,
  darken,
  doorAt,
  gableRoof,
  ico,
  plinth,
  rboxLow,
  roundWindow,
  wallFrames,
  windowAt,
  type Model,
} from "./common";

/**
 * Giebelhaus: Satteldach mit Giebelfüllung und Rundfenster, Läden, Blumenkästen, Rundbogentür.
 * Ab Stufe 2 Kamin und Vordach mit Pfosten, ab Stufe 3 Anbau, Blumentöpfe, Gartenlampe und Fahne.
 */
export function hausModel(
  fp: number,
  tier: Tier,
  wall: string,
  roof: string,
  accent?: string,
  chimneyOn?: boolean,
): Model {
  const b = new Builder();
  const w = fp * 2;
  const d = fp * 2.1;
  const h = fp * 1.5;
  const base = 0.18;
  const shutter = accent ?? darken(roof, 0.9);
  const doorColor = accent ? darken(accent, 0.85) : WOOD;
  const trim = darken(roof, 0.72);
  const walls = wallFrames(b, w, d);

  // Bodenplatte, Sockel, Wände
  b.add({ geo: box(w + 0.14, base, d + 0.14), color: STONE, pos: [0, base / 2, 0] });
  b.add({ geo: rbox(w, h, d, 0.08), color: wall, pos: [0, base + h / 2, 0] });
  plinth(b, w, d, base, wall);

  // Dach mit Überstand, Giebelfüllung, Ortgang, First, Rinne und Schindelreihen
  const roofFrame = new Frame(b, 0, base + h, 0, 0);
  gableRoof(roofFrame, w + 0.6, fp * 0.95, d + 0.6, roof, {
    trim,
    gutter: true,
    plate: wall,
    rows: 3,
  });
  const gf = new Frame(b, 0, base + h, (d + 0.6) / 2 + 0.024, 0);
  roundWindow(gf, 0, 0.07 + fp * 0.38, fp * 0.13, WHITE);
  const gb = new Frame(b, 0, base + h, -(d + 0.6) / 2 - 0.024, Math.PI);
  roundWindow(gb, 0, 0.07 + fp * 0.38, fp * 0.1, WHITE);

  // Vorderseite: Rundbogentür, zwei Fenster mit Läden und Blumenkästen
  const doorW = fp * 0.5;
  const doorH = fp * 0.78;
  doorAt(walls.front, 0, doorW, doorH, base, {
    leaf: doorColor,
    arched: true,
    steps: true,
    stone: STONE,
  });
  for (const s of [-1, 1]) {
    windowAt(walls.front, s * fp * 0.68, base + h * 0.62, fp * 0.3, fp * 0.4, {
      shutter,
      flowers: true,
    });
  }
  // Seiten: je zwei Fenster mit Läden; hinten ein Fenster
  for (const side of tier >= 3 ? [walls.left] : [walls.left, walls.right]) {
    for (const s of [-1, 1]) {
      windowAt(side, s * fp * 0.5, base + h * 0.6, fp * 0.3, fp * 0.4, { shutter, plain: true });
    }
  }
  windowAt(walls.back, 0, base + h * 0.6, fp * 0.34, fp * 0.42, { shutter, plain: true });

  if (chimneyOn ?? tier >= 2) {
    // Oberkante der Kaminabdeckung = chimneyTop() in index.ts
    chimney(b, fp * 0.55, -d * 0.18, base + h, base + h + fp * 0.9, fp * 0.3, BRICK);
  }

  if (tier >= 2) {
    // Vordach über der Tür mit zwei Pfosten auf der Stufe
    const cw = fp * 0.5 + 0.2;
    const cv = base + doorH + 0.24;
    canopy(walls.front, 0, cv, cw, 0.5, darken(roof, 1.05), trim);
    for (const s of [-1, 1]) {
      walls.front.add(
        cyl(0.036, 0.036, cv - 0.1, 8),
        WHITE,
        s * (cw / 2 - 0.02),
        0.1 + (cv - 0.1) / 2,
        0.42,
      );
    }
    // Laterne unter dem Vordach
    walls.front.box(0.012, 0.08, 0.012, IRON, 0, cv - 0.07, 0.26);
    walls.front.lit(cyl(0.05, 0.05, 0.11, 6), "#ffd479", 0, cv - 0.17, 0.26);
  }

  if (tier >= 3) {
    const aw = fp * 1.1;
    const ah = h * 0.72;
    const ad = d * 0.85;
    const ax = w / 2 + aw / 2 - 0.05;
    const az = -d * 0.05;
    b.add({ geo: box(aw + 0.1, base, ad + 0.1), color: STONE, pos: [ax, base / 2, az] });
    b.add({ geo: rboxLow(aw, ah, ad, 0.07), color: wall, pos: [ax, base + ah / 2, az] });
    plinth(b, aw, ad, base, wall, ax, az);
    const annexRoof = new Frame(b, ax, base + ah, az, Math.PI / 2);
    gableRoof(annexRoof, ad + 0.5, fp * 0.7, aw + 0.5, roof, { trim, plate: wall, rows: 1 });
    const annex = wallFrames(b, aw, ad, ax, az);
    windowAt(annex.front, 0, base + ah * 0.55, fp * 0.3, fp * 0.34, { shutter, flowers: true });
    windowAt(annex.right, 0, base + ah * 0.55, fp * 0.34, fp * 0.38, { shutter, plain: true });
    const ef = new Frame(b, ax + (aw + 0.5) / 2 + 0.024, base + ah, az, Math.PI / 2);
    roundWindow(ef, 0, 0.07 + fp * 0.22, fp * 0.09, WHITE);

    // Blumentöpfe neben der Tür
    for (const s of [-1, 1]) {
      walls.front.add(cyl(0.07, 0.1, 0.16, 7), "#c0704a", s * (doorW / 2 + 0.38), 0.1 + 0.08, 0.37);
      walls.front.add(ico(0.1), LEAF, s * (doorW / 2 + 0.38), 0.1 + 0.2, 0.37);
      walls.front.add(
        ico(0.045),
        s > 0 ? "#f59e0b" : "#ec4899",
        s * (doorW / 2 + 0.34),
        0.1 + 0.3,
        0.4,
      );
    }
    // Fahne auf dem First
    b.add({
      geo: cyl(0.03, 0.03, fp * 1.1, 6),
      color: IRON,
      pos: [0, base + h + fp * 1.45, d * 0.3],
    });
    b.add({ geo: ico(0.05), color: BRASS, pos: [0, base + h + fp * 2.0 + 0.04, d * 0.3] });
    b.add({
      geo: box(0.55, 0.3, 0.03),
      color: "#ef4444",
      pos: [0.3, base + h + fp * 1.85, d * 0.3],
    });
    // Gartenlampe vor dem Haus
    const lx = doorW + 0.55;
    const lz = d / 2 + 0.7;
    b.add({ geo: cyl(0.04, 0.05, 0.9, 6), color: "#374151", pos: [lx, 0.45, lz] });
    b.add({ geo: box(0.14, 0.04, 0.14), color: "#374151", pos: [lx, 0.9, lz] });
    b.light({ geo: cyl(0.075, 0.075, 0.18, 6), color: "#ffd479", pos: [lx, 1.01, lz] });
    b.add({ geo: cyl(0.01, 0.1, 0.07, 6), color: "#374151", pos: [lx, 1.14, lz] });
  }
  return b.build(base + h + fp * 0.95 + (tier >= 3 ? fp * 0.75 : tier >= 2 ? fp * 0.4 : 0));
}

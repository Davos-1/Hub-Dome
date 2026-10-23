import * as THREE from "three";
import type { Tier } from "@/lib/layout";
import { box, cyl, cylZ } from "../geo";
import {
  BRASS,
  Builder,
  Frame,
  GLASS,
  IRON,
  LEAF,
  SLATE,
  STONE,
  WARM,
  WHITE,
  WOOD,
  band,
  canopy,
  chimney,
  corners,
  darken,
  doorAt,
  gableRoof,
  ico,
  lantern,
  mix,
  plinth,
  roundWindow,
  slopeAt,
  stoneFor,
  tilt,
  wallFrames,
  windowAt,
  type Model,
} from "./common";

/**
 * Haustypen der Fachbereiche (Port aus dem Design-Prototyp). Alle Modelle: Front zeigt nach +z,
 * drei Wachstumsstufen (Tier 1–3), Leuchtteile (Fenster) getrennt im `glow`.
 * Fenster, Türen, Dächer und Kamine kommen aus den Bausteinen in `common.ts`; die Grundfläche und
 * die Dreieckszahl (höchstens 2500 je Modell) sind im Test `house-models.test.ts` festgehalten.
 */

const FLAT_BASE = 0.18;

/** Bodenplatte aus Stein, etwas grösser als das Haus. */
function slab(b: Builder, w: number, d: number, cx = 0, cz = 0) {
  b.add({ geo: box(w + 0.14, FLAT_BASE, d + 0.14), color: STONE, pos: [cx, FLAT_BASE / 2, cz] });
}

/**
 * Werkstatt: breites Haus mit Rolltor, Werkstattfenstern und Esse; Stufe 2 Holz-Pergola mit Werkbank an der
 * Seitenwand, Stufe 3 zusätzlich Silo mit Förderrohr.
 */
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
  const walls = wallFrames(b, w, d);
  const dark = darken(wall, 0.86);
  const wood = mix(wall, WOOD, 0.55);
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  plinth(b, w, d, base, wall);
  // feine Brettfugen, Eckpfeiler
  for (let y = base + 0.34; y < base + h - 0.12; y += 0.19) {
    band(b, w, d, y, 0.02, darken(wall, 0.9), 0.008);
  }
  corners(b, w, d, base + 0.14, base + h, dark);

  // Dach: Traufe vorne und hinten, Giebel links und rechts, zwei Dachfenster nach vorn
  const rw = d + 0.4;
  const rh = fp * 0.45;
  const rd = w + 0.4;
  const rf = new Frame(b, 0, base + h, 0, Math.PI / 2);
  gableRoof(rf, rw, rh, rd, roof, { gutter: true, plate: darken(wall, 0.92), rows: 2 });
  for (const s of [-1, 1]) {
    roundWindow(new Frame(b, s * (rd / 2 + 0.024), base + h, 0, (s * Math.PI) / 2), 0, 0.2, 0.07);
  }
  const skFrame = slopeAt(rw, rh, -1, 0.5, 0);
  const skGlass = slopeAt(rw, rh, -1, 0.5, 0.014);
  for (const s of [-1, 1]) {
    rf.box(0.44, 0.035, 0.48, IRON, skFrame.u, skFrame.v, s * rd * 0.26, skFrame.rz);
    rf.lit(box(0.34, 0.03, 0.38), GLASS, skGlass.u, skGlass.v, s * rd * 0.26, skGlass.rz);
  }
  // Esse auf der Rückseite des Daches; Öffnung = chimneyTop() in index.ts
  chimney(b, -w * 0.28, -d * 0.2, base + h, base + h + fp * 0.85, fp * 0.24, "#a26a55");

  // Rolltor mit Lamellen, Führungsschienen, Rollkasten und Lichtschlitz
  const f = walls.front;
  const dw = fp * 1.2;
  const dh = h * 0.78;
  for (const s of [-1, 1]) {
    f.box(0.1, dh + 0.12, 0.07, dark, s * (dw / 2 + 0.05), base + (dh + 0.12) / 2, 0.035);
    f.box(0.05, dh, 0.075, IRON, s * (dw / 2 - 0.02), base + dh / 2, 0.035);
  }
  f.box(dw, dh, 0.06, "#8c8f94", 0, base + dh / 2, 0);
  for (let i = 1; i < 9; i++) f.box(dw, 0.02, 0.012, "#6b6e73", 0, base + (dh * i) / 9, 0.036);
  f.litBox(dw * 0.7, 0.05, 0.02, WARM, 0, base + dh * 0.88, 0.04);
  f.box(dw + 0.04, 0.06, 0.08, IRON, 0, base + 0.03, 0.04);
  f.box(0.16, 0.04, 0.04, IRON, 0, base + 0.14, 0.055);
  f.box(dw + 0.3, 0.16, 0.13, accent, 0, base + dh + 0.1, 0.065);
  f.box(dw + 0.5, 0.09, 0.34, STONE, 0, 0.045, 0.17);
  // Werkstattfenster neben dem Tor
  for (const s of [-1, 1]) {
    windowAt(f, s * fp * 0.9, base + h * 0.58, fp * 0.3, fp * 0.34, {
      frame: wood,
      sillColor: wood,
    });
  }
  // Kisten und Fass an der Wand
  f.box(0.34, 0.28, 0.3, "#a0703f", -fp * 0.9, base + 0.14, 0.17);
  f.box(0.2, 0.2, 0.22, "#b88450", -fp * 0.9 + 0.04, base + 0.38, 0.15);
  f.add(cyl(0.14, 0.14, 0.34, 8), "#8a5a34", fp * 0.9, base + 0.17, 0.2);
  for (const dy of [-0.09, 0.09])
    f.add(cyl(0.146, 0.146, 0.022, 8), IRON, fp * 0.9, base + 0.17 + dy, 0.2);
  // Seiten und Rückseite
  windowAt(walls.left, d * 0.34, base + h * 0.58, fp * 0.3, fp * 0.34, {
    frame: wood,
    sillColor: wood,
  });
  windowAt(walls.right, 0, base + h * 0.58, fp * 0.3, fp * 0.34, { frame: wood, sillColor: wood });
  for (const s of [-1, 1]) {
    windowAt(walls.back, s * w * 0.3, base + h * 0.58, fp * 0.3, fp * 0.34, {
      frame: wood,
      sillColor: wood,
    });
  }

  if (tier >= 2) {
    // Holz-Pergola an der rechten Seitenwand: Wandbalken, zwei Pfosten, Sparren, Querlatten, Ranken, Werkbank
    const pf = new Frame(b, w / 2, 0, 0, Math.PI / 2);
    const hz = d * 0.36;
    const top = base + h * 0.86;
    const beam = darken(WOOD, 1.08);
    pf.box(hz * 2 + 0.24, 0.1, 0.07, beam, 0, top, 0.035);
    pf.box(hz * 2 + 0.3, 0.12, 0.1, beam, 0, top, 0.5);
    for (const s of [-1, 1]) {
      pf.box(0.1, top, 0.1, WOOD, s * hz, top / 2, 0.5);
      pf.box(0.17, 0.1, 0.17, STONE, s * hz, 0.05, 0.5);
      pf.box(0.42, 0.06, 0.06, beam, s * (hz - 0.15), top - 0.15, 0.5, (-s * Math.PI) / 4);
    }
    for (let i = 0; i < 5; i++) {
      pf.box(0.07, 0.08, 0.62, beam, -hz + (i * hz) / 2, top + 0.095, 0.3);
    }
    for (const n of [0.1, 0.27, 0.44, 0.58]) {
      pf.box(hz * 2 + 0.2, 0.035, 0.06, darken(WOOD, 0.9), 0, top + 0.15, n);
    }
    // Ranken: Blattklumpen auf Balken und Pfosten, hängende Triebe, ein paar Blüten
    for (let i = 0; i < 5; i++) {
      const u = -hz - 0.05 + (i * (hz * 2 + 0.1)) / 4;
      pf.add(
        ico(0.075 + (i % 3) * 0.015),
        i % 2 ? LEAF : darken(LEAF, 0.85),
        u,
        top + 0.02 + (i % 2) * 0.05,
        0.5 + ((i % 3) - 1) * 0.03,
      );
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        pf.add(
          ico(0.07 - k * 0.008),
          k % 2 ? darken(LEAF, 0.85) : LEAF,
          s * hz + (k % 2 ? 0.04 : -0.03),
          top * (0.5 + k * 0.3),
          0.5 + 0.02 * (k % 2),
        );
      }
    }
    for (let i = 0; i < 4; i++) {
      const u = -hz + 0.1 + (i * (hz * 2 - 0.2)) / 3;
      pf.box(
        0.022,
        0.26 - (i % 3) * 0.05,
        0.022,
        darken(LEAF, 0.8),
        u,
        top - 0.19 + (i % 3) * 0.025,
        0.5,
      );
      pf.add(ico(0.035), LEAF, u, top - 0.33 + (i % 3) * 0.05, 0.5);
    }
    for (const [u, c] of [
      [-hz * 0.5, "#fff6e6"],
      [hz * 0.15, "#f9a8d4"],
      [hz * 0.8, "#fff6e6"],
    ] as const) {
      pf.add(ico(0.03), c, u, top + 0.12, 0.5);
    }
    // Werkbank unter der Pergola
    pf.box(1.0, 0.06, 0.42, "#a0703f", 0, 0.7, 0.24);
    for (const su of [-0.44, 0.44]) {
      for (const n of [0.07, 0.4]) pf.box(0.06, 0.7, 0.06, WOOD, su, 0.35, n);
    }
    pf.box(0.94, 0.03, 0.36, WOOD, 0, 0.26, 0.24);
    pf.box(0.14, 0.12, 0.1, IRON, 0.4, 0.79, 0.38);
    pf.box(0.22, 0.03, 0.06, IRON, -0.2, 0.745, 0.3);
    pf.box(0.16, 0.025, 0.025, "#c79a5e", -0.35, 0.745, 0.3);
    pf.box(0.3, 0.2, 0.3, "#b88450", -0.9, 0.1, 0.3);
  }

  if (tier >= 3) {
    // Silo links neben dem Haus, mit Abstand zur Dachkante; ein Förderrohr verbindet ihn mit der Wand
    const r = fp * 0.34;
    const sx = -(w / 2 + 0.26 + r);
    const sz = -d * 0.2;
    const sh = h * 1.75;
    b.add({ geo: cyl(r, r, sh + base, 10), color: "#c9ccd0", pos: [sx, (sh + base) / 2, sz] });
    b.add({ geo: cyl(r + 0.06, r + 0.07, 0.24, 10), color: STONE, pos: [sx, 0.12, sz] });
    for (const k of [1, 2]) {
      b.add({
        geo: cyl(r + 0.02, r + 0.02, 0.06, 10),
        color: "#9aa0a6",
        pos: [sx, base + (sh * k) / 3, sz],
      });
    }
    b.add({
      geo: new THREE.ConeGeometry(r * 1.1, fp * 0.3, 10),
      color: "#9aa0a6",
      pos: [sx, base + sh + fp * 0.15, sz],
    });
    b.add({
      geo: cyl(0.04, 0.05, 0.12, 6),
      color: IRON,
      pos: [sx, base + sh + fp * 0.3 + 0.05, sz],
    });
    const lz = sz + Math.sqrt(r * r - 0.12 * 0.12) + 0.012;
    for (const s of [-1, 1]) {
      b.add({
        geo: box(0.035, sh * 0.85, 0.04),
        color: IRON,
        pos: [sx + s * 0.12, base + sh * 0.45, lz],
      });
    }
    for (let y = base + 0.3; y < base + sh * 0.85; y += 0.28) {
      b.add({ geo: box(0.24, 0.025, 0.03), color: IRON, pos: [sx, y, lz + 0.006] });
    }
    b.add({ geo: box(0.28, 0.42, 0.05), color: "#6b6e73", pos: [sx - 0.15, 0.4, sz + r - 0.02] });
    b.add({ geo: box(0.04, 0.04, 0.03), color: BRASS, pos: [sx - 0.06, 0.4, sz + r + 0.015] });
    const px = (sx + r + -w / 2) / 2;
    b.add({
      geo: cylZ(0.05, 0.05, 0.26 + 0.1, 8),
      color: IRON,
      pos: [px, base + h * 0.55, sz],
      rot: [0, Math.PI / 2, 0],
    });
    b.add({ geo: box(0.05, 0.16, 0.16), color: SLATE, pos: [-w / 2 - 0.02, base + h * 0.55, sz] });
    b.add({ geo: box(0.05, 0.16, 0.16), color: SLATE, pos: [sx + r - 0.01, base + h * 0.55, sz] });
  }
  return b.build(base + h + fp * 0.45 + (tier >= 3 ? 1.0 : 0.5));
}

/** Blockhaus aus Rundholz mit Balkenköpfen, Aussenkamin und Schindeldach; Stufe 2 Veranda, Stufe 3 Holzstapel. */
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
  const walls = wallFrames(b, w, d);
  const frameWood = darken(wall, 0.5);
  slab(b, w, d);
  b.add({
    geo: box(w - lr * 2, h, d - lr * 2),
    color: darken(wall, 0.85),
    pos: [0, base + h / 2, 0],
  });
  // Rundholz-Lagen, an den Ecken überkreuzt. Die Balken sind offene Röhren; die Stirnflächen der Balkenköpfe
  // sind helle Scheiben (Hirnholz), so bleibt jeder Balken bei 32 Dreiecken.
  const reach = 0.15;
  const tube = (len: number) => {
    const g = new THREE.CylinderGeometry(lr, lr, len, 8, 1, true);
    g.rotateX(Math.PI / 2);
    return g;
  };
  for (let i = 0; i < n; i++) {
    const y = base + lr + i * lr * 2;
    const c = i % 2 ? wall : darken(wall, 0.92);
    const grain = mix(c, "#f2dcae", 0.55);
    for (const sx of [-1, 1]) {
      b.add({ geo: tube(d + reach * 2), color: c, pos: [sx * (w / 2 - lr), y, 0] });
      for (const sz of [-1, 1]) {
        b.add({
          geo: new THREE.CircleGeometry(lr, 8),
          color: grain,
          pos: [sx * (w / 2 - lr), y, sz * (d / 2 + reach)],
          rot: [0, sz > 0 ? 0 : Math.PI, 0],
        });
      }
    }
    for (const sz of [-1, 1]) {
      b.add({
        geo: tube(w + reach * 2),
        color: c,
        pos: [0, y + lr, sz * (d / 2 - lr)],
        rot: [0, Math.PI / 2, 0],
      });
      for (const sx of [-1, 1]) {
        b.add({
          geo: new THREE.CircleGeometry(lr, 8),
          color: grain,
          pos: [sx * (w / 2 + reach), y + lr, sz * (d / 2 - lr)],
          rot: [0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
        });
      }
    }
  }

  // Schindeldach mit Giebelbrettern und Rundfenster
  const rw = w + 0.7;
  const rh = fp * 1.05;
  const rd = d + 0.6;
  gableRoof(new Frame(b, 0, base + h, 0, 0), rw, rh, rd, roof, {
    plate: darken(wall, 0.88),
    rows: 3,
  });
  roundWindow(
    new Frame(b, 0, base + h, rd / 2 + 0.024, 0),
    0,
    0.07 + rh * 0.34,
    fp * 0.12,
    frameWood,
  );

  // Aussenkamin aus Naturstein an der rechten Wand, vom Boden bis über den Dachfirst (= chimneyTop())
  const cs = fp * 0.4;
  const cx = fp * 0.9;
  const cz = -fp * 0.4;
  chimney(b, cx, cz, 0, base + fp * 2.02, cs, "#9b958a");
  b.add({ geo: box(cs + 0.14, 0.3, cs + 0.14), color: "#857f75", pos: [cx, 0.15, cz] });

  // Vorderseite: Holztür mit Rahmen, zwei Fenster
  const f = walls.front;
  const doorW = fp * 0.55;
  const doorH = fp * 0.8;
  doorAt(f, 0, doorW, doorH, base, {
    leaf: mix(darken(wall, 0.62), accent, 0.35),
    frame: frameWood,
    steps: tier < 2,
  });
  for (const s of [-1, 1]) {
    windowAt(f, s * fp * 0.68, base + h * 0.58, fp * 0.28, fp * 0.34, {
      frame: frameWood,
      sillColor: darken(wall, 0.7),
      shutter: null,
    });
  }
  if (tier < 2) lantern(f, 0, base + doorH + 0.26);
  for (const side of [walls.left, walls.right]) {
    windowAt(side, 0, base + h * 0.58, fp * 0.28, fp * 0.34, {
      frame: frameWood,
      sillColor: darken(wall, 0.7),
    });
  }
  windowAt(walls.back, 0, base + h * 0.58, fp * 0.28, fp * 0.34, {
    frame: frameWood,
    sillColor: darken(wall, 0.7),
  });

  if (tier >= 2) {
    // Veranda: Dielenboden, zwei Pfosten, Geländer, Pultdach, Bank und Laterne
    const vz = d / 2;
    const vd = 1.0;
    const deckTop = 0.22;
    const vf = new Frame(b, 0, 0, vz, 0);
    vf.box(w + 0.5, deckTop, vd - 0.05, "#8a5a34", 0, deckTop / 2, vd / 2 + 0.02);
    for (let i = 0; i < 4; i++) {
      const bw = (w + 0.5) / 4;
      vf.box(
        bw - 0.01,
        0.02,
        vd - 0.05,
        i % 2 ? "#a0703f" : "#94643a",
        -(w + 0.5) / 2 + bw / 2 + i * bw,
        deckTop + 0.005,
        vd / 2 + 0.02,
      );
    }
    const stepW = 0.7;
    vf.box(stepW, 0.12, 0.18, "#7d5030", 0, 0.06, vd + 0.07);
    const px = w / 2 + 0.2;
    const pz = vd - 0.06;
    // Pfostenhöhe: bis knapp unter die Unterkante des geneigten Daches an dieser Stelle
    const rg = base + h * 0.95;
    const tl = Math.tan(0.17);
    const ph = rg - (pz - (vd + 0.12) / 2) * tl - 0.04 - 0.06 - deckTop;
    for (const s of [-1, 1]) {
      vf.add(cyl(0.065, 0.065, ph, 6), WOOD, s * px, deckTop + ph / 2, pz);
      vf.box(0.17, 0.08, 0.17, darken(WOOD, 0.8), s * px, deckTop + 0.04, pz);
      vf.box(0.14, 0.06, 0.14, darken(WOOD, 0.8), s * px, deckTop + ph - 0.03, pz);
    }
    // Geländer vorne (mit Lücke für die Stufen) und an den Seiten
    const railY = deckTop + 0.5;
    for (const s of [-1, 1]) {
      const u0 = s * (stepW / 2 + 0.06);
      const u1 = s * px;
      const mid = (u0 + u1) / 2;
      const len = Math.abs(u1 - u0);
      vf.box(len, 0.05, 0.05, WOOD, mid, railY, pz);
      vf.box(len, 0.04, 0.04, WOOD, mid, deckTop + 0.12, pz);
      for (let k = 0; k <= 2; k++) {
        vf.box(0.035, 0.46, 0.035, "#a0703f", u0 + ((u1 - u0) * (k + 0.5)) / 3, deckTop + 0.26, pz);
      }
      vf.box(0.05, 0.05, vd - 0.1, WOOD, s * px, railY, vd / 2 + 0.02);
      vf.box(0.04, 0.04, vd - 0.1, WOOD, s * px, deckTop + 0.12, vd / 2 + 0.02);
    }
    // Pultdach mit Stirnbrett
    vf.add(tilt(box(w + 0.7, 0.08, vd + 0.12), 0.17), roof, 0, rg, (vd + 0.12) / 2);
    vf.box(w + 0.72, 0.1, 0.04, darken(roof, 0.72), 0, rg - (vd + 0.1) * 0.085, vd + 0.12);
    vf.box(0.012, 0.18, 0.012, IRON, 0, rg - 0.12, vd * 0.55);
    vf.lit(cyl(0.05, 0.05, 0.1, 6), "#ffd479", 0, rg - 0.25, vd * 0.55);
    // Bank neben der Tür
    vf.box(0.8, 0.05, 0.3, "#a0703f", w * 0.27, deckTop + 0.38, 0.3);
    for (const s of [-1, 1])
      vf.box(0.06, 0.38, 0.28, WOOD, w * 0.27 + s * 0.34, deckTop + 0.19, 0.3);
    vf.box(0.8, 0.3, 0.04, "#a0703f", w * 0.27, deckTop + 0.6, 0.15);
    // Blumentopf am Pfosten
    vf.add(cyl(0.09, 0.07, 0.15, 7), "#c0704a", -w * 0.3, deckTop + 0.075, 0.35);
    vf.add(ico(0.1), LEAF, -w * 0.3, deckTop + 0.22, 0.35);
    vf.add(ico(0.045), "#ec4899", -w * 0.3 + 0.03, deckTop + 0.31, 0.38);
  }

  if (tier >= 3) {
    // Holzstapel (3-2-1) an der linken Wand, Hackklotz mit Beil
    const lx = -(w / 2 + 0.23);
    const rr = 0.1;
    const rows: [number, number][] = [
      [3, 0.1],
      [2, 0.3],
      [1, 0.5],
    ];
    for (const [cnt, yy] of rows) {
      for (let k = 0; k < cnt; k++) {
        const zz = -0.04 - (cnt - 1) * rr + k * rr * 2 + 0.2;
        const g = new THREE.CylinderGeometry(rr, rr, 0.42, 6, 1, true);
        g.rotateZ(Math.PI / 2);
        b.add({ geo: g, color: (k + cnt) % 2 ? "#a0703f" : "#b07d48", pos: [lx, yy, zz] });
        b.add({
          geo: new THREE.CircleGeometry(rr, 6),
          color: "#e8cf9a",
          pos: [lx - 0.21, yy, zz],
          rot: [0, -Math.PI / 2, 0],
        });
      }
    }
    for (const s of [-1, 1]) {
      b.add({ geo: box(0.06, 0.62, 0.06), color: WOOD, pos: [lx - 0.17, 0.31, 0.16 + s * 0.52] });
    }
    b.add({ geo: cyl(0.17, 0.18, 0.3, 8), color: "#8a5a34", pos: [lx - 0.02, 0.15, 1.05] });
    b.add({
      geo: box(0.04, 0.42, 0.04),
      color: "#c79a5e",
      pos: [lx - 0.02, 0.51, 1.05],
      rot: [0.5, 0, 0],
    });
    b.add({ geo: box(0.05, 0.1, 0.16), color: IRON, pos: [lx - 0.02, 0.33, 1.05 + 0.0] });
  }
  return b.build(base + h + fp * 1.05 + 0.2);
}

/** Grosses Fenster: Rahmen, leuchtende Scheibe, `cols` senkrechte Pfosten, `rows` Riegel, Sims. */
function bigWindow(
  f: Frame,
  u: number,
  v: number,
  gw: number,
  gh: number,
  o: { frame: string; glass: string; cols?: number; rows?: number; sill?: string },
) {
  const cols = o.cols ?? 0;
  const rows = o.rows ?? 0;
  f.box(gw + 0.12, gh + 0.12, 0.05, o.frame, u, v, 0.02);
  f.litBox(gw, gh, 0.04, o.glass, u, v, 0.03);
  for (let i = 1; i <= cols; i++) {
    f.box(0.035, gh, 0.035, o.frame, u - gw / 2 + (gw * i) / (cols + 1), v, 0.052);
  }
  for (let i = 1; i <= rows; i++) {
    f.box(gw, 0.035, 0.035, o.frame, u, v - gh / 2 + (gh * i) / (rows + 1), 0.052);
  }
  if (o.sill) f.box(gw + 0.24, 0.05, 0.14, o.sill, u, v - gh / 2 - 0.085, 0.07);
}

/** Geländer entlang u: Handlauf, Fussleiste und Stäbe; `v0` = Oberkante des Bodens. */
function railing(
  f: Frame,
  u0: number,
  len: number,
  v0: number,
  n: number,
  color: string,
  hgt = 0.36,
) {
  f.box(len, 0.035, 0.035, color, u0, v0 + hgt, n);
  f.box(len, 0.025, 0.025, color, u0, v0 + 0.05, n);
  const cnt = Math.max(2, Math.round(len / 0.11));
  for (let i = 0; i <= cnt; i++) {
    f.box(0.02, hgt, 0.02, color, u0 - len / 2 + (len * i) / cnt, v0 + hgt / 2, n);
  }
}

/** Solarpaneel mit Rahmen, Zellfeldern und Stützen auf einem Flachdach (Frame `rf` sitzt auf der Dachfläche). */
function solarPanel(rf: Frame, u: number, n: number, pw: number, pl: number) {
  const a = 0.45;
  const nv = [0, Math.cos(a), Math.sin(a)];
  const cy = 0.2;
  rf.add(tilt(box(pw, 0.04, pl), a), "#aeb4ba", u, cy, n);
  const off = (k: number): [number, number] => [cy + nv[1] * k, n + nv[2] * k];
  const [py, pn] = off(0.024);
  rf.add(tilt(box(pw - 0.06, 0.012, pl - 0.06), a), "#2b3f5c", u, py, pn);
  const [ly, ln] = off(0.031);
  rf.add(tilt(box(0.014, 0.012, pl - 0.06), a), "#8fa6c4", u, ly, ln);
  for (const k of [-1, 1]) {
    const shift = (k * (pl - 0.06)) / 6;
    rf.add(
      tilt(box(pw - 0.06, 0.012, 0.014), a),
      "#8fa6c4",
      u,
      ly + shift * Math.sin(a) * -1,
      ln + shift * Math.cos(a),
    );
  }
  for (const s of [-1, 1]) {
    rf.box(
      0.04,
      0.32,
      0.04,
      SLATE,
      u + s * (pw / 2 - 0.06),
      0.16,
      n - (pl / 2) * Math.cos(a) + 0.04,
    );
  }
}

/** Solar: Flachdach-Haus mit Panoramafenster, Holzlamellen, Solarpaneelen; Stufe 2 zweite Reihe, Stufe 3 Dachterrasse mit Aufbau. */
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
  const walls = wallFrames(b, w, d);
  const dark = "#3b4650";
  const wood = mix(wall, WOOD, 0.6);
  const glass = "#cfe8f0";
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  plinth(b, w, d, base, wall);
  corners(b, w, d, base + 0.14, base + h - 0.1, darken(wall, 0.92), 0, 0, 0.07);
  band(b, w, d, base + h - 0.05, 0.1, darken(wall, 0.9), 0.025);
  // Dachrand mit Abdeckung
  b.add({ geo: box(w + 0.1, 0.18, d + 0.1), color: roof, pos: [0, base + h + 0.09, 0] });
  b.add({
    geo: box(w + 0.16, 0.04, d + 0.16),
    color: mix(roof, "#ffffff", 0.3),
    pos: [0, base + h + 0.2, 0],
  });
  const rt = base + h + 0.22;
  const rf = new Frame(b, 0, rt, 0, 0);

  // Vorderseite: Panoramafenster links, Holzlamellen und Tür rechts
  const f = walls.front;
  const gw = w * 0.5;
  const gu = -w * 0.22;
  const gh = h * 0.42;
  const gv = base + h * 0.5;
  bigWindow(f, gu, gv, gw, gh, { frame: dark, glass, cols: 2, rows: 1, sill: accent });
  // Sonnenblende über dem Fenster
  f.box(gw + 0.3, 0.04, 0.4, accent, gu, gv + gh / 2 + 0.2, 0.22);
  for (const s of [-1, 1]) {
    f.add(
      tilt(box(0.03, 0.03, 0.34), -0.6),
      dark,
      gu + s * (gw / 2 + 0.05),
      gv + gh / 2 + 0.1,
      0.16,
    );
  }
  const du = w * 0.3;
  for (let i = 0; i < 8; i++) {
    f.box(0.065, h - 0.34, 0.024, wood, du - 0.38 + i * 0.108, base + 0.14 + (h - 0.34) / 2, 0.012);
  }
  doorAt(f, du, fp * 0.5, fp * 0.75, base, { leaf: accent, frame: dark, glass: true, steps: true });
  canopy(f, du, base + fp * 0.75 + 0.22, fp * 0.5 + 0.3, 0.45, accent, darken(accent, 0.7));
  // Seiten und Rückseite
  for (const s of [-1, 1]) {
    windowAt(walls.left, s * d * 0.28, base + h * 0.5, 0.24, h * 0.42, {
      frame: dark,
      bars: "none",
      sillColor: accent,
    });
  }
  windowAt(walls.right, d * 0.05, base + h * 0.5, 0.5, h * 0.4, {
    frame: dark,
    bars: "vertical",
    sillColor: accent,
  });
  windowAt(walls.back, 0, base + h * 0.58, w * 0.3, 0.26, {
    frame: dark,
    bars: "vertical",
    sillColor: accent,
  });

  // Solarpaneele (Stufe 1: eine Reihe vorn, Stufe 2: zwei Reihen); mit Stufe 3 auf dem Aufbau und rechts hinten
  const pw = w * 0.26;
  const pl = d * 0.28;
  if (tier < 3) {
    const rows = tier >= 2 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 3; i++) {
        solarPanel(rf, -w * 0.3 + i * w * 0.3, -d * 0.2 + r * d * 0.36, pw, pl);
      }
    }
  } else {
    // Aufbau hinten links mit eigenem Dach und Panelreihe; davor und rechts die Dachterrasse
    const aw = w * 0.6;
    const ad = d * 0.6;
    const ah = h * 0.7;
    const ax = -w * 0.15;
    const az = -d * 0.15;
    b.add({ geo: box(aw, ah, ad), color: wall, pos: [ax, rt + ah / 2, az] });
    b.add({ geo: box(aw + 0.1, 0.1, ad + 0.1), color: roof, pos: [ax, rt + ah + 0.05, az] });
    b.add({
      geo: box(aw + 0.16, 0.04, ad + 0.16),
      color: mix(roof, "#ffffff", 0.3),
      pos: [ax, rt + ah + 0.12, az],
    });
    band(b, aw, ad, rt + ah - 0.05, 0.08, darken(wall, 0.9), 0.02, ax, az);
    const af = new Frame(b, ax, rt, az + ad / 2, 0);
    bigWindow(af, -aw * 0.18, ah * 0.5, aw * 0.34, ah * 0.42, {
      frame: dark,
      glass,
      cols: 1,
      rows: 1,
      sill: accent,
    });
    doorAt(af, aw * 0.24, fp * 0.42, ah * 0.78, 0, { leaf: accent, frame: dark, glass: true });
    const ar = new Frame(b, ax, rt + ah + 0.14, az, 0);
    for (let i = 0; i < 3; i++)
      solarPanel(ar, -aw * 0.3 + i * aw * 0.3, -0.05, aw * 0.26, ad * 0.36);
    for (let i = 0; i < 2; i++)
      solarPanel(rf, w * 0.34, -d * 0.34 + i * d * 0.3, pw * 0.95, pl * 0.95);
    // Terrasse vorn: Holzdeck, Geländer an Front und rechter Seite, Pflanzkästen, Tisch mit Schirm
    const tz0 = az + ad / 2 + 0.06;
    const tz1 = d / 2 - 0.02;
    const tl = tz1 - tz0;
    rf.box(w - 0.1, 0.04, tl, "#a0703f", 0, 0.02, (tz0 + tz1) / 2);
    for (let i = 0; i < 5; i++) {
      rf.box(0.03, 0.006, tl, "#8a5a34", -w * 0.4 + i * w * 0.2, 0.043, (tz0 + tz1) / 2);
    }
    railing(rf, 0, w - 0.1, 0.04, tz1, dark);
    const side = new Frame(b, w / 2 - 0.05, rt, (tz0 + tz1) / 2, Math.PI / 2);
    railing(side, 0, tl, 0.04, 0, dark);
    for (const s of [-1, 1]) {
      rf.box(0.2 + 0.02, 0.2, 0.34, wood, s * w * 0.28, 0.14, tz0 + 0.3);
      for (let k = -1; k <= 1; k++) {
        rf.add(
          ico(0.07),
          k % 2 ? LEAF : darken(LEAF, 0.85),
          s * w * 0.28 + k * 0.08,
          0.3,
          tz0 + 0.3,
        );
      }
    }
    const tx = w * 0.14;
    const tzz = tz0 + tl * 0.6;
    rf.add(cyl(0.2, 0.2, 0.04, 8), "#e8dcc8", tx, 0.42, tzz);
    rf.add(cyl(0.025, 0.025, 0.4, 6), IRON, tx, 0.22, tzz);
    rf.add(cyl(0.025, 0.025, 0.9, 6), IRON, tx, 0.5, tzz);
    rf.add(new THREE.ConeGeometry(0.5, 0.2, 8), accent, tx, 0.98, tzz);
    for (const k of [-1, 1]) {
      rf.add(cyl(0.12, 0.12, 0.03, 8), wood, tx + k * 0.36, 0.26, tzz);
      rf.add(cyl(0.02, 0.02, 0.24, 6), IRON, tx + k * 0.36, 0.13, tzz);
    }
  }
  return b.build(base + h + 0.22 + (tier >= 3 ? h * 0.7 + 0.3 : 0.4));
}

/** Gesamthöhe der Stadthaus-Wand (Stufe 2 und 3 haben drei Geschosse). */
export const stadtWallHeight = (fp: number, tier: Tier) => fp * (tier >= 2 ? 2.3 : 1.8);

/**
 * Stadthaus: Walmdach mit Gesimsen, Säulenvorbau mit Balkon, Fensterreihen mit Sturz; Stufe 2 drei Geschosse,
 * Stufe 3 Gaube und Fahne.
 */
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
  const h = stadtWallHeight(fp, tier);
  const base = FLAT_BASE;
  const walls = wallFrames(b, w, d);
  const light = mix(wall, WHITE, 0.6);
  const cornice = darken(wall, 0.85);
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  plinth(b, w, d, base, wall);
  corners(b, w, d, base + 0.14, base + h, light, 0, 0, 0.13);
  // Geschosse: Erdgeschoss 1.0 fp hoch, darüber ein (Stufe 1) oder zwei Geschosse
  const g = fp * 1.0;
  const floors = tier >= 2 ? 3 : 2;
  const upper = (h - g) / (floors - 1);
  const y1 = base + g;
  for (let y = base + 0.3; y < y1 - 0.12; y += 0.17)
    band(b, w, d, y, 0.018, darken(wall, 0.92), 0.008);
  for (let k = 0; k < floors - 1; k++) band(b, w, d, y1 + k * upper, 0.08, cornice, 0.035);
  band(b, w, d, base + h - 0.1, 0.06, light, 0.03);
  b.add({ geo: box(w + 0.16, 0.12, d + 0.16), color: cornice, pos: [0, base + h, 0] });

  // Dach: Walmdach mit Kanten, Ziegelstufen, Traufblech, Kamin
  const y0 = base + h + 0.06;
  const rr = (w + 0.3) * 0.72;
  const rH = fp * 0.9;
  const hb = rr * Math.SQRT1_2;
  b.add({
    geo: new THREE.ConeGeometry(rr, rH, 4),
    color: roof,
    pos: [0, y0 + rH / 2, 0],
    rot: [0, Math.PI / 4, 0],
  });
  const trim = darken(roof, 0.74);
  b.add({ geo: box(hb * 2 + 0.05, 0.05, hb * 2 + 0.05), color: trim, pos: [0, y0 + 0.01, 0] });
  for (const t of [0.26, 0.5, 0.74]) {
    const s = hb * (1 - t) + 0.03;
    b.add({ geo: box(s * 2, 0.035, s * 2), color: darken(roof, 0.86), pos: [0, y0 + rH * t, 0] });
  }
  const ha = Math.atan2(rH, rr);
  for (let k = 0; k < 4; k++) {
    new Frame(b, 0, y0, 0, -Math.PI / 4 + (k * Math.PI) / 2).box(
      Math.hypot(rr, rH) + 0.04,
      0.06,
      0.06,
      trim,
      rr / 2,
      rH / 2 + 0.025,
      0,
      -ha,
    );
  }
  b.add({ geo: cyl(0.02, 0.03, 0.22, 6), color: IRON, pos: [0, y0 + rH + 0.08, 0] });
  b.add({ geo: ico(0.065), color: BRASS, pos: [0, y0 + rH + 0.22, 0] });
  // Kamin; Öffnung = chimneyTop() in index.ts
  chimney(b, fp * 0.36, -fp * 0.36, y0 + 0.2, y0 + rH + 0.12, fp * 0.22, "#a26a55");

  // Fassade: Erdgeschoss mit Tür, Säulenvorbau und Balkon darüber
  const f = walls.front;
  const doorH = fp * 0.85;
  doorAt(f, 0, fp * 0.5, doorH, base, { leaf: accent, frame: light, steps: true, glass: true });
  for (const s of [-1, 1]) {
    windowAt(f, s * fp * 0.64, base + fp * 0.52, fp * 0.3, fp * 0.42, { head: true, frame: light });
    f.add(cyl(0.065, 0.075, y1 - 0.3, 10), light, s * fp * 0.43, 0.1 + (y1 - 0.3) / 2, 0.38);
    f.box(0.17, 0.07, 0.17, STONE, s * fp * 0.43, 0.135, 0.38);
    f.box(0.15, 0.06, 0.15, STONE, s * fp * 0.43, y1 - 0.17, 0.38);
  }
  f.box(fp * 1.25, 0.1, 0.56, light, 0, y1 - 0.05, 0.3);
  f.box(fp * 1.25 + 0.04, 0.05, 0.03, cornice, 0, y1 - 0.12, 0.585);
  railing(f, 0, fp * 1.25 - 0.06, y1, 0.55, IRON);
  for (const s of [-1, 1]) {
    railing(new Frame(b, s * fp * 0.62, 0, walls.front.oz + 0.3, Math.PI / 2), 0, 0.5, y1, 0, IRON);
  }
  // Obergeschosse
  for (let k = 1; k < floors; k++) {
    const yb = y1 + (k - 1) * upper;
    const wh = Math.min(fp * 0.42, upper * 0.55);
    const vc = yb + upper * 0.52;
    for (const s of [-1, 1])
      windowAt(f, s * fp * 0.64, vc, fp * 0.3, wh, { head: true, frame: light });
    if (k === 1) {
      const dh = Math.min(fp * 0.55, upper * 0.72);
      windowAt(f, 0, yb + 0.07 + 0.045 + dh / 2, fp * 0.3, dh, {
        head: true,
        frame: light,
        bars: "vertical",
        sill: false,
      });
    } else {
      windowAt(f, 0, vc, fp * 0.3, wh, { head: true, frame: light });
    }
  }
  // Seiten und Rückseite: je ein Fenster pro Geschoss
  for (let k = 0; k < floors; k++) {
    const vc = k === 0 ? base + fp * 0.52 : y1 + (k - 1) * upper + upper * 0.52;
    const wh = k === 0 ? fp * 0.42 : Math.min(fp * 0.42, upper * 0.55);
    for (const wf of [walls.left, walls.right, walls.back]) {
      windowAt(wf, 0, vc, fp * 0.3, wh, { frame: light });
    }
  }

  if (tier >= 3) {
    // Gaube auf der Vorderseite des Daches mit Fenster und kleinem Giebeldach
    const zf = hb * 0.66;
    const dw = fp * 0.48;
    const dh = fp * 0.4;
    const dy = y0 + rH * 0.34 - 0.06;
    b.add({ geo: box(dw, dh, 0.62), color: wall, pos: [0, dy + dh / 2, zf - 0.31] });
    windowAt(new Frame(b, 0, dy, zf, 0), 0, dh * 0.5, dw * 0.46, dh * 0.5, { frame: light });
    gableRoof(new Frame(b, 0, dy + dh, zf - 0.31, 0), dw + 0.2, fp * 0.22, 0.74, roof, {
      trim,
      plate: wall,
    });
    // Fahne am Dachfirst statt Kugel
    b.add({ geo: cyl(0.025, 0.025, 1.0, 6), color: IRON, pos: [0, y0 + rH + 0.5, 0] });
    b.add({ geo: box(0.62, 0.34, 0.03), color: accent, pos: [0.34, y0 + rH + 0.88, 0] });
  }
  return b.build(base + h + fp * 0.9 + 0.06 + (tier >= 3 ? 0.45 : 0));
}

/** Atelier: Pultdach, Glasfront mit Oberlichtband und Dachfenstern, Holzlamellen hinten; Stufe 2 Markise mit Deck, Stufe 3 Anbau. */
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
  const walls = wallFrames(b, w, d);
  const frame = darken(accent, 0.72);
  const glass = "#d6ecf2";
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
  plinth(b, w, d, base, wall);
  // Dach: schräge Platte mit Stirnbrettern, Dachfenstern und Ofenrohr
  const slope = hf - hb;
  const alpha = Math.atan2(slope, d);
  const len = Math.hypot(d, slope) + 0.5;
  const ry = base + (hf + hb) / 2 + 0.06;
  const sa = Math.sin(alpha);
  const ca = Math.cos(alpha);
  b.add({
    geo: new THREE.BoxGeometry(w + 0.4, 0.1, len),
    color: roof,
    pos: [0, ry, 0],
    rot: [-alpha, 0, 0],
  });
  for (const s of [-1, 1]) {
    b.add({
      geo: tilt(box(w + 0.44, 0.16, 0.05), -alpha),
      color: darken(roof, 0.72),
      pos: [0, ry + s * sa * (len / 2) - 0.035, s * ca * (len / 2)],
    });
  }
  for (const s of [-1, 1]) {
    const dist = -len * 0.06;
    for (const [lift, geoW, geoL, c, isLit] of [
      [0.06, w * 0.22, 0.84, IRON, false],
      [0.074, w * 0.18, 0.74, glass, true],
    ] as const) {
      const g = tilt(box(geoW, 0.03, geoL), -alpha);
      const pos: [number, number, number] = [
        s * w * 0.25,
        ry + sa * dist + ca * lift,
        ca * dist - sa * lift,
      ];
      if (isLit) b.light({ geo: g, color: c, pos });
      else b.add({ geo: g, color: c, pos });
    }
  }
  // Ofenrohr: Öffnung = chimneyTop() in index.ts
  const px = 0;
  const pz = -d * 0.25;
  const ps = ry + (pz / ca) * sa + 0.055;
  const py1 = base + fp * 1.1 + 0.865;
  b.add({
    geo: cyl(0.07, 0.07, py1 - ps + 0.3, 8),
    color: "#6b6e73",
    pos: [px, (py1 + ps - 0.3) / 2, pz],
  });
  b.add({ geo: cyl(0.1, 0.1, 0.08, 8), color: IRON, pos: [px, ps + 0.04, pz] });
  b.add({ geo: cyl(0.09, 0.07, 0.07, 8), color: IRON, pos: [px, py1 - 0.035, pz] });
  b.add({ geo: cyl(0.05, 0.05, 0.012, 8), color: "#2c2926", pos: [px, py1 + 0.004, pz] });
  b.add({ geo: cyl(0.075, 0.075, 0.03, 8), color: SLATE, pos: [px, ps + 0.35, pz] });

  // Vorderseite: Atelierfenster, Oberlichtband, Tür
  const f = walls.front;
  bigWindow(f, -w * 0.16, base + hf * 0.43, w * 0.62, hf * 0.54, {
    frame,
    glass,
    cols: 4,
    rows: 1,
    sill: accent,
  });
  bigWindow(f, 0, base + hf * 0.87, w * 0.8, 0.15, { frame, glass, cols: 8 });
  const du = w * 0.34;
  doorAt(f, du, fp * 0.42, fp * 0.8, base, {
    leaf: accent,
    frame: darken(wall, 0.85),
    steps: true,
    glass: true,
  });
  // Seiten: ein Fenster; Rückseite: Holzlamellen mit Fenster
  windowAt(walls.left, fp * 0.62, base + fp * 0.85, fp * 0.34, fp * 0.5, {
    frame: darken(wall, 0.75),
    bars: "vertical",
  });
  windowAt(walls.right, -fp * 0.62, base + fp * 0.85, fp * 0.34, fp * 0.5, {
    frame: darken(wall, 0.75),
    bars: "vertical",
  });
  for (let i = 0; i < 12; i++) {
    walls.back.box(
      0.045,
      hb - 0.22,
      0.03,
      darken(wall, 0.82),
      -w / 2 + 0.12 + (i * (w - 0.24)) / 11,
      base + 0.14 + (hb - 0.22) / 2,
      0.015,
    );
  }
  windowAt(walls.back, 0, base + hb * 0.58, w * 0.22, 0.3, {
    frame: darken(wall, 0.75),
    bars: "vertical",
  });

  if (tier >= 2) {
    // Holzdeck mit gestreifter Markise, Staffelei und Farbeimern
    const cu = -w * 0.16;
    const cw = w * 0.62;
    f.box(cw, 0.14, 1.16, "#a0703f", cu, 0.07, 0.62);
    for (let i = 0; i < 5; i++) {
      f.box(
        cw / 5 - 0.012,
        0.012,
        1.16,
        i % 2 ? "#94643a" : "#b07d48",
        cu - cw / 2 + (cw / 5) * (i + 0.5),
        0.146,
        0.62,
      );
    }
    const va = base + hf * 0.8;
    const ta = 0.2;
    const strips = 7;
    for (let i = 0; i < strips; i++) {
      const c = i % 2 ? WHITE : accent;
      const uu = cu - cw / 2 + (cw / strips) * (i + 0.5);
      f.add(tilt(box(cw / strips - 0.004, 0.03, 1.0), ta), c, uu, va, 0.5);
      f.box(
        cw / strips - 0.004,
        0.14,
        0.025,
        c,
        uu,
        va - 0.5 * Math.sin(ta) - 0.06,
        0.5 * Math.cos(ta) + 0.5,
      );
    }
    for (const s of [-1, 1]) {
      f.add(
        cyl(0.03, 0.03, va - 0.5 * Math.sin(ta) - 0.16 - 0.14, 6),
        IRON,
        cu + s * (cw / 2 - 0.04),
        0.14 + (va - 0.5 * Math.sin(ta) - 0.3) / 2,
        0.97,
      );
    }
    // Staffelei, Hocker, Eimer
    const ex = cu + cw * 0.28;
    f.box(0.04, 0.95, 0.03, WOOD, ex - 0.14, 0.14 + 0.47, 0.62, 0.1);
    f.box(0.04, 0.95, 0.03, WOOD, ex + 0.14, 0.14 + 0.47, 0.62, -0.1);
    f.box(0.04, 0.9, 0.03, WOOD, ex, 0.14 + 0.45, 0.78, 0);
    f.box(0.46, 0.34, 0.03, WHITE, ex, 0.14 + 0.68, 0.585);
    f.box(0.4, 0.28, 0.01, "#9bb8d3", ex, 0.14 + 0.68, 0.6);
    f.box(0.3, 0.08, 0.03, "#ec4899", ex + 0.02, 0.14 + 0.72, 0.61);
    f.add(cyl(0.11, 0.11, 0.03, 8), WOOD, cu - cw * 0.3, 0.14 + 0.38, 0.62);
    f.add(cyl(0.02, 0.025, 0.36, 6), WOOD, cu - cw * 0.3, 0.14 + 0.18, 0.62);
    for (const [k, c] of [
      [0, accent],
      [1, "#ec4899"],
      [2, "#3b82f6"],
    ] as const) {
      f.add(cyl(0.06, 0.05, 0.1, 7), c, cu - cw * 0.12 + k * 0.14, 0.14 + 0.05, 0.9);
    }
  }

  if (tier >= 3) {
    // Anbau rechts: Atelier-Werkstatt mit Fenstern, Tür zur Seite und Flachdach
    const aw = fp * 0.9;
    const ah = hf * 0.9;
    const ad = fp * 1.0;
    const ax = w / 2 + fp * 0.45;
    const az = -d * 0.15;
    b.add({ geo: box(aw + 0.1, FLAT_BASE, ad + 0.1), color: STONE, pos: [ax, FLAT_BASE / 2, az] });
    b.add({ geo: box(aw, ah, ad), color: wall, pos: [ax, base + ah / 2, az] });
    plinth(b, aw, ad, base, wall, ax, az);
    b.add({ geo: box(aw + 0.1, 0.1, ad + 0.1), color: roof, pos: [ax, base + ah + 0.05, az] });
    b.add({
      geo: box(aw + 0.16, 0.04, ad + 0.16),
      color: mix(roof, "#ffffff", 0.25),
      pos: [ax, base + ah + 0.12, az],
    });
    const af = wallFrames(b, aw, ad, ax, az);
    bigWindow(af.front, -aw * 0.12, base + ah * 0.5, aw * 0.52, ah * 0.42, {
      frame,
      glass,
      cols: 2,
      rows: 1,
      sill: accent,
    });
    doorAt(af.right, 0, fp * 0.4, ah * 0.72, base, {
      leaf: accent,
      frame: darken(wall, 0.85),
      glass: true,
    });
    af.right.box(fp * 0.4 + 0.3, 0.1, 0.14, STONE, 0, 0.05, 0.07);
    windowAt(af.back, 0, base + ah * 0.52, aw * 0.4, ah * 0.36, {
      frame: darken(wall, 0.75),
      bars: "vertical",
    });
  }
  return b.build(base + hf + 0.4);
}

/** Haus mit rundem Turm: Kegelhelm mit Kranz, Fensterschlitze mit Spitzbogen, Giebeldach mit Kamin; Stufe 2 Zinnenkranz, Stufe 3 Wimpel. */
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
  const hx = -fp * 0.3;
  const walls = wallFrames(b, w, d, hx, 0);
  const stone = stoneFor(wall);
  slab(b, w + fp * 0.9, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [hx, base + h / 2, 0] });
  plinth(b, w, d, base, wall, hx, 0);
  corners(b, w, d, base + 0.14, base + h, darken(wall, 0.9), hx, 0, 0.1);
  band(b, w, d, base + h * 0.42, 0.06, darken(wall, 0.9), 0.02, hx, 0);

  // Giebeldach mit Füllung, Rinne, Schindelreihen; Kamin an der linken Dachseite
  const rw = w + 0.5;
  const rh = fp * 0.95;
  const rd = d + 0.5;
  gableRoof(new Frame(b, hx, base + h, 0, 0), rw, rh, rd, roof, {
    gutter: true,
    plate: darken(wall, 0.94),
    rows: 3,
  });
  roundWindow(new Frame(b, hx, base + h, rd / 2 + 0.024, 0), 0, 0.07 + rh * 0.36, fp * 0.12, WHITE);
  roundWindow(
    new Frame(b, hx, base + h, -rd / 2 - 0.024, Math.PI),
    0,
    0.07 + rh * 0.36,
    fp * 0.1,
    WHITE,
  );
  // Öffnung = chimneyTop() in index.ts
  chimney(b, -fp * 0.75, -fp * 0.57, base + h, base + h + fp * 1.15, fp * 0.22, "#9b958a");

  // Turm: Rundung, Sockel, Gürtel, Kranz unter dem Kegel, Fensterschlitze
  const tr = fp * 0.55;
  const th = h * (tier >= 2 ? 2.0 : 1.6);
  const tx = w / 2 + tr * 0.4 + hx;
  const tz = d * 0.15;
  b.add({ geo: cyl(tr, tr, th, 14), color: darken(wall, 0.95), pos: [tx, base + th / 2, tz] });
  b.add({ geo: cyl(tr + 0.06, tr + 0.07, 0.3, 14), color: stone, pos: [tx, base + 0.15, tz] });
  for (const t of [0.42, 0.72]) {
    b.add({ geo: cyl(tr + 0.03, tr + 0.03, 0.07, 14), color: stone, pos: [tx, base + th * t, tz] });
  }
  b.add({
    geo: cyl(tr + 0.12, tr + 0.03, 0.16, 14),
    color: stone,
    pos: [tx, base + th - 0.05, tz],
  });
  b.add({
    geo: new THREE.ConeGeometry(tr * 1.25, fp * 1.1, 14),
    color: roof,
    pos: [tx, base + th + fp * 0.55, tz],
  });
  b.add({ geo: cyl(0.02, 0.03, 0.3, 6), color: IRON, pos: [tx, base + th + fp * 1.1 + 0.08, tz] });
  b.add({ geo: ico(0.07), color: BRASS, pos: [tx, base + th + fp * 1.1 + 0.26, tz] });
  const slit = (theta: number, vv: number) =>
    windowAt(
      new Frame(
        b,
        tx + Math.sin(theta) * (tr - 0.005),
        0,
        tz + Math.cos(theta) * (tr - 0.005),
        theta,
      ),
      0,
      vv,
      0.15,
      fp * 0.32,
      { arched: true, bars: "vertical", sill: false, frame: stone },
    );
  for (let i = 0; i < 3; i++) slit(0, base + th * (0.26 + i * 0.22));
  slit(0.95, base + th * 0.5);
  slit(-0.95, base + th * 0.5);
  slit(1.7, base + th * 0.5);
  // Haus: Tür mit Rundbogen, zwei Fenster mit Läden
  const f = walls.front;
  doorAt(f, 0, fp * 0.5, fp * 0.8, base, {
    leaf: accent,
    frame: darken(wall, 0.8),
    arched: true,
    steps: true,
  });
  for (const s of [-1, 1]) {
    windowAt(f, s * fp * 0.62, base + h * 0.62, fp * 0.26, fp * 0.38, {
      shutter: accent,
      frame: WHITE,
      flowers: s > 0,
    });
  }
  windowAt(walls.left, 0, base + h * 0.6, fp * 0.28, fp * 0.38, { shutter: accent });
  windowAt(walls.back, -fp * 0.3, base + h * 0.6, fp * 0.28, fp * 0.38, { shutter: accent });
  windowAt(walls.back, fp * 0.45, base + h * 0.6, fp * 0.28, fp * 0.38, { shutter: accent });

  if (tier >= 2) {
    // Zinnenkranz (Wehrgang) um den Turm
    const py = base + th * 0.62;
    b.add({ geo: cyl(tr + 0.2, tr + 0.14, 0.09, 14), color: stone, pos: [tx, py, tz] });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      new Frame(
        b,
        tx + Math.sin(a) * (tr + 0.15),
        py + 0.045,
        tz + Math.cos(a) * (tr + 0.15),
        a,
      ).box(0.17, 0.2, 0.09, stone, 0, 0.1, 0);
    }
  }
  if (tier >= 3) {
    // Wimpel auf dem Turmhelm
    b.add({
      geo: cyl(0.025, 0.025, 0.9, 6),
      color: IRON,
      pos: [tx, base + th + fp * 1.1 + 0.62, tz],
    });
    b.add({
      geo: box(0.45, 0.28, 0.02),
      color: accent,
      pos: [tx + 0.24, base + th + fp * 1.1 + 0.92, tz],
    });
  }
  return b.build(base + th + fp * 1.1 + (tier >= 3 ? 0.3 : 0));
}

/**
 * Digital & Daten: Flachdach-Kubus mit Glasband um das Obergeschoss, Antenne mit Leuchtpunkt, Schüssel und
 * Serverkasten auf dem Dach. Stufe 2 Vordach in Akzentfarbe, Stufe 3 zweiter, versetzter Glaskubus.
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
  const walls = wallFrames(b, w, d);
  const dark = "#3b3a4f";
  const glass = "#cfe0ff";
  slab(b, w, d);
  b.add({ geo: box(w, h, d), color: wall, pos: [0, base + h / 2, 0] });
  plinth(b, w, d, base, wall);
  b.add({ geo: box(w + 0.1, 0.16, d + 0.1), color: roof, pos: [0, base + h + 0.08, 0] });
  b.add({
    geo: box(w + 0.15, 0.035, d + 0.15),
    color: mix(roof, "#ffffff", 0.25),
    pos: [0, base + h + 0.175, 0],
  });
  // feine Plattenfugen im Erdgeschoss
  for (let y = base + 0.4; y < base + h * 0.54; y += 0.3)
    band(b, w, d, y, 0.015, darken(wall, 0.9), 0.008);

  // Glasband um das Obergeschoss (alle vier Seiten), Rahmen in Akzentfarbe, senkrechte Pfosten
  const by = base + h * 0.7;
  const bh = h * 0.2;
  const glassBand = (fr: Frame, len: number, cols: number) => {
    fr.litBox(len, bh, 0.05, glass, 0, by, 0.025);
    fr.box(len + 0.1, 0.06, 0.1, accent, 0, by + bh / 2 + 0.04, 0.05);
    fr.box(len + 0.1, 0.06, 0.1, accent, 0, by - bh / 2 - 0.04, 0.05);
    for (let i = 0; i <= cols; i++)
      fr.box(0.04, bh + 0.02, 0.07, dark, -len / 2 + (len * i) / cols, by, 0.04);
  };
  glassBand(walls.front, w * 0.9, 6);
  glassBand(walls.back, w * 0.9, 6);
  glassBand(walls.left, d * 0.9, 5);
  glassBand(walls.right, d * 0.9, 5);
  const f = walls.front;
  doorAt(f, -w * 0.28, fp * 0.5, fp * 0.75, base, {
    leaf: darken(accent, 0.85),
    frame: dark,
    glass: true,
    steps: true,
  });
  windowAt(f, w * 0.2, base + h * 0.36, fp * 0.5, fp * 0.34, {
    frame: dark,
    bars: "vertical",
    sill: true,
    sillColor: accent,
  });
  for (const s of [-1, 1])
    windowAt(walls.left, s * d * 0.25, base + h * 0.36, 0.3, 0.3, { frame: dark, bars: "none" });
  windowAt(walls.right, 0, base + h * 0.36, 0.3, 0.3, { frame: dark, bars: "none" });
  windowAt(walls.back, 0, base + h * 0.36, 0.5, 0.3, { frame: dark, bars: "vertical" });

  // Dach: Antenne mit Querstreben, Schüssel und Leuchtpunkt; Serverkasten mit Lüftern
  const rt = base + h + 0.19;
  const ax = w * 0.3;
  const az = -d * 0.2;
  b.add({ geo: cyl(0.025, 0.04, fp * 1.3, 6), color: SLATE, pos: [ax, rt + fp * 0.65, az] });
  for (const [t, wd] of [
    [0.45, 0.34],
    [0.7, 0.26],
    [0.9, 0.18],
  ] as const) {
    b.add({ geo: box(wd, 0.025, 0.025), color: SLATE, pos: [ax, rt + fp * 1.3 * t, az] });
  }
  b.add({
    geo: cyl(0.16, 0.03, 0.06, 10),
    color: "#e8e8ee",
    pos: [ax - 0.26, rt + fp * 0.9, az + 0.05],
    rot: [Math.PI / 2 - 0.5, 0, 0],
  });
  b.add({
    geo: cyl(0.015, 0.015, 0.14, 5),
    color: SLATE,
    pos: [ax - 0.26, rt + fp * 0.9 + 0.03, az + 0.13],
    rot: [Math.PI / 2 - 0.5, 0, 0],
  });
  b.add({ geo: box(0.26, 0.03, 0.03), color: SLATE, pos: [ax - 0.13, rt + fp * 0.9, az] });
  b.light({ geo: ico(0.055), color: accent, pos: [ax, rt + fp * 1.3 + 0.03, az] });
  const sx = -w * 0.22;
  const sz = -d * 0.18;
  const sbw = w * 0.34;
  const sbh = fp * 0.38;
  const sbd = d * 0.3;
  b.add({ geo: box(sbw, sbh, sbd), color: "#5b5870", pos: [sx, rt + sbh / 2, sz] });
  b.add({ geo: box(sbw + 0.04, 0.04, sbd + 0.04), color: dark, pos: [sx, rt + sbh + 0.01, sz] });
  for (let i = 0; i < 5; i++) {
    b.add({
      geo: box(sbw * 0.8, 0.018, 0.012),
      color: "#3d3b52",
      pos: [sx, rt + sbh * (0.2 + i * 0.1), sz + sbd / 2 + 0.006],
    });
  }
  b.light({
    geo: box(sbw * 0.26, 0.04, 0.02),
    color: accent,
    pos: [sx, rt + sbh * 0.78, sz + sbd / 2 + 0.012],
  });
  for (const s of [-1, 1]) {
    b.add({
      geo: cyl(0.1, 0.1, 0.05, 8),
      color: "#2f2d42",
      pos: [sx + s * sbw * 0.26, rt + sbh + 0.05, sz],
    });
  }

  if (tier >= 2) {
    // Vordach in Akzentfarbe mit Leuchtleiste, zwei schlanke Stützen, Pflanzkästen
    const cx = -w * 0.1;
    const cw = w * 0.7;
    const cy = base + fp * 1.05;
    f.add(tilt(box(cw, 0.07, 1.0), 0.1), accent, cx, cy, 0.5);
    f.lit(box(cw - 0.1, 0.03, 0.03), "#ffffff", cx, cy - 0.12, 0.96);
    for (const s of [-1, 1]) {
      f.add(
        cyl(0.04, 0.04, cy - 0.1 - 0.12, 8),
        WHITE,
        cx + s * (cw / 2 - 0.08),
        0.1 + (cy - 0.22) / 2,
        0.95,
      );
      f.box(0.14, 0.04, 0.14, SLATE, cx + s * (cw / 2 - 0.08), 0.12, 0.95);
    }
    // Pflanzkasten rechts neben der Tür, Ladesäule links
    const du = -w * 0.28;
    f.box(0.4, 0.2, 0.2, dark, du + 0.62, 0.1 + 0.1, 0.4);
    for (let k = -1; k <= 1; k++)
      f.add(ico(0.075), k % 2 ? LEAF : darken(LEAF, 0.85), du + 0.62 + k * 0.1, 0.4, 0.4);
    f.box(0.12, 0.8, 0.12, "#e8e8ee", du - 0.55, 0.1 + 0.4, 0.4);
    f.litBox(0.07, 0.12, 0.02, accent, du - 0.55, 0.1 + 0.62, 0.465);
  }
  if (tier >= 3) {
    // Zweiter Kubus rechts: Glasband, Dachkante, Kühlgeräte
    const cxw = w / 2 + fp * 0.55;
    const ah = h * 0.78;
    const aw = fp * 1.1;
    const ad = fp * 1.2;
    const az2 = -d * 0.2;
    b.add({
      geo: box(aw + 0.1, FLAT_BASE, ad + 0.1),
      color: STONE,
      pos: [cxw, FLAT_BASE / 2, az2],
    });
    b.add({ geo: box(aw, ah, ad), color: wall, pos: [cxw, base + ah / 2, az2] });
    plinth(b, aw, ad, base, wall, cxw, az2);
    b.add({ geo: box(aw + 0.1, 0.14, ad + 0.1), color: roof, pos: [cxw, base + ah + 0.07, az2] });
    b.add({
      geo: box(aw + 0.15, 0.035, ad + 0.15),
      color: mix(roof, "#ffffff", 0.25),
      pos: [cxw, base + ah + 0.155, az2],
    });
    const af = wallFrames(b, aw, ad, cxw, az2);
    const abh = ah * 0.24;
    const aby = base + ah * 0.62;
    for (const fr of [af.front, af.right, af.back]) {
      const len = (fr === af.right ? ad : aw) * 0.84;
      fr.litBox(len, abh, 0.05, glass, 0, aby, 0.025);
      fr.box(len + 0.1, 0.05, 0.1, accent, 0, aby + abh / 2 + 0.03, 0.05);
      fr.box(len + 0.1, 0.05, 0.1, accent, 0, aby - abh / 2 - 0.03, 0.05);
      for (let i = 0; i <= 4; i++)
        fr.box(0.035, abh + 0.02, 0.07, dark, -len / 2 + (len * i) / 4, aby, 0.04);
    }
    for (const s of [-1, 1]) {
      b.add({
        geo: box(0.4, 0.22, 0.4),
        color: "#8b9198",
        pos: [cxw + s * aw * 0.22, base + ah + 0.28, az2],
      });
      b.add({
        geo: cyl(0.14, 0.14, 0.03, 8),
        color: "#2f2d42",
        pos: [cxw + s * aw * 0.22, base + ah + 0.405, az2],
      });
    }
  }
  return b.build(base + h + fp * 1.3);
}

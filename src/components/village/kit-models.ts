import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import type { Anbau, Garten } from "@/lib/world/doc";
import type { Palette } from "@/lib/world/map";
import { box, cyl, gable, type Part } from "./geo";
import { at, between, bounds, fruitColors, restOn, rock, sit, type V3 } from "./model-helpers";
import { darken, mix, orient, STONE, WOOD } from "./models/common";

const topOf = (p: Part) => bounds(p).max.y;

/**
 * Bausatz-Modelle für ein Grundstück: Anbauten (Laube, Schuppen, Wintergarten) neben dem Haus und
 * Gartenstil-Felder (Blumen, Gemüse, Stein, Obst), prozedural aus Grundformen. Lokal um den Ursprung, die Front
 * zeigt nach +z, der Boden liegt bei y = 0, nichts reicht darunter. Alles bleibt innerhalb der Masse unten.
 * Ziel: Anbau unter 1600 Dreiecken, Garten-Feld unter 1200.
 */

/** Grundfläche (Halbbreite, Halbtiefe) und Höhe eines Anbaus in Metern. */
export const ANBAU_MASSE = { hw: 0.6, hd: 0.8, h: 2.3 } as const;
/** Grundfläche (Halbbreite, Halbtiefe) und Höhe eines Gartenstil-Felds in Metern. */
export const GARTEN_MASSE = { hw: 0.55, hd: 0.9, h: 2.4 } as const;

export type KitFarben = { wall: string; roof: string; accent: string };

type Built = { body: Part[]; glow?: Part[] };

const WOOD_LIGHT = "#b5855a";
const WOOD_DARK = "#4a3424";
const TRUNK = "#6b4423";
const IRON = "#2f2f35";
const ZINC = "#9aa3a8";
const SOIL = "#5a4030";
const TERRACOTTA = "#c4693f";
const WATER = "#6aaed6";
const GLASS = "#cfe6ef";
const GLASS_DEEP = "#bcdbe8";
const GLASS_SHINE = "#eef8fb";
const VINE_STEM = "#4a6b3a";
const GREENS = ["#4f9a3f", "#62ad4a", "#74b956", "#58a04b"];

const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
/** Zylinder ohne Deckel und Boden: Reifen und Bänder, die nur von aussen gesehen werden. */
const ring = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg, 1, true);

const E = new THREE.Euler();
const Q = new THREE.Quaternion();
/** Drehung «erst nach vorn neigen (pitch, positiv = Spitze nach unten), dann um Y drehen (yaw)» als `Part.rot`. */
function pose(yaw: number, pitch = 0, roll = 0): V3 {
  Q.setFromEuler(E.set(pitch, yaw, roll, "YXZ"));
  E.setFromQuaternion(Q, "XYZ");
  return [E.x, E.y, E.z];
}

/** Blatt: flache Raute (Oktaeder, 8 Dreiecke), Länge 2·r entlang der Blickrichtung `yaw`, Spitze neigt sich um `pitch`. */
function leaf(pos: V3, r: number, color: string, yaw: number, pitch = 0.35): Part {
  return {
    geo: new THREE.OctahedronGeometry(1, 0),
    color,
    pos,
    rot: pose(yaw, pitch),
    scale: [r * 0.5, r * 0.18, r],
  };
}

/** Kleine Blüte (Ikosaeder ohne Unterteilung, 20 Dreiecke). */
const bloom = (pos: V3, r: number, color: string): Part => ({ geo: ico(r), color, pos });
/** Winzige Blüte als Oktaeder (8 Dreiecke) für Stellen mit vielen Blüten. */
const bud = (pos: V3, r: number, color: string): Part => ({
  geo: new THREE.OctahedronGeometry(r, 0),
  color,
  pos,
});

/** Grashalm: Kegel von `base` zur Spitze `tip`. */
const blade = (base: V3, tip: V3, w: number, color: string): Part =>
  between(base, tip, w, 0, color, 4);

/** Regentonne (Daubenfass): Bauch aus zwei Kegelstümpfen, drei Eisenreifen, Wasserfläche oben. Höhe 0.5, Radius 0.2. */
function barrel(x: number, z: number): Part[] {
  const R1 = 0.165;
  const R2 = 0.2;
  const hoopR = (y: number) => R1 + (R2 - R1) * (1 - Math.abs(y - 0.25) / 0.25) + 0.006;
  const parts: Part[] = [
    { geo: cyl(R2, R1, 0.25, 8), color: WOOD_LIGHT, pos: [x, 0.125, z] },
    { geo: cyl(R1, R2, 0.25, 8), color: darken(WOOD_LIGHT, 0.93), pos: [x, 0.375, z] },
    { geo: cyl(0.145, 0.145, 0.01, 8), color: WATER, pos: [x, 0.503, z] },
  ];
  for (const y of [0.07, 0.25, 0.43]) {
    parts.push({ geo: ring(hoopR(y), 0.028), color: IRON, pos: [x, y, z] });
  }
  return parts;
}

/**
 * Kletterpflanze: Blätter und Blüten in einer Schraube um die senkrechte Achse (cx, cz) von y0 bis y1.
 * Der Radius der Schraube liegt knapp ausserhalb eines Pfostens von 9 cm.
 */
function climber(
  body: Part[],
  [cx, cz]: [number, number],
  [y0, y1]: [number, number],
  a0: number,
  turns: number,
  flowers: string[],
  rnd: () => number,
) {
  const R = 0.062;
  const n = 10;
  let prev: V3 | null = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * turns * Math.PI * 2;
    const y = y0 + (y1 - y0) * t;
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const p: V3 = [cx + ox * R, y, cz + oz * R];
    if (prev) body.push(between(prev, p, 0.011, 0.011, VINE_STEM, 3));
    prev = p;
    const yaw = Math.atan2(ox, oz);
    body.push(
      leaf([cx + ox * (R + 0.02), y + 0.015, cz + oz * (R + 0.02)], 0.056, at(GREENS, i), yaw),
    );
    if (i % 2 === 1) {
      const a2 = a + 1.9;
      const o2x = Math.cos(a2);
      const o2z = Math.sin(a2);
      body.push(
        leaf(
          [cx + o2x * (R + 0.02), y - 0.05, cz + o2z * (R + 0.02)],
          0.05,
          at(GREENS, i + 2),
          Math.atan2(o2x, o2z),
        ),
      );
    }
    if (i % 3 === 1) {
      body.push(
        bloom(
          [cx + ox * (R + 0.03), y - 0.035, cz + oz * (R + 0.03)],
          0.026 + rnd() * 0.008,
          at(flowers, i),
        ),
      );
    }
  }
}

/**
 * Laube: Holzpergola mit Lattendach, zwei berankten Pfosten, Bank mit Kissen und einem Blumenampel.
 * Bewusst offen, damit man die Bank sieht.
 */
function laube(c: KitFarben, rnd: () => number): Built {
  const body: Part[] = [];
  const PX = 0.42;
  const PZ = 0.65;
  const POST_TOP = 2.02;
  const flowers = [c.accent, "#f9a8d4", "#fde68a"];

  // Terrasse aus fünf Bohlen und Steinsockel unter den Pfosten
  for (let i = 0; i < 5; i++) {
    body.push({
      geo: box(0.226, 0.05, 1.56),
      color: darken(WOOD_LIGHT, i % 2 ? 0.9 : 1),
      pos: [-0.464 + i * 0.232, 0.025, 0],
    });
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.push({ geo: box(0.14, 0.08, 0.14), color: STONE, pos: [sx * PX, 0.09, sz * PZ] });
      body.push({
        geo: box(0.09, POST_TOP - 0.13, 0.09),
        color: WOOD,
        pos: [sx * PX, (POST_TOP + 0.13) / 2, sz * PZ],
      });
    }
    // Pfetten oben auf den Pfosten
    body.push({ geo: box(0.085, 0.09, 1.56), color: WOOD, pos: [sx * PX, POST_TOP + 0.045, 0] });
  }
  // Lattendach: Querlatten, darüber drei Längslatten (Gitter)
  for (const z of [-0.64, -0.32, 0, 0.32, 0.64]) {
    body.push({ geo: box(1.16, 0.04, 0.07), color: WOOD_LIGHT, pos: [0, 2.13, z] });
  }
  for (const x of [-0.21, 0, 0.21]) {
    body.push({ geo: box(0.035, 0.03, 1.5), color: darken(WOOD_LIGHT, 0.85), pos: [x, 2.165, 0] });
  }

  // Bank an der Rückseite: Sitz, Seitenwangen, Lehne aus zwei Latten, Kissen
  body.push({ geo: box(0.7, 0.04, 0.26), color: WOOD_LIGHT, pos: [0, 0.46, -0.48] });
  for (const s of [-1, 1]) {
    body.push({ geo: box(0.04, 0.39, 0.24), color: WOOD, pos: [s * 0.31, 0.245, -0.48] });
    body.push({ geo: box(0.04, 0.42, 0.04), color: WOOD, pos: [s * 0.33, 0.69, -0.6] });
  }
  for (const y of [0.6, 0.75]) {
    body.push({ geo: box(0.7, 0.07, 0.025), color: WOOD_LIGHT, pos: [0, y, -0.6] });
  }
  body.push({ geo: box(0.5, 0.05, 0.2), color: c.accent, pos: [0, 0.505, -0.47] });
  body.push({
    geo: box(0.2, 0.2, 0.06),
    color: mix(c.roof, "#ffffff", 0.3),
    pos: [0.18, 0.62, -0.55],
    rot: [-0.2, 0, 0.3],
  });

  // Ranken an den beiden vorderen Pfosten, dazu ein paar Blätter und Blüten auf dem Dach
  climber(body, [-PX, PZ], [0.14, 1.98], 0.6, 1.8, flowers, rnd);
  climber(body, [PX, PZ], [0.14, 1.9], 3.3, 1.5, flowers.slice().reverse(), rnd);
  for (let i = 0; i < 7; i++) {
    const x = -0.42 + i * 0.14;
    const z = 0.64 + (i % 2 ? -0.05 : 0.05);
    body.push(leaf([x, 2.2, z], 0.06, at(GREENS, i), rnd() * 6.3, 0.15));
    if (i % 3 === 1) body.push(bloom([x, 2.215, z + 0.03], 0.03, at(flowers, i)));
  }

  // Blumenampel an der mittleren Querlatte
  for (const s of [-1, 1]) {
    body.push(between([s * 0.05, 2.11, 0.32], [s * 0.07, 1.68, 0.32], 0.006, 0.006, "#d9c9a0", 3));
  }
  body.push({ geo: cyl(0.1, 0.06, 0.1, 6), color: TERRACOTTA, pos: [0, 1.62, 0.32] });
  body.push({
    geo: ico(0.1),
    color: GREENS[1],
    pos: [0, 1.7, 0.32],
    scale: [1, 0.7, 1],
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    body.push(
      bloom([Math.sin(a) * 0.075, 1.735, 0.32 + Math.cos(a) * 0.075], 0.032, at(flowers, i)),
    );
    if (i % 2 === 0) {
      body.push(
        leaf([Math.sin(a) * 0.1, 1.675, 0.32 + Math.cos(a) * 0.1], 0.07, GREENS[0], a, 0.2),
      );
    }
  }
  return { body };
}

/**
 * Geräteschuppen: Holzverschalung aus senkrechten Brettern (auch an den Seiten, deren Höhe dem Pultdach folgt),
 * Dach nach vorn geneigt mit Schindelreihen, Rinne und Fallrohr in die Regentonne, Tür mit Klinke,
 * Fensterchen mit Blumenkasten, Rechen und Spaten an der Wand.
 */
function schuppen(c: KitFarben): Built {
  const body: Part[] = [];
  const HX = 0.5;
  const zF = 0.2;
  const zB = -0.76;
  const y0 = 0.07;
  const hF = 1.5;
  const hB = 2.0;
  const tan = (hB - hF) / (zF - zB);
  const a = Math.atan(tan);
  /** Höhe der Wandoberkante bei z (folgt der Dachneigung). */
  const topAt = (z: number) => hF + (zF - z) * tan;
  const wallA = c.wall;
  const wallB = darken(c.wall, 0.9);

  body.push({
    geo: box(2 * HX + 0.04, y0, zF - zB + 0.04),
    color: darken(STONE, 0.95),
    pos: [0, y0 / 2, (zF + zB) / 2],
  });
  // Vorder- und Rückwand: acht Bretter, abwechselnd zwei Töne
  for (const z of [zF - 0.02, zB + 0.02]) {
    const h = topAt(z) - y0;
    for (let i = 0; i < 8; i++) {
      body.push({
        geo: box((2 * HX) / 8, h, 0.04),
        color: i % 2 ? wallB : wallA,
        pos: [-HX + (i + 0.5) * ((2 * HX) / 8), y0 + h / 2, z],
      });
    }
  }
  // Seitenwände: Bretter in z-Richtung, jedes so hoch wie die Dachlinie an seiner Stelle
  const wSide = (zF - zB - 0.08) / 8;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const z = zB + 0.04 + (i + 0.5) * wSide;
      const h = topAt(z) - y0;
      body.push({
        geo: box(0.04, h, wSide),
        color: i % 2 ? wallB : wallA,
        pos: [sx * (HX - 0.02), y0 + h / 2, z],
      });
    }
  }

  // Pultdach: Platte nach vorn geneigt, Mitte (cz) und Länge so, dass die Ecken bei zBack und zFront enden
  const zFront = zF + 0.08;
  const zBack = zB - 0.02;
  const cz = (zFront + zBack) / 2;
  const L = (2 * (zFront - cz - 0.03 * Math.sin(a))) / Math.cos(a);
  const cy = topAt(cz) + 0.03 / Math.cos(a);
  /** Punkt auf dem Dach: `s` entlang der Neigung (vorn positiv), `n` senkrecht dazu (oben positiv). */
  const onRoof = (s: number, n: number): V3 => [
    0,
    cy - Math.sin(a) * s + Math.cos(a) * n,
    cz + Math.cos(a) * s + Math.sin(a) * n,
  ];
  const roof = c.roof;
  body.push({ geo: box(1.16, 0.06, L), color: roof, pos: onRoof(0, 0), rot: [a, 0, 0] });
  for (const s of [-0.45, -0.27, -0.09, 0.09, 0.27, 0.45]) {
    body.push({
      geo: box(1.16, 0.012, 0.035),
      color: darken(roof, 0.86),
      pos: onRoof(s, 0.036),
      rot: [a, 0, 0],
    });
  }
  body.push({
    geo: box(1.16, 0.075, 0.025),
    color: darken(roof, 0.78),
    pos: onRoof(L / 2 - 0.0125, -0.012),
    rot: [a, 0, 0],
  });
  // Regenrinne unter der Dachkante und Fallrohr hinunter zur Tonne
  body.push({
    geo: box(1.1, 0.045, 0.05),
    color: ZINC,
    pos: onRoof(L / 2 - 0.035, -0.07),
    rot: [a, 0, 0],
  });
  body.push({ geo: cyl(0.022, 0.022, 0.82, 6), color: ZINC, pos: [0.5, 1.03, 0.25] });
  body.push(between([0.5, 0.62, 0.25], [0.4, 0.58, 0.4], 0.022, 0.022, ZINC, 6));

  // Tür (links der Mitte): Rahmen, Brettertür in Akzentfarbe mit Fugen, Eisenbänder und Klinke
  const dx = -0.1;
  const dw = 0.34;
  const dh = 1.06;
  const zT = zF + 0.015;
  const frame = darken(c.wall, 0.7);
  for (const s of [-1, 1]) {
    body.push({
      geo: box(0.045, dh + 0.06, 0.03),
      color: frame,
      pos: [dx + s * (dw / 2 + 0.0225), y0 + (dh + 0.06) / 2, zT],
    });
  }
  body.push({ geo: box(dw + 0.09, 0.05, 0.03), color: frame, pos: [dx, y0 + dh + 0.035, zT] });
  body.push({ geo: box(dw, dh, 0.03), color: c.accent, pos: [dx, y0 + dh / 2, zT + 0.006] });
  for (const s of [-1, 1]) {
    body.push({
      geo: box(0.01, dh - 0.04, 0.034),
      color: darken(c.accent, 0.78),
      pos: [dx + s * 0.058, y0 + dh / 2, zT + 0.006],
    });
  }
  for (const y of [0.3, 0.86]) {
    body.push({ geo: box(dw, 0.045, 0.036), color: IRON, pos: [dx, y, zT + 0.006] });
  }
  body.push({ geo: box(0.04, 0.11, 0.012), color: IRON, pos: [dx + 0.125, 0.58, zT + 0.027] });
  body.push({ geo: box(0.085, 0.02, 0.02), color: IRON, pos: [dx + 0.09, 0.58, zT + 0.038] });

  // Fensterchen rechts der Tür mit Kreuzsprosse und Blumenkasten
  const wx = 0.3;
  const wy = 1.02;
  body.push({ geo: box(0.31, 0.31, 0.03), color: "#f6f3ec", pos: [wx, wy, zF + 0.015] });
  body.push({ geo: box(0.23, 0.23, 0.036), color: "#8fc3da", pos: [wx, wy, zF + 0.015] });
  body.push({ geo: box(0.23, 0.026, 0.042), color: "#f6f3ec", pos: [wx, wy, zF + 0.015] });
  body.push({ geo: box(0.026, 0.23, 0.042), color: "#f6f3ec", pos: [wx, wy, zF + 0.015] });
  body.push({ geo: box(0.33, 0.08, 0.12), color: WOOD, pos: [wx, 0.8, zF + 0.06] });
  const kasten = [c.accent, "#f9a8d4", "#fde047", c.accent];
  for (let i = 0; i < 4; i++) {
    body.push(bloom([wx - 0.11 + i * 0.073, 0.88, zF + 0.065], 0.034, at(kasten, i)));
  }
  body.push({
    geo: ico(0.05),
    color: GREENS[1],
    pos: [wx, 0.86, zF + 0.06],
    scale: [3, 0.55, 1],
  });

  // Regentonne unter dem Fallrohr
  body.push(...barrel(0.34, 0.52));

  // Rechen und Spaten lehnen links neben der Tür an der Wand
  body.push(between([-0.36, 0.03, 0.43], [-0.36, 1.22, 0.235], 0.014, 0.014, WOOD, 4));
  body.push(sit({ geo: box(0.2, 0.025, 0.045), color: IRON, pos: [-0.36, 0.02, 0.44] }));
  body.push(between([-0.43, 0.2, 0.385], [-0.43, 1.32, 0.235], 0.014, 0.014, WOOD, 4));
  body.push(
    sit({ geo: box(0.11, 0.2, 0.014), color: ZINC, pos: [-0.43, 0.1, 0.395], rot: [-0.15, 0, 0] }),
  );
  body.push({ geo: box(0.08, 0.022, 0.022), color: WOOD_DARK, pos: [-0.43, 1.31, 0.24] });
  return { body };
}

/**
 * Wintergarten: Glashaus mit schlankem Rahmen in der Wandfarbe, Sockel, Glasflächen in hellem Blau,
 * Satteldach aus Glas mit Sparren und Firstkappe in der Dachfarbe. Die beiden Türflügel stehen offen,
 * damit man hineinsieht: zwei Topfpflanzen, Fussboden und eine kleine Lampe (glow) unter dem Sturz.
 */
function wintergarten(c: KitFarben, rnd: () => number): Built {
  const body: Part[] = [];
  const glow: Part[] = [];
  const X = 0.5;
  const zB = -0.74;
  const zF = 0.5;
  const zM = (zF + zB) / 2;
  const D = zF - zB;
  const bay = D / 3;
  const PL = 0.26;
  const EH = 1.58;
  const RH = 2.04;
  const frame = c.wall;
  const sockel = mix(STONE, c.wall, 0.35);
  const eaveY = EH + 0.03;
  const ang = Math.atan2(RH - eaveY, X);
  const slope = Math.hypot(RH - eaveY, X);

  // Sockel rund herum (vorn mit Lücke für die Tür), Türstufe und Fussboden innen
  body.push({ geo: box(0.08, PL, D + 0.08), color: sockel, pos: [-X, PL / 2, zM] });
  body.push({ geo: box(0.08, PL, D + 0.08), color: sockel, pos: [X, PL / 2, zM] });
  body.push({ geo: box(2 * X + 0.08, PL, 0.08), color: sockel, pos: [0, PL / 2, zB] });
  for (const s of [-1, 1]) {
    body.push({ geo: box(0.28, PL, 0.08), color: sockel, pos: [s * 0.4, PL / 2, zF] });
  }
  body.push({ geo: box(0.52, 0.04, 0.14), color: STONE, pos: [0, 0.02, zF + 0.04] });
  body.push({ geo: box(0.98, 0.03, D - 0.08), color: "#d3c2a4", pos: [0, 0.015, zM] });

  // Pfosten: Ecken, Mittelpfosten der Seiten und Rückwand, Türpfosten
  const postH = EH - PL;
  const postY = (EH + PL) / 2;
  for (const sx of [-1, 1]) {
    for (const z of [zB, zB + bay, zB + 2 * bay, zF]) {
      body.push({ geo: box(0.055, postH, 0.055), color: frame, pos: [sx * X, postY, z] });
    }
    body.push({ geo: box(0.05, EH, 0.05), color: frame, pos: [sx * 0.26, EH / 2, zF] });
    // Traufbalken (Seiten) und Sprossenband in halber Höhe
    body.push({ geo: box(0.06, 0.06, D + 0.06), color: frame, pos: [sx * X, eaveY, zM] });
    body.push({ geo: box(0.035, 0.03, D), color: frame, pos: [sx * X, 0.98, zM] });
    body.push({ geo: box(0.2, 0.03, 0.035), color: frame, pos: [sx * 0.39, 0.98, zF] });
  }
  body.push({ geo: box(0.05, postH, 0.05), color: frame, pos: [0, postY, zB] });
  for (const z of [zB, zF]) {
    body.push({ geo: box(2 * X + 0.06, 0.06, 0.06), color: frame, pos: [0, eaveY, z] });
  }
  body.push({ geo: box(2 * X, 0.03, 0.035), color: frame, pos: [0, 0.98, zB] });

  // Glasflächen der Wände (Vertex-Farbe hellblau), dazu je ein Lichtstreifen auf einzelnen Scheiben
  const gH = EH - PL - 0.02;
  const gY = (EH + PL) / 2 - 0.01;
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const z = zB + bay * (k + 0.5);
      body.push({
        geo: box(0.016, gH, bay - 0.07),
        color: (k + (sx > 0 ? 1 : 0)) % 2 ? GLASS_DEEP : GLASS,
        pos: [sx * X, gY, z],
      });
      if (k !== 1) {
        body.push({
          geo: box(0.02, 0.42, 0.028),
          color: GLASS_SHINE,
          pos: [sx * X, gY + 0.1, z + (sx > 0 ? 0.02 : -0.02)],
          rot: [0.55 * sx, 0, 0],
        });
      }
    }
    body.push({
      geo: box(0.2, gH, 0.016),
      color: GLASS,
      pos: [sx * 0.39, gY, zF],
    });
  }
  for (const sx of [-1, 1]) {
    body.push({
      geo: box(X - 0.05, gH, 0.016),
      color: sx > 0 ? GLASS : GLASS_DEEP,
      pos: [sx * (X / 2), gY, zB],
    });
  }
  body.push({
    geo: box(0.028, 0.42, 0.02),
    color: GLASS_SHINE,
    pos: [-0.25, gY + 0.1, zB + 0.02],
    rot: [0, 0, 0.55],
  });

  // Dach: Sparren, Glasscheiben, First mit Kappe in der Dachfarbe, Firstspitze vorn
  const mid = (eaveY + RH) / 2;
  for (const sx of [-1, 1]) {
    for (const z of [zB, zB + bay, zB + 2 * bay, zF]) {
      body.push({
        geo: box(slope, 0.045, 0.045),
        color: frame,
        pos: [(sx * X) / 2, mid, z],
        rot: [0, 0, -sx * ang],
      });
    }
    // Normale der Dachfläche (nach aussen/oben): für sx = −1 zeigt sie nach links oben
    const nX = sx * Math.sin(ang);
    const nY = Math.cos(ang);
    for (let k = 0; k < 3; k++) {
      body.push({
        geo: box(slope - 0.04, 0.014, bay - 0.07),
        color: (k + (sx > 0 ? 1 : 0)) % 2 ? GLASS_DEEP : GLASS,
        pos: [(sx * X) / 2 + nX * 0.032, mid + nY * 0.032, zB + bay * (k + 0.5)],
        rot: [0, 0, -sx * ang],
      });
    }
  }
  body.push({ geo: box(0.05, 0.05, D + 0.04), color: frame, pos: [0, RH - 0.01, zM] });
  body.push({ geo: box(0.09, 0.03, D + 0.1), color: c.roof, pos: [0, RH + 0.03, zM] });
  body.push({ geo: cyl(0, 0.045, 0.12, 4), color: c.roof, pos: [0, RH + 0.12, zF + 0.04] });
  // Giebelfelder aus Glas mit Mittelpfosten
  for (const z of [zB, zF]) {
    body.push({
      geo: gable(2 * X - 0.06, RH - EH - 0.09, 0.016, 0.003),
      color: GLASS,
      pos: [0, EH + 0.06, z],
    });
    body.push({ geo: box(0.04, RH - EH - 0.06, 0.04), color: frame, pos: [0, (EH + RH) / 2, z] });
  }

  // Offene Türflügel (95° nach vorn aufgeschwenkt): Rahmen, Glasfüllung, Griff in der Akzentfarbe
  const open = (95 * Math.PI) / 180;
  const lw = 0.23;
  for (const s of [-1, 1]) {
    // Geschlossen zeigt der linke Flügel nach +x, der rechte nach −x; aufgeschwenkt zeigen beide nach vorn (+z)
    const dir: [number, number] = [-s * Math.cos(open), Math.sin(open)];
    const hinge: [number, number] = [s * 0.235, zF + 0.035];
    const yaw = Math.atan2(-dir[1], dir[0]);
    const cx = hinge[0] + dir[0] * (lw / 2);
    const cz = hinge[1] + dir[1] * (lw / 2);
    body.push({ geo: box(lw, 1.5, 0.03), color: frame, pos: [cx, 0.78, cz], rot: [0, yaw, 0] });
    body.push({
      geo: box(lw - 0.05, 0.86, 0.036),
      color: GLASS,
      pos: [cx, 0.98, cz],
      rot: [0, yaw, 0],
    });
    body.push({
      geo: box(lw - 0.05, 0.3, 0.036),
      color: GLASS_DEEP,
      pos: [cx, 0.37, cz],
      rot: [0, yaw, 0],
    });
    // Griff am freien Ende, Aussenseite (Normale = lokale z-Achse)
    const gx = hinge[0] + dir[0] * (lw - 0.035) + Math.sin(yaw) * 0.028;
    const gz = hinge[1] + dir[1] * (lw - 0.035) + Math.cos(yaw) * 0.028;
    body.push({ geo: ico(0.02), color: c.accent, pos: [gx, 0.8, gz] });
  }
  // Fussmatte in der Akzentfarbe zwischen den Türflügeln
  body.push({ geo: box(0.34, 0.012, 0.2), color: c.accent, pos: [0, 0.006, 0.68] });

  // Lampe unter dem Sturz (leuchtet): Aufhängung, Kappe, Glaskörper
  body.push(between([0, EH, zF - 0.04], [0, 1.52, zF - 0.06], 0.008, 0.008, IRON, 3));
  body.push({ geo: cyl(0, 0.06, 0.04, 6), color: IRON, pos: [0, 1.5, zF - 0.06] });
  glow.push({ geo: cyl(0.045, 0.04, 0.1, 6), color: "#ffe9b8", pos: [0, 1.43, zF - 0.06] });

  // Pflanze 1: Zitronenbäumchen im Terrakottatopf, Blattkranz um einen dünnen Stamm
  const ax = -0.17;
  const az = 0.1;
  body.push({ geo: cyl(0.095, 0.07, 0.17, 7), color: TERRACOTTA, pos: [ax, 0.115, az] });
  body.push({
    geo: cyl(0.105, 0.1, 0.03, 7),
    color: darken(TERRACOTTA, 1.1),
    pos: [ax, 0.215, az],
  });
  body.push(between([ax, 0.2, az], [ax, 0.9, az], 0.02, 0.012, WOOD, 4));
  for (let i = 0; i < 9; i++) {
    const t = i * 2.4;
    body.push(
      leaf(
        [ax + Math.sin(t) * 0.09, 0.62 + i * 0.072, az + Math.cos(t) * 0.09],
        0.12,
        at(GREENS, i),
        t,
        0.5,
      ),
    );
  }
  for (let i = 0; i < 3; i++) {
    const t = i * 2.1 + 0.4;
    body.push(
      bloom([ax + Math.sin(t) * 0.14, 0.78 + i * 0.1, az + Math.cos(t) * 0.14], 0.036, "#f6d33a"),
    );
  }
  // Pflanze 2: buschige Pflanze mit Blüten im Topf in der Akzentfarbe
  const bx = 0.17;
  const bz = -0.15;
  body.push({ geo: cyl(0.1, 0.075, 0.13, 7), color: c.accent, pos: [bx, 0.095, bz] });
  const bush: [number, number, number, number][] = [
    [0, 0.3, 0, 0.12],
    [0.08, 0.25, 0.05, 0.09],
    [-0.08, 0.26, -0.04, 0.09],
  ];
  bush.forEach(([x, y, z, r], i) => {
    body.push({ geo: ico(r), color: at(GREENS, i + 1), pos: [bx + x, y, bz + z] });
  });
  const petals = ["#f9a8d4", "#ffffff", "#fde047", "#f9a8d4", "#ffffff"];
  for (let i = 0; i < 5; i++) {
    const t = i * 1.3 + rnd() * 0.3;
    body.push(
      bloom(
        [bx + Math.sin(t) * 0.11, 0.33 + (i % 2) * 0.06, bz + Math.cos(t) * 0.11],
        0.034,
        at(petals, i),
      ),
    );
  }
  return { body, glow };
}

/** Staudenbeet: Steinrand, Erde, drei Sonnenblumen hinten, vier Rittersporne in der Mitte und Laubhügel mit Blüten vorn. */
function blumen(p: Palette, rnd: () => number): Part[] {
  const body: Part[] = [];
  body.push({ geo: box(0.84, 0.1, 1.56), color: SOIL, pos: [0, 0.05, 0] });

  // Rand aus 18 kleinen Steinen gleichmässig entlang des Rechtecks (|x| ≤ 0.43, |z| ≤ 0.78)
  const hx = 0.43;
  const hz = 0.78;
  const perim = 4 * (hx + hz);
  const n = 16;
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * perim;
    let x: number;
    let z: number;
    if (d < 2 * hx) {
      x = -hx + d;
      z = hz;
    } else if ((d -= 2 * hx) < 2 * hz) {
      x = hx;
      z = hz - d;
    } else if ((d -= 2 * hz) < 2 * hx) {
      x = hx - d;
      z = -hz;
    } else {
      d -= 2 * hx;
      x = -hx;
      z = -hz + d;
    }
    body.push(
      sit({
        geo: ico(0.07 + rnd() * 0.018),
        color: at(p.rocks, i),
        pos: [x, 0, z],
        rot: [rnd() * 0.4, rnd() * 3, rnd() * 0.4],
        scale: [1.15, 0.75, 1],
      }),
    );
  }

  // Laubhügel (Stauden), Blüten sitzen auf der Oberfläche der Ellipsoide
  const mounds: { x: number; z: number; r: number; detail: number }[] = [
    { x: -0.15, z: -0.02, r: 0.22, detail: 1 },
    { x: 0.17, z: 0.1, r: 0.22, detail: 1 },
    { x: -0.12, z: 0.52, r: 0.17, detail: 0 },
    { x: 0.15, z: 0.56, r: 0.15, detail: 0 },
  ];
  mounds.forEach((m, i) => {
    const part = sit({
      geo: ico(m.r, m.detail),
      color: at(p.bushes, i),
      pos: [m.x, 0, m.z],
      scale: [1.25, 0.6, 1],
    });
    body.push(part);
    const cy = part.pos![1];
    const count = i < 2 ? 4 : 2;
    for (let k = 0; k < count; k++) {
      const az = (k / count) * Math.PI * 2 + i + rnd() * 0.5;
      const th = 0.35 + rnd() * 0.5;
      body.push(
        bud(
          [
            m.x + Math.sin(az) * Math.sin(th) * m.r * 1.25 * 0.95,
            cy + Math.cos(th) * m.r * 0.6 * 0.95,
            m.z + Math.cos(az) * Math.sin(th) * m.r * 0.95,
          ],
          0.048,
          at(p.flowers, i * 2 + k),
        ),
      );
    }
  });

  // Sonnenblumen: Stängel mit leicht nach vorn gebeugtem Kopf, Blütenblätter, brauner Kern, zwei Blätter
  const sun: [number, number, number][] = [
    [-0.27, -0.62, 1.75],
    [0.02, -0.66, 2.05],
    [0.29, -0.58, 1.6],
  ];
  sun.forEach(([x, z, h], i) => {
    const tilt = 1.0;
    const nrm: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
    const head: V3 = [x, h, z + 0.06];
    body.push(between([x, 0.05, z], [x, h - 0.03, z + 0.05], 0.026, 0.017, GREENS[0], 4));
    body.push({
      geo: cyl(0.15, 0.13, 0.025, 8),
      color: i === 1 ? "#f2b705" : "#f7c52b",
      pos: head,
      rot: [tilt, 0, 0],
    });
    body.push({
      geo: cyl(0.075, 0.08, 0.04, 6),
      color: "#6b4423",
      pos: [head[0] + nrm[0] * 0.02, head[1] + nrm[1] * 0.02, head[2] + nrm[2] * 0.02],
      rot: [tilt, 0, 0],
    });
    body.push(leaf([x + 0.1, h * 0.38, z], 0.1, GREENS[1], Math.PI / 2, 0.6));
    body.push(leaf([x - 0.1, h * 0.55, z], 0.1, GREENS[3], -Math.PI / 2, 0.6));
  });

  // Rittersporn: schlanke Ähren aus vier kleinen Blüten, Farben aus der Stimmung
  [-0.33, -0.12, 0.12, 0.33].forEach((x, i) => {
    const h = [0.85, 1.0, 0.9, 0.8][i];
    const z = -0.3 + (i % 2) * 0.04;
    body.push(between([x, 0.05, z], [x, h - 0.1, z], 0.018, 0.01, GREENS[2], 4));
    for (let k = 0; k < 4; k++) {
      const r = 0.062 - k * 0.0095;
      body.push({
        geo: new THREE.OctahedronGeometry(r, 0),
        color: at(p.flowers, i + 1),
        pos: [x, h - 0.32 + k * 0.1, z],
        scale: [1, 1.3, 1],
        rot: [0, k, 0],
      });
    }
  });
  return body;
}

/**
 * Gemüsebeet: Holzrand, drei Reihen (Kohl, Salat, Rüebli) und eine Reihe Ringelblumen,
 * hinten zwei Bohnenstangen, die oben zusammengebunden sind und dicht berankt sind.
 */
function gemuese(p: Palette, rnd: () => number): Part[] {
  const body: Part[] = [];
  const top = 0.15;
  // Holzrand mit Eckpfosten und Erde
  for (const s of [-1, 1]) {
    body.push({ geo: box(0.05, 0.14, 1.74), color: WOOD_LIGHT, pos: [s * 0.49, 0.07, 0] });
    body.push({
      geo: box(0.93, 0.14, 0.05),
      color: darken(WOOD_LIGHT, 0.92),
      pos: [0, 0.07, s * 0.85],
    });
    for (const t of [-1, 1]) {
      body.push({ geo: box(0.07, 0.2, 0.07), color: WOOD, pos: [s * 0.49, 0.1, t * 0.85] });
    }
  }
  body.push({ geo: box(0.92, 0.1, 1.68), color: SOIL, pos: [0, 0.05, 0] });
  const ridge = darken(SOIL, 1.2);
  for (const z of [-0.36, 0, 0.33, 0.62]) {
    body.push({ geo: box(0.84, 0.05, 0.22), color: ridge, pos: [0, 0.125, z] });
  }

  // Stangenbohnen: zwei Stäbe lehnen aneinander, Querstab oben; Blätter in einer Schraube, rote Blüten, Hülsen
  const zb = -0.66;
  for (const s of [-1, 1]) {
    const base: V3 = [s * 0.3, 0.1, zb];
    const tip: V3 = [s * 0.1, 2.15, zb];
    body.push(between(base, tip, 0.018, 0.012, WOOD, 5));
    const at01 = (t: number): V3 => [
      base[0] + (tip[0] - base[0]) * t,
      base[1] + (tip[1] - base[1]) * t,
      zb,
    ];
    for (let i = 0; i < 10; i++) {
      const t = 0.08 + i * 0.09;
      const c = at01(t);
      const a = i * 2.2 + (s > 0 ? 1 : 0);
      body.push(
        leaf(
          [c[0] + Math.cos(a) * 0.05, c[1], c[2] + Math.sin(a) * 0.05],
          0.095,
          at(GREENS, i + (s > 0 ? 2 : 0)),
          Math.atan2(Math.cos(a), Math.sin(a)),
          0.5,
        ),
      );
    }
    for (let i = 0; i < 3; i++) {
      const c = at01(0.55 + i * 0.15);
      const a = i * 2.9 + 1;
      body.push(
        bud([c[0] + Math.cos(a) * 0.07, c[1], c[2] + Math.sin(a) * 0.07], 0.032, "#e0523d"),
      );
    }
    for (let i = 0; i < 2; i++) {
      const c = at01(0.35 + i * 0.2);
      const a = i * 2.4 + 0.5;
      const x = c[0] + Math.cos(a) * 0.065;
      const z = c[2] + Math.sin(a) * 0.065;
      body.push(between([x, c[1], z], [x, c[1] - 0.14, z + 0.01], 0.013, 0.007, "#8cc152", 3));
    }
  }
  body.push(between([-0.15, 2.05, zb], [0.15, 2.05, zb], 0.013, 0.013, WOOD_DARK, 4));

  // Kohl: Blattkranz und Kopf (einer violett)
  [-0.28, 0, 0.28].forEach((x, i) => {
    body.push({
      geo: cyl(0.13, 0.1, 0.05, 7),
      color: i === 1 ? "#5f9a53" : "#5a9a45",
      pos: [x, top + 0.025, -0.36],
    });
    body.push({
      geo: ico(0.095),
      color: i === 1 ? "#8e5b9b" : "#a9d46f",
      pos: [x, top + 0.1, -0.36],
      scale: [1, 0.9, 1],
    });
  });
  // Salat: Rosetten aus drei flachen Blättern, jeder dritte rot
  [-0.33, -0.11, 0.11, 0.33].forEach((x, i) => {
    for (let k = 0; k < 3; k++) {
      body.push({
        geo: new THREE.OctahedronGeometry(0.1, 0),
        color: i === 2 ? "#b6495a" : at(["#8fcf5a", "#a3d96a"], k + i),
        pos: [x, top + 0.025 + k * 0.012, 0],
        rot: [0, (k * Math.PI) / 3 + i, 0],
        scale: [0.6, 0.3, 1],
      });
    }
  });
  // Rüebli: orangene Köpfe in der Erde, Kraut fächert auf
  [-0.33, -0.11, 0.11, 0.33].forEach((x, i) => {
    body.push({ geo: cyl(0.03, 0.022, 0.05, 5), color: "#f08a24", pos: [x, top + 0.005, 0.33] });
    for (let b = 0; b < 2; b++) {
      const a = b * Math.PI + i * 1.3;
      const d = new THREE.Vector3(Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5).normalize();
      body.push({
        geo: cyl(0, 0.026, 0.22, 4),
        color: at(GREENS, b + i),
        pos: [x + d.x * 0.11, top + 0.03 + d.y * 0.11, 0.33 + d.z * 0.11],
        rot: orient([d.x, d.y, d.z]),
      });
    }
  });
  // Ringelblumen vorn: Laubbusch mit drei Blüten aus der Stimmung
  [-0.3, 0, 0.3].forEach((x, i) => {
    body.push({
      geo: ico(0.07),
      color: GREENS[3],
      pos: [x, top + 0.05, 0.62],
      scale: [1.2, 0.8, 1],
    });
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i;
      body.push(
        bud(
          [
            x + Math.sin(a) * 0.07,
            top + 0.1 + (k % 2) * 0.03,
            0.62 + Math.cos(a) * 0.06 + rnd() * 0.01,
          ],
          0.042,
          at(p.flowers, i + k),
        ),
      );
    }
  });
  return body;
}

/** Steingarten: Kiesfläche mit dunklem Rand, Findlinge (einer als stehender Stein), Gräser, Polsterpflanze, Trittsteine, Steinmännchen. */
function stein(p: Palette, rnd: () => number): Part[] {
  const body: Part[] = [];
  const gravel = mix(p.paving, "#ffffff", 0.15);
  body.push({
    geo: cyl(1, 1, 0.03, 14),
    color: darken(p.paving, 0.8),
    pos: [0, 0.015, 0],
    scale: [0.545, 1, 0.895],
  });
  body.push({
    geo: cyl(1, 1, 0.025, 14),
    color: gravel,
    pos: [0, 0.0425, 0],
    scale: [0.5, 1, 0.84],
  });
  const gTop = 0.055;

  // Kieselsteine auf der Kiesfläche
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.93;
    body.push(
      sit({
        geo: new THREE.OctahedronGeometry(0.026 + rnd() * 0.014, 0),
        color: at([darken(gravel, 0.85), mix(gravel, "#ffffff", 0.35), at(p.rocks, i)], i),
        pos: [Math.sin(a) * r * 0.46, gTop - 0.006, Math.cos(a) * r * 0.8],
        rot: [0, rnd() * 3, 0],
        scale: [1, 0.6, 1],
      }),
    );
  }

  // Findlinge: drei liegende, ein hoher stehender Stein und drei kleine
  const rocks: { x: number; z: number; r: number; s: V3; rot: V3 }[] = [
    { x: -0.13, z: -0.32, r: 0.3, s: [1.15, 0.8, 1], rot: [0.2, 0.5, 0.1] },
    { x: 0.23, z: 0.14, r: 0.21, s: [1.1, 0.85, 1], rot: [0.1, 1.9, -0.2] },
    { x: -0.26, z: 0.36, r: 0.16, s: [1, 0.75, 1.1], rot: [0.4, 0.2, 0.3] },
    { x: 0.27, z: -0.62, r: 0.19, s: [0.75, 1.6, 0.75], rot: [0.08, 0.7, 0.06] },
    { x: 0.33, z: 0.5, r: 0.09, s: [1.1, 0.8, 1], rot: [0.3, 1.0, 0.2] },
    { x: -0.38, z: -0.62, r: 0.08, s: [1.2, 0.8, 1], rot: [0.3, 2.0, 0.1] },
    { x: -0.02, z: 0.2, r: 0.07, s: [1, 0.8, 1.1], rot: [0.3, 0.4, 0.2] },
  ];
  rocks.forEach((k, i) => {
    body.push(
      restOn(
        {
          geo: rock(k.r),
          color: at(p.rocks, i),
          pos: [k.x, 0, k.z],
          rot: k.rot,
          scale: k.s,
        },
        0.02,
      ),
    );
  });

  // Steinmännchen: drei flache Steine übereinander
  let y = 0.02;
  [0.1, 0.075, 0.055].forEach((r, i) => {
    const part = restOn(
      {
        geo: rock(r),
        color: at(p.rocks, i + 1),
        pos: [-0.37 + i * 0.006, 0, 0.0],
        rot: [0.1 * i, i * 2.1, 0],
        scale: [1.2, 0.55, 1.1],
      },
      y,
    );
    body.push(part);
    y = topOf(part) - 0.012;
  });

  // Ziergräser: Büschel aus sechs gespreizten Halmen, Spitzen heller
  const tufts: [number, number][] = [
    [0.3, -0.36],
    [-0.08, 0.7],
    [0.05, -0.06],
  ];
  tufts.forEach(([x, z], k) => {
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + k;
      const lean = 0.1 + (b % 2) * 0.06;
      const h = 0.42 + ((b + k) % 3) * 0.08;
      body.push(
        blade(
          [x + Math.sin(a) * 0.03, gTop - 0.01, z + Math.cos(a) * 0.03],
          [x + Math.sin(a) * lean, gTop + h, z + Math.cos(a) * lean],
          0.026,
          mix(at(p.bushes, b + k), "#d9cf86", (b % 3) * 0.2),
        ),
      );
    }
  });

  // Polsterpflanze mit Blüten
  const cushion = sit({
    geo: ico(0.15, 1),
    color: at(p.bushes, 1),
    pos: [-0.2, 0, 0.66],
    scale: [1.35, 0.55, 1.1],
  });
  body.push(cushion);
  const cy = cushion.pos![1];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
    const th = 0.25 + rnd() * 0.7;
    body.push(
      bloom(
        [
          -0.2 + Math.sin(a) * Math.sin(th) * 0.15 * 1.35 * 0.95,
          cy + Math.cos(th) * 0.15 * 0.55 * 0.95,
          0.66 + Math.cos(a) * Math.sin(th) * 0.15 * 1.1 * 0.95,
        ],
        0.03,
        at(p.flowers, i),
      ),
    );
  }

  // Zwei Trittsteine
  [
    [0.1, 0.76],
    [0.1, 0.56],
  ].forEach(([x, z], i) => {
    body.push({
      geo: cyl(0.11, 0.12, 0.035, 6),
      color: at(p.rocks, i + 2),
      pos: [x, gTop + 0.0, z],
      rot: [0, i * 0.5, 0],
    });
  });
  return body;
}

/**
 * Obstgarten: Zwergobstbaum mit weiss gekalktem Stamm, Stützpfahl und Früchten in den Blütenfarben,
 * zwei Beerensträucher, ein Korb mit Früchten und etwas Fallobst auf einem Erdbeet.
 */
function obst(p: Palette, rnd: () => number): Part[] {
  const body: Part[] = [];
  const fruit = fruitColors(p);
  const leafColor = (i: number) => mix(at(p.leaves, i), at(p.needles, 0), 0.35);
  body.push({
    geo: cyl(1, 1, 0.04, 12),
    color: "#6b5040",
    pos: [0, 0.02, 0],
    scale: [0.54, 1, 0.89],
  });
  body.push({
    geo: cyl(1, 1, 0.02, 12),
    color: "#7d6045",
    pos: [0, 0.05, -0.1],
    scale: [0.42, 1, 0.58],
  });

  // Baum: gekalkter Stammfuss, Stamm, Stützpfahl, drei Kronenkugeln mit Früchten
  const tx = 0;
  const tz = -0.25;
  body.push({ geo: cyl(0.058, 0.075, 0.45, 7), color: "#efe6d4", pos: [tx, 0.265, tz] });
  body.push({ geo: cyl(0.042, 0.058, 0.65, 7), color: TRUNK, pos: [tx, 0.815, tz] });
  body.push(
    between([tx + 0.14, 0.04, tz + 0.1], [tx + 0.14, 1.0, tz + 0.1], 0.016, 0.014, WOOD, 4),
  );
  body.push(
    between([tx + 0.14, 0.7, tz + 0.1], [tx + 0.04, 0.72, tz + 0.03], 0.006, 0.006, "#d9c9a0", 3),
  );
  const crowns: { r: number; pos: V3; n: number; sy: number }[] = [
    { r: 0.38, pos: [0, 1.5, tz], n: 5, sy: 0.9 },
    { r: 0.25, pos: [0.22, 1.22, tz + 0.05], n: 4, sy: 1 },
    { r: 0.24, pos: [-0.22, 1.25, tz - 0.07], n: 3, sy: 1 },
  ];
  body.push(between([tx, 1.0, tz], [0.18, 1.22, tz + 0.04], 0.026, 0.018, TRUNK, 4));
  body.push(between([tx, 1.05, tz], [-0.18, 1.25, tz - 0.06], 0.026, 0.018, TRUNK, 4));
  let k = 0;
  crowns.forEach((c, ci) => {
    body.push({ geo: ico(c.r, 1), color: leafColor(ci), pos: c.pos, scale: [1, c.sy, 1] });
    for (let i = 0; i < c.n; i++) {
      const az = (i / c.n) * Math.PI * 2 + rnd() * 0.8;
      const el = -0.05 + rnd() * 0.75;
      const rr = c.r * 0.97;
      body.push(
        bloom(
          [
            c.pos[0] + Math.sin(az) * Math.cos(el) * rr,
            c.pos[1] + Math.sin(el) * rr * c.sy,
            c.pos[2] + Math.cos(az) * Math.cos(el) * rr,
          ],
          0.055,
          at(fruit, k++),
        ),
      );
    }
  });

  // Beerensträucher vorn mit Beeren in Rot und Blau
  [
    [-0.27, 0.32],
    [0.27, 0.4],
  ].forEach(([x, z], i) => {
    const part = sit({
      geo: ico(0.19, 1),
      color: at(p.bushes, i + 1),
      pos: [x, 0, z],
      scale: [1.1, 0.85, 1.1],
    });
    body.push(part);
    const cy = part.pos![1];
    for (let b = 0; b < 8; b++) {
      const az = (b / 8) * Math.PI * 2 + i + rnd() * 0.5;
      const el = 0.1 + rnd() * 0.9;
      body.push({
        geo: new THREE.OctahedronGeometry(0.032, 0),
        color: i === 0 ? at(["#c62a47", "#e0414f"], b) : at(["#3d4aa6", "#5160c0"], b),
        pos: [
          x + Math.sin(az) * Math.cos(el) * 0.19 * 1.1 * 0.97,
          cy + Math.sin(el) * 0.19 * 0.85 * 0.97,
          z + Math.cos(az) * Math.cos(el) * 0.19 * 1.1 * 0.97,
        ],
      });
    }
  });

  // Korb mit Früchten und Fallobst
  body.push({ geo: cyl(0.12, 0.09, 0.12, 8), color: "#c9a15a", pos: [0, 0.07, 0.72] });
  body.push({ geo: ring(0.123, 0.025), color: darken("#c9a15a", 0.8), pos: [0, 0.125, 0.72] });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    body.push(
      bloom(
        [Math.sin(a) * 0.05, 0.16 + (i % 2) * 0.02, 0.72 + Math.cos(a) * 0.05],
        0.055,
        at(fruit, i),
      ),
    );
  }
  for (const [x, z] of [
    [0.18, 0.62],
    [0.22, -0.02],
  ]) {
    body.push(sit({ geo: ico(0.05), color: at(fruit, k++), pos: [x, 0.04, z] }));
  }
  return body;
}

const ANBAU_BUILDERS: Record<
  Exclude<Anbau, "keiner">,
  (c: KitFarben, rnd: () => number) => Built
> = {
  laube,
  schuppen: (c) => schuppen(c),
  wintergarten,
};

const GARTEN_BUILDERS: Record<Garten, (p: Palette, rnd: () => number) => Part[]> = {
  blumen,
  gemuese,
  stein,
  obst,
};

/**
 * Bauteile eines Anbaus: `body` mit Vertex-Farben, `glow` = leuchtende Teile (Lampe im Wintergarten; sonst leer).
 * Grundfläche `ANBAU_MASSE`, Front nach +z, Boden bei y = 0. Gleiche Eingabe ergibt immer dasselbe Modell.
 */
export function anbauParts(
  anbau: Exclude<Anbau, "keiner">,
  colors: KitFarben,
): { body: Part[]; glow: Part[] } {
  const built = ANBAU_BUILDERS[anbau](colors, seededRandom(`kit:${anbau}`));
  return { body: built.body, glow: built.glow ?? [] };
}

/**
 * Bauteile eines Gartenstil-Felds in den Farben der Stimmung (Blumen, Gemüse, Stein, Obst).
 * Grundfläche `GARTEN_MASSE`, Boden bei y = 0. Gleiche Eingabe ergibt immer dasselbe Modell.
 */
export function gartenParts(garten: Garten, palette: Palette): Part[] {
  return GARTEN_BUILDERS[garten](palette, seededRandom(`kit:${garten}`));
}

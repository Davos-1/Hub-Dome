import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import type { Palette } from "@/lib/world/map";
import { spanFor, type SeedObjektTyp } from "@/lib/world/seed-objects";
import { box, cyl, cylZ, gable, type Part } from "./geo";
import { at, between, rock, sit, type V3 } from "./model-helpers";
import {
  Builder,
  canopy,
  darken,
  doorAt,
  Frame,
  gableRoof,
  mix,
  orient,
  roundWindow,
  STONE,
  wallFrames,
  WARM,
  windowAt,
  WOOD,
} from "./models/common";

/**
 * Modelle der Seed-Objekte (Mühle bis Rebberg), dazu Trauerweide und Steinbogenbrücke, prozedural aus
 * Grundformen. Lokal um den Ursprung, die Front zeigt nach +z, der Boden liegt bei y = 0, die Wasseroberfläche
 * bei y ≈ 0.05. Alles bleibt innerhalb der Grundfläche aus `seed-objects.ts` (Test). Unter y = 0 reichen nur
 * Pfähle, Wasserrad, Boot, Fähre und Wehrschwelle im Wasser (bis −0.7); Objekte auf dem Land bleiben darüber.
 *
 * - Lage `ufer`: hintere Hälfte (z < 0) ist Land, die Front (z > 0.3) liegt über dem Wasser.
 * - Lage `quer`: die Flussmitte liegt bei z = 0, das Wasser reicht von −water/2 bis +water/2, an beiden Enden ist Land.
 */

type Built = { body: Part[]; glow?: Part[] };
type Ctx = { p: Palette; rnd: () => number; hd: number; water: number };

const WOOD_LIGHT = "#b5855a";
const WOOD_DARK = "#4a3424";
const BEAM = "#5e4128";
const TRUNK = "#6b4423";
const IRON = "#2f2f35";
const SOIL = "#5a4030";
const ROPE = "#d9c9a0";
const STRAW = "#e3c46f";
const FOAM = "#f4f9fb";
const PLASTER = "#efe6d0";
const LANTERN = "#ffe9b8";

/** Kugelförmiger Körper (Ikosaeder, 20 Dreiecke bei detail 0, 80 bei 1). */
const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
/** Kleiner Klumpen mit nur 8 Dreiecken (feines Laub, Trauben). */
const octa = (r: number) => new THREE.OctahedronGeometry(r, 0);

/** Quader mit Mittelpunkt (x, y, z). */
const bx = (
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
  rot?: V3,
): Part => ({ geo: box(w, h, d), color, pos: [x, y, z], ...(rot ? { rot } : {}) });
/** Quader, dessen Unterkante auf y0 steht. */
const bb = (
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y0: number,
  z: number,
  rot?: V3,
): Part => bx(w, h, d, color, x, y0 + h / 2, z, rot);
/** Zylinder (Achse y), Unterkante auf y0. */
const cb = (
  rTop: number,
  rBot: number,
  h: number,
  color: string,
  x: number,
  y0: number,
  z: number,
  seg = 8,
): Part => ({ geo: cyl(rTop, rBot, h, seg), color, pos: [x, y0 + h / 2, z] });
/** Liegender Zylinder mit Achse entlang x, Mitte (x, y, z). */
const cylAxisX = (
  r: number,
  len: number,
  color: string,
  x: number,
  y: number,
  z: number,
  seg = 8,
): Part => ({ geo: cyl(r, r, len, seg), color, pos: [x, y, z], rot: [0, 0, Math.PI / 2] });
/** Liegender Zylinder mit Achse entlang z, Mitte (x, y, z). */
const cylAxisZ = (
  r: number,
  len: number,
  color: string,
  x: number,
  y: number,
  z: number,
  seg = 8,
): Part => ({ geo: cylZ(r, r, len, seg), color, pos: [x, y, z] });
/** Flache Scheibe (Schaum, Blätter, Teller) mit Mittelpunkt (x, y, z) und Radien (rx, rz). */
const disc = (
  rx: number,
  rz: number,
  h: number,
  color: string,
  x: number,
  y: number,
  z: number,
  seg = 7,
): Part => ({ geo: cyl(1, 1, h, seg), color, pos: [x, y, z], scale: [rx, 1, rz] });

/** Position (lx, lz) im um `yaw` gedrehten Teilkoordinatensystem mit Ursprung (cx, cz). */
const yawed = (cx: number, cz: number, lx: number, lz: number, yaw: number): [number, number] => [
  cx + lx * Math.cos(yaw) + lz * Math.sin(yaw),
  cz - lx * Math.sin(yaw) + lz * Math.cos(yaw),
];

/** Wendet Verschiebung und Drehung (Euler XYZ) auf fertige Bauteile an (z.B. ein geneigtes Boot samt Inhalt). */
function transformParts(parts: Part[], pos: V3, rot: V3): Part[] {
  const parent = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(1, 1, 1),
  );
  return parts.map((q) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(q.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(q.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(q.scale ?? [1, 1, 1])),
    );
    m.premultiply(parent);
    const t = new THREE.Vector3();
    const r = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(t, r, s);
    const e = new THREE.Euler().setFromQuaternion(r);
    return { ...q, pos: [t.x, t.y, t.z], rot: [e.x, e.y, e.z], scale: [s.x, s.y, s.z] };
  });
}

/** Grasbüschel: drei schmale, leicht gespreizte Halme, stehen genau auf dem Boden (36 Dreiecke). */
function tuft(x: number, z: number, color: string, k = 0): Part[] {
  const out: Part[] = [];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI * 2 + k * 2;
    const d = new THREE.Vector3(Math.sin(a) * 0.35, 1, Math.cos(a) * 0.35).normalize();
    out.push(
      sit({
        geo: cyl(0, 0.03, 0.2, 4),
        color,
        pos: [x + d.x * 0.1, d.y * 0.1, z + d.z * 0.1],
        rot: orient([d.x, d.y, d.z]),
      }),
    );
  }
  return out;
}

/** Blume: dünner Stiel und Blütenkugel (32 Dreiecke). */
function flower(x: number, z: number, color: string, h = 0.3, stem = "#4f8f47"): Part[] {
  return [bb(0.022, h, 0.022, stem, x, 0, z), { geo: ico(0.06), color, pos: [x, h + 0.02, z] }];
}

/** Stein im Gelände (36 Dreiecke), liegt auf dem Boden. */
const stone = (r: number, color: string, x: number, z: number, yaw = 0, sy = 0.75): Part =>
  sit({ geo: rock(r), color, pos: [x, 0, z], rot: [0.2, yaw, 0.1], scale: [1.1, sy, 1] });

/** Wasserrad mit Achse entlang x: zwei Felgen, sechs Speichen je Seite, zwölf Schaufeln, Nabe. */
function waterWheel(x: number, y: number, z: number, radius: number, thick: number): Part[] {
  const out: Part[] = [];
  const rim = radius - 0.05;
  const half = thick / 2;
  for (const s of [-1, 1]) {
    out.push({
      geo: new THREE.TorusGeometry(rim, 0.045, 4, 14),
      color: WOOD,
      pos: [x + s * half, y, z],
      rot: [0, Math.PI / 2, 0],
    });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.26;
      out.push({
        geo: box(0.07, rim, 0.1),
        color: darken(WOOD, 0.92),
        pos: [x + s * half, y + (Math.cos(a) * rim) / 2, z + (Math.sin(a) * rim) / 2],
        rot: [a, 0, 0],
      });
    }
  }
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2;
    out.push({
      geo: box(thick + 0.04, 0.2, 0.05),
      color: WOOD_LIGHT,
      pos: [x, y + Math.cos(a) * (radius - 0.1), z + Math.sin(a) * (radius - 0.1)],
      rot: [a, 0, 0],
    });
  }
  out.push(cylAxisX(0.15, thick + 0.3, WOOD_DARK, x, y, z, 8));
  return out;
}

/** Mühle: Steinfundament am Ufer (reicht ins Wasser), Fachwerkhaus, Wasserrad mit Gerinne, Säcke und Fass. */
function wassermuehle({ p }: Ctx): Built {
  const b = new Builder();
  const cxH = -0.75;
  const czH = -0.6;
  const W = 3.2;
  const D = 4.2;
  const y0 = 0.3;
  const eave = 2.15;
  const found = darken(STONE, 0.92);
  const roof = "#a5583a";

  // Fundament: auf dem Land ein niedriger Sockel, über dem Wasser eine Mauer, die unter die Oberfläche reicht
  b.add(bb(W + 0.24, 0.3, 3.12, found, cxH, 0, -1.26));
  b.add(bx(W + 0.24, 0.8, 1.32, darken(found, 0.9), cxH, -0.1, 0.96));
  b.add(bx(W + 0.3, 0.05, D + 0.3, mix(found, "#ffffff", 0.2), cxH, y0 - 0.025, czH));
  for (const [w, d, x, z] of [
    [W + 0.5, 0.1, cxH, 1.75],
    [0.1, 1.5, cxH + W / 2 + 0.2, 1.0],
    [0.1, 1.5, cxH - W / 2 - 0.2, 1.0],
  ])
    b.add(bx(w, 0.012, d, FOAM, x, 0.06, z));

  // Wände (Putz) mit Fachwerk
  b.add(bb(W, eave - y0, D, PLASTER, cxH, y0, czH));
  const F = wallFrames(b, W, D, cxH, czH);
  const mid = (y0 + eave) / 2;
  const hgt = eave - y0;
  const timber = (f: Frame, half: number, posts: number[]) => {
    for (const u of posts) f.box(0.12, hgt, 0.05, BEAM, u, mid, 0.015);
    for (const v of [y0 + 0.06, eave - 0.06]) f.box(half * 2 + 0.04, 0.12, 0.05, BEAM, 0, v, 0.015);
  };
  const brace = (f: Frame, u0: number, v0: number, u1: number, v1: number) =>
    b.add(between(f.at(u0, v0, 0.02), f.at(u1, v1, 0.02), 0.03, 0.03, BEAM, 4));
  timber(F.front, W / 2, [-1.54, -0.8, 0.8, 1.54]);
  timber(F.back, W / 2, [-1.54, 0, 1.54]);
  timber(F.left, D / 2, [-2.04, -1.0, 1.0, 2.04]);
  timber(F.right, D / 2, [-2.04, -1.0, 0.2, 2.04]);
  brace(F.front, -1.54, y0 + 0.12, -0.8, eave - 0.12);
  brace(F.front, 1.54, y0 + 0.12, 0.8, eave - 0.12);
  brace(F.left, 1.0, y0 + 0.12, 2.04, eave - 0.12);
  brace(F.left, -1.0, y0 + 0.12, -2.04, eave - 0.12);
  brace(F.right, -1.0, y0 + 0.12, -2.04, eave - 0.12);
  brace(F.right, 0.2, y0 + 0.12, 1.0 + 0.4, eave - 0.12);

  // Fenster vorn (leuchtet), kleine dunkle Fenster seitlich und hinten
  windowAt(F.front, 0, 1.4, 0.5, 0.65, {
    frame: BEAM,
    glass: WARM,
    shutter: "#4f7f8f",
    plain: true,
    bars: "cross",
  });
  const darkWindow = (f: Frame, u: number, v: number) => {
    f.box(0.58, 0.68, 0.05, BEAM, u, v, 0.02);
    f.box(0.48, 0.58, 0.04, "#5f7f95", u, v, 0.035);
    f.box(0.03, 0.58, 0.03, BEAM, u, v, 0.055);
    f.box(0.48, 0.03, 0.03, BEAM, u, v, 0.055);
  };
  darkWindow(F.left, 1.5, 1.4);
  darkWindow(F.left, -1.5, 1.4);
  darkWindow(F.back, 0.8, 1.4);
  darkWindow(F.back, -0.8, 1.4);

  // Tür an der linken Längsseite (Land), zwei niedrige Stufen
  const door = F.left;
  door.box(1.0, 1.58, 0.06, BEAM, 0, y0 + 0.79, 0.02);
  door.box(0.82, 1.46, 0.05, "#4f7f8f", 0, y0 + 0.73, 0.045);
  door.box(0.05, 1.46, 0.02, darken("#4f7f8f", 0.8), -0.2, y0 + 0.73, 0.075);
  door.box(0.05, 1.46, 0.02, darken("#4f7f8f", 0.8), 0.2, y0 + 0.73, 0.075);
  door.add(ico(0.035), "#e0b341", 0.3, y0 + 0.72, 0.09);
  door.box(1.3, 0.15, 0.5, found, 0, 0.075, 0.37);
  door.box(1.5, 0.08, 0.25, darken(found, 0.94), 0, 0.04, 0.7);
  canopy(door, 0, y0 + 1.82, 1.5, 0.55, roof, BEAM);

  // Dach mit Giebelfüllung und rundem Fenster im Vordergiebel
  gableRoof(new Frame(b, cxH, eave, czH, 0), 3.9, 1.3, 4.5, roof, { rows: 3, plate: PLASTER });
  const gf = new Frame(b, cxH, eave, czH + 2.25 + 0.024, 0);
  gf.add(cylZ(0.25, 0.25, 0.05, 8), BEAM, 0, 0.62, 0.02);
  gf.add(new THREE.CircleGeometry(0.2, 8), "#5f7f95", 0, 0.62, 0.047);
  gf.box(0.025, 0.4, 0.03, BEAM, 0, 0.62, 0.055);
  gf.box(0.4, 0.025, 0.03, BEAM, 0, 0.62, 0.055);
  // Schornstein
  b.add(bb(0.4, 1.1, 0.4, "#9b958a", cxH + 0.9, 2.5, czH - 1.2));
  b.add(bb(0.5, 0.08, 0.5, "#6f6a62", cxH + 0.9, 3.55, czH - 1.2));

  // Wasserrad an der rechten Seite: Achse durch die Wand, Lager im Pfahl, Gerinne obenauf
  const wx = cxH + W / 2 + 0.8;
  const wy = 0.6;
  const wz = 1.3;
  const R = 0.95;
  b.body.push(...waterWheel(wx, wy, wz, R, 0.6));
  b.add(cylAxisX(0.06, 1.55, WOOD_DARK, cxH + W / 2 + 0.775, wy, wz, 6));
  b.add(cb(0.1, 0.12, 1.9, WOOD_DARK, wx + 0.6, -0.5, wz, 7));
  b.add(bx(0.3, 0.3, 0.12, BEAM, cxH + W / 2 + 0.03, wy, wz));
  for (const s of [-1, 1]) {
    b.add(bx(0.04, 0.16, 1.9, WOOD_DARK, wx + s * 0.22, 1.82, -0.3, [0.1, 0, 0]));
  }
  b.add(bx(0.4, 0.05, 1.9, WOOD_LIGHT, wx, 1.76, -0.3, [0.1, 0, 0]));
  b.add(cb(0.07, 0.08, 1.75, WOOD_DARK, wx, 0, -0.55, 6));
  b.add(cb(0.07, 0.08, 2.2, WOOD_DARK, wx, -0.5, 0.5, 6));
  // Schaum am Rad
  for (const [x, z, r] of [
    [wx - 0.2, wz + 0.25, 0.3],
    [wx + 0.25, wz - 0.3, 0.26],
    [wx, wz + 0.8, 0.34],
    [wx + 0.1, wz - 0.9, 0.24],
  ])
    b.add(disc(r, r * 0.8, 0.02, FOAM, x, 0.06, z, 7));

  // Säcke, Fass und Büsche am Land (links hinten)
  const sack = "#d9c9a0";
  for (const [x, z, s] of [
    [-2.7, -2.0, 1],
    [-2.45, -2.35, 0.9],
    [-2.8, -2.5, 0.95],
  ])
    b.add(
      sit({
        geo: ico(0.22),
        color: mix(sack, "#b09a6a", s - 0.8),
        pos: [x, 0, z],
        scale: [1, 1.15, 0.9],
      }),
    );
  b.add(cb(0.26, 0.26, 0.62, "#8a5a2b", -2.75, 0, -0.1, 8));
  for (const y of [0.15, 0.45]) b.add(cb(0.275, 0.275, 0.04, IRON, -2.75, y, -0.1, 8));
  b.add(
    sit({ geo: ico(0.4, 1), color: at(p.bushes, 0), pos: [1.2, 0, -2.4], scale: [1.2, 0.9, 1] }),
  );
  b.add(sit({ geo: ico(0.3, 1), color: at(p.bushes, 1), pos: [1.9, 0, -1.9] }));
  for (let i = 0; i < 4; i++)
    b.body.push(...flower(1.0 + i * 0.28, -1.7 - (i % 2) * 0.2, at(p.flowers, i), 0.26));
  return { body: b.body, glow: b.glow };
}

/** Seilfähre: zwei Anlegestellen auf dem Land, Seil an zwei Pfosten quer über das Wasser, Holzfähre mit Geländer. */
function faehre({ p, water }: Ctx): Built {
  const body: Part[] = [];
  const wh = water / 2;
  const plank = ["#b5855a", "#a97a50", "#bd8d62"];
  for (const s of [-1, 1]) {
    const zc = s * (wh + 1.35);
    // Bohlen, Träger, Steinfüsse und Rampe zum Wasser
    for (let i = 0; i < 6; i++) {
      body.push(bx(2.2, 0.05, 0.26, plank[i % 3], 0, 0.24, zc + s * (-0.7 + i * 0.28)));
    }
    for (const x of [-0.9, 0.9]) {
      body.push(bx(0.12, 0.1, 1.7, WOOD, x, 0.17, zc));
      for (const dz of [-0.7, 0.7])
        body.push(
          sit({ geo: rock(0.17), color: STONE, pos: [x, 0, zc + dz], scale: [1.1, 0.7, 1.1] }),
        );
    }
    body.push(bx(2.0, 0.05, 0.6, plank[1], 0, 0.15, s * (wh + 0.22), [-s * 0.32, 0, 0]));
    // Seilpfosten mit Strebe, Schild und Pollern
    const zp = s * (wh + 1.55);
    body.push(cb(0.09, 0.11, 2.1, WOOD_DARK, 0, 0.265, zp, 7));
    body.push(bb(0.2, 0.06, 0.2, WOOD, 0, 2.36, zp));
    body.push(between([0, 1.7, zp], [0, 0.28, zp + s * 0.6], 0.04, 0.04, WOOD, 4));
    body.push(bx(0.46, 0.22, 0.03, "#e8d9b0", 0.0, 1.55, zp - s * 0.1));
    body.push(bx(0.4, 0.05, 0.035, at(p.flowers, 0), 0.0, 1.55, zp - s * 0.1));
    for (const x of [-0.85, 0.85])
      body.push(cb(0.07, 0.08, 0.34, WOOD_DARK, x, 0.265, zc - s * 0.1, 6));
    // Seil von der Pfostenspitze zum Mast der Fähre
    body.push(between([0, 2.3, zp], [0, 1.98, 0], 0.022, 0.022, ROPE, 4));
    // Büsche und Blumen am Rand
    body.push(
      sit({
        geo: ico(0.4, 1),
        color: at(p.bushes, s + 1),
        pos: [-1.6, 0, zc + s * 0.3],
        scale: [1, 0.85, 1],
      }),
    );
    body.push(...flower(1.55, zc + s * 0.1, at(p.flowers, s + 2), 0.3));
    body.push(...flower(1.75, zc - s * 0.15, at(p.flowers, s + 3), 0.26));
    body.push(...tuft(1.6, zc + s * 0.6, at(p.bushes, 2), s));
  }

  // Fähre: zwei Schwimmbalken, Deckbohlen, Geländer, Mast mit Wimpel, Fracht
  for (const x of [-0.72, 0.72]) body.push(cylAxisZ(0.19, 2.8, TRUNK, x, 0.06, 0, 7));
  for (let i = 0; i < 9; i++) body.push(bx(1.9, 0.06, 0.29, plank[i % 3], 0, 0.29, -1.2 + i * 0.3));
  for (const x of [-0.88, 0.88]) {
    for (const z of [-1.15, -0.4, 0.4, 1.15]) body.push(bb(0.07, 0.75, 0.07, WOOD, x, 0.32, z));
    body.push(bx(0.07, 0.06, 2.4, WOOD_LIGHT, x, 1.04, 0));
    body.push(bx(0.05, 0.05, 2.3, WOOD_LIGHT, x, 0.7, 0));
  }
  body.push(cb(0.055, 0.07, 1.7, WOOD_DARK, 0, 0.32, 0, 6));
  body.push(bx(0.14, 0.1, 0.2, IRON, 0, 2.0, 0));
  body.push(bx(0.4, 0.2, 0.02, at(p.flowers, 1), 0.22, 1.82, 0));
  for (const s of [-1, 1])
    body.push(between([0, 1.95, 0], [0, 0.85, s * 1.3], 0.012, 0.012, ROPE, 4));
  body.push(bb(0.5, 0.4, 0.5, WOOD_LIGHT, 0.45, 0.32, -0.7));
  body.push(bb(0.5, 0.04, 0.5, WOOD, 0.45, 0.72, -0.7));
  body.push(cb(0.22, 0.22, 0.5, "#8a5a2b", -0.45, 0.32, 0.65, 8));
  body.push(cb(0.12, 0.12, 0.4, "#c9d1d6", -0.5, 0.32, -0.55, 8));
  return { body };
}

/** Wehr: niedrige Steinschwelle quer im Wasser (Fliessrichtung ±x), Schaum, Steinblöcke und Schütze an den Ufern. */
function wehr({ p, rnd, water }: Ctx): Built {
  const body: Part[] = [];
  const wh = water / 2;
  const span = water + 0.2;
  const n = Math.max(6, Math.round(span / 0.55));
  const len = span / n;
  for (let i = 0; i < n; i++) {
    const z = -wh - 0.1 + (i + 0.5) * len;
    const top = 0.27 + rnd() * 0.05;
    const tone = darken(at(p.rocks, i), 0.92 + rnd() * 0.12);
    body.push(bx(0.8, top + 0.4, len - 0.02, tone, 0, (top - 0.4) / 2, z));
    // Abtreppung stromab, knapp über dem Wasser
    body.push(bx(0.45, 0.5, len - 0.03, darken(tone, 0.9), 0.62, -0.13, z));
    // Vorlage stromauf, unter Wasser
    body.push(bx(0.2, 0.5, len - 0.03, darken(tone, 0.85), -0.5, -0.15, z));
  }
  // Schaumstreifen unterhalb und ein heller Saum an der Krone
  const bands = Math.round(water / 0.55);
  for (let i = 0; i < bands; i++) {
    const z = -wh + 0.3 + (i + 0.5) * ((water - 0.6) / bands);
    body.push(
      disc(0.22 + rnd() * 0.06, 0.24 + rnd() * 0.08, 0.02, FOAM, 0.72 + rnd() * 0.1, 0.065, z, 6),
    );
    body.push(disc(0.14 + rnd() * 0.05, 0.2, 0.02, FOAM, 1.0 + rnd() * 0.06, 0.062, z + 0.25, 6));
  }
  body.push(bx(0.07, 0.012, water, FOAM, 0.47, 0.115, 0));
  for (const [x, z, r] of [
    [0.95, -wh + 0.9, 0.18],
    [0.85, wh - 1.1, 0.22],
    [0.95, 0.1, 0.16],
  ]) {
    body.push({ geo: rock(r), color: at(p.rocks, 1), pos: [x, -0.05, z], scale: [1.2, 0.8, 1] });
  }
  // Ufer: Widerlager aus Stein, grosse Blöcke, links die Schütze mit Handrad
  for (const s of [-1, 1]) {
    const zc = s * (wh + 0.35);
    body.push(bb(1.3, 0.55, 0.8, darken(STONE, 0.95), 0, 0, zc));
    body.push(bb(0.9, 0.3, 0.5, STONE, 0.1, 0.55, zc + s * 0.1));
    for (let k = 0; k < 3; k++) {
      body.push(
        stone(
          0.26 + rnd() * 0.14,
          at(p.rocks, k + 1),
          (k - 1) * 0.55,
          s * (wh + 1.15 + rnd() * 0.5),
          rnd() * 3,
        ),
      );
    }
    body.push(...tuft(-1.0, s * (wh + 1.0), at(p.bushes, s + 1), s));
    body.push(...tuft(1.0, s * (wh + 1.1), at(p.bushes, s + 2), s + 1));
  }
  const zg = -(wh + 0.35);
  for (const x of [-0.35, 0.35]) body.push(bb(0.1, 1.0, 0.1, WOOD, x, 0.55, zg));
  body.push(bx(0.9, 0.1, 0.1, WOOD, 0, 1.6, zg));
  body.push({
    geo: new THREE.TorusGeometry(0.14, 0.02, 4, 10),
    color: IRON,
    pos: [0, 1.3, zg + 0.1],
  });
  body.push(bx(0.04, 0.5, 0.04, IRON, 0, 1.3, zg));
  return { body };
}

/** Fischerhütte: Holzhütte mit Reetdach auf dem Land, Steg auf Pfählen übers Wasser, Laterne, Reuse, Netzgestell. */
function fischerhuette({ p, rnd }: Ctx): Built {
  const b = new Builder();
  const W = 2.8;
  const D = 2.2;
  const cz = -1.9;
  const H = 1.75;
  const wall = "#a9835a";
  b.add(bb(W + 0.1, 0.12, D + 0.1, darken(STONE, 0.9), 0, 0, cz));
  b.add(bb(W, H, D, wall, 0, 0.12, cz));
  const F = wallFrames(b, W, D, 0, cz);
  const mid = 0.12 + H / 2;
  for (const f of [F.front, F.back, F.left, F.right]) {
    const half = (f === F.front || f === F.back ? W : D) / 2;
    for (const s of [-1, 1]) f.box(0.12, H, 0.05, BEAM, s * (half - 0.06), mid, 0.015);
    // Brettfugen
    const lines = half > 1.2 ? [-0.9, -0.45, 0.45, 0.9] : [-0.6, 0, 0.6];
    for (const u of lines) f.box(0.025, H - 0.1, 0.02, darken(wall, 0.8), u, mid, 0.012);
  }
  // Tür vorn mit kleinem Vordach, Fenster seitlich
  const fr = F.front;
  fr.box(0.86, 1.45, 0.05, BEAM, 0, 0.12 + 0.725, 0.02);
  fr.box(0.7, 1.35, 0.05, "#3f7f9a", 0, 0.12 + 0.675, 0.045);
  fr.box(0.05, 1.35, 0.02, darken("#3f7f9a", 0.8), 0, 0.12 + 0.675, 0.075);
  fr.add(ico(0.035), "#e0b341", 0.22, 0.12 + 0.68, 0.09);
  canopy(fr, 0, 1.78, 1.4, 0.75, "#8a6a45", BEAM);
  for (const f of [F.right, F.left]) {
    f.box(0.62, 0.62, 0.05, BEAM, 0, 1.1, 0.02);
    f.box(0.5, 0.5, 0.04, "#7f9bb5", 0, 1.1, 0.035);
    f.box(0.03, 0.5, 0.03, BEAM, 0, 1.1, 0.055);
    f.box(0.5, 0.03, 0.03, BEAM, 0, 1.1, 0.055);
    f.box(0.72, 0.06, 0.14, WOOD_LIGHT, 0, 0.78, 0.07);
  }
  // Reetdach
  gableRoof(new Frame(b, 0, 0.12 + H, cz, 0), 3.5, 1.1, 2.6, "#c6a15f", {
    rows: 4,
    plate: wall,
    trim: "#8a6a3a",
  });
  b.add(bb(0.3, 0.9, 0.3, "#9b958a", 0.8, 2.2, cz - 0.5));
  b.add(bb(0.4, 0.07, 0.4, "#6f6a62", 0.8, 3.1, cz - 0.5));

  // Steg: Bohlen von z = −0.5 bis 3.3 in Deckhöhe 0.3, Träger, Auflager am Ufer, Pfähle im Wasser
  const deck = ["#b5855a", "#a97a50", "#bd8d62"];
  for (let k = 0; k < 16; k++) b.add(bx(1.1, 0.05, 0.22, deck[k % 3], 0, 0.275, -0.5 + k * 0.25));
  for (const s of [-1, 1]) {
    b.add(bx(0.1, 0.1, 3.9, WOOD, s * 0.42, 0.2, 1.4));
    for (const z of [-0.3, 0.2])
      b.add(sit({ geo: rock(0.16), color: STONE, pos: [s * 0.42, 0, z], scale: [1.1, 0.75, 1.3] }));
    for (const z of [0.9, 1.9, 2.9]) {
      b.add(cb(0.06, 0.065, 1.2, WOOD_DARK, s * 0.52, -0.6, z, 6));
      b.add(cb(0.075, 0.075, 0.04, WOOD, s * 0.52, 0.6, z, 6));
    }
    b.add(between([s * 0.52, 0.45, 0.9], [s * 0.52, 0.45, 2.9], 0.012, 0.012, ROPE, 4));
  }
  b.add(sit({ geo: box(1.3, 0.08, 0.35), color: darken(STONE, 0.95), pos: [0, 0, -0.62] }));
  // Laterne am Stegende (leuchtet)
  const lz = 3.15;
  b.add(cb(0.04, 0.05, 1.5, WOOD_DARK, 0.45, 0.3, lz, 6));
  b.add(bx(0.4, 0.04, 0.04, WOOD_DARK, 0.3, 1.78, lz));
  b.add(bx(0.17, 0.03, 0.17, IRON, 0.15, 1.58, lz));
  b.add(bx(0.19, 0.03, 0.19, IRON, 0.15, 1.8, lz));
  b.add({
    geo: cyl(0, 0.13, 0.12, 4),
    color: IRON,
    pos: [0.15, 1.88, lz],
    rot: [0, Math.PI / 4, 0],
  });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(bx(0.022, 0.2, 0.022, IRON, 0.15 + sx * 0.07, 1.69, lz + sz * 0.07));
  b.light({ geo: box(0.12, 0.17, 0.12), color: LANTERN, pos: [0.15, 1.69, lz] });
  // Reuse (Fischkorb) und Eimer auf dem Steg, Fischkiste
  b.add(cylAxisZ(0.17, 0.7, "#c8a165", -0.2, 0.47, 1.5, 8));
  b.add({
    geo: cyl(0, 0.17, 0.3, 8),
    color: "#b08a50",
    pos: [-0.2, 0.47, 1.99],
    rot: [Math.PI / 2, 0, 0],
  });
  for (const z of [1.3, 1.6])
    b.add({
      geo: new THREE.TorusGeometry(0.175, 0.015, 3, 6),
      color: "#8a6a3a",
      pos: [-0.2, 0.47, z],
      rot: [0, 0, 0],
    });
  b.add(cb(0.11, 0.09, 0.2, "#7f8c8d", 0.25, 0.3, 0.9, 8));
  b.add(bb(0.4, 0.2, 0.3, WOOD_LIGHT, 0.2, 0.3, 2.3));
  b.add(sit({ geo: ico(0.09), color: "#b9c4cc", pos: [0.2, 0.5, 2.3], scale: [1.6, 0.6, 0.7] }));

  // Netzgestell links der Hütte (auf dem Land): zwei Pfosten, Netz mit Schwimmern
  for (const z of [-2.8, -1.0]) {
    b.add(cb(0.05, 0.06, 1.7, WOOD_DARK, -2.3, 0, z, 6));
  }
  b.add(bx(0.06, 0.06, 1.9, WOOD, -2.3, 1.64, -1.9));
  for (let i = 0; i < 5; i++) b.add(bx(0.02, 0.02, 1.7, "#8a9a78", -2.3, 0.55 + i * 0.2, -1.9));
  for (let i = 0; i < 7; i++) b.add(bx(0.02, 1.0, 0.02, "#8a9a78", -2.3, 1.1, -2.7 + i * 0.28));
  for (let i = 0; i < 5; i++)
    b.add({ geo: ico(0.045), color: "#e8793a", pos: [-2.3, 1.7, -2.65 + i * 0.4] });
  // Fischerboje, Büsche und Blumen
  b.add(
    sit({ geo: ico(0.38, 1), color: at(p.bushes, 0), pos: [-1.7, 0, -3.0], scale: [1.1, 0.9, 1] }),
  );
  b.add(sit({ geo: ico(0.3, 1), color: at(p.bushes, 2), pos: [1.9, 0, -2.9] }));
  for (let i = 0; i < 4; i++)
    b.body.push(
      ...flower(1.9 + (i % 2) * 0.3, -1.3 - i * 0.25, at(p.flowers, i + 1), 0.25 + rnd() * 0.08),
    );
  b.body.push(...tuft(-1.8, -0.5, at(p.bushes, 1), 1));
  b.body.push(...tuft(1.9, -0.4, at(p.bushes, 0), 2));
  return { body: b.body, glow: b.glow };
}

/** Picknickplatz: Holztisch mit zwei Bänken, Decke mit Korb, Geschirr und Wiesenblumen. */
function picknickplatz({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const tx = -0.3;
  const tz = -0.25;
  const top = ["#b5855a", "#a97a50", "#bd8d62"];
  // Tischplatte aus drei Brettern, zwei Bänke, schräge Beine, Querholz
  for (let i = 0; i < 3; i++)
    body.push(bx(1.9, 0.045, 0.24, top[i], tx, 0.76, tz + (i - 1) * 0.26));
  for (const s of [-1, 1]) {
    body.push(bx(1.9, 0.05, 0.3, darken(WOOD_LIGHT, 0.94), tx, 0.45, tz + s * 0.66));
    for (const x of [-0.7, 0.7]) {
      body.push(bb(0.07, 0.43, 0.26, WOOD, tx + x, 0, tz + s * 0.66));
      body.push(
        between(
          [tx + x, 0.72, tz + s * 0.28],
          [tx + x, 0.04, tz + s * 0.66],
          0.035,
          0.035,
          WOOD,
          4,
        ),
      );
    }
  }
  body.push(bx(1.5, 0.06, 0.06, WOOD, tx, 0.62, tz));
  // Auf dem Tisch: Obstschale, Becher, Vase mit Blumen
  body.push(cb(0.15, 0.1, 0.07, "#d9b483", tx - 0.35, 0.785, tz, 8));
  [at(p.flowers, 2), "#e8c040", at(p.flowers, 3)].forEach((c, i) =>
    body.push({
      geo: ico(0.045),
      color: c,
      pos: [tx - 0.35 + (i - 1) * 0.06, 0.88, tz + (i % 2) * 0.04],
    }),
  );
  for (const [x, z] of [
    [0.15, 0.1],
    [0.4, -0.08],
  ])
    body.push(cb(0.04, 0.035, 0.09, "#f4efe4", tx + x, 0.785, tz + z, 7));
  body.push(cb(0.045, 0.06, 0.12, "#8fb8c9", tx + 0.65, 0.785, tz, 7));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    body.push({
      geo: ico(0.045),
      color: at(p.flowers, i),
      pos: [tx + 0.65 + Math.cos(a) * 0.035, 0.93 + (i % 2) * 0.03, tz + Math.sin(a) * 0.035],
    });
  }

  // Decke mit Karomuster, Korb, Brot, Flasche
  const bx0 = 1.2;
  const bz0 = 0.95;
  const yaw = 0.3;
  const blanket = mix(at(p.flowers, 0), "#ffffff", 0.35);
  const stripe = mix(at(p.flowers, 0), "#ffffff", 0.75);
  body.push({ geo: box(1.5, 0.02, 1.2), color: blanket, pos: [bx0, 0.01, bz0], rot: [0, yaw, 0] });
  for (const o of [-0.4, 0, 0.4]) {
    const [x, z] = yawed(bx0, bz0, 0, o, yaw);
    body.push({ geo: box(1.5, 0.008, 0.14), color: stripe, pos: [x, 0.024, z], rot: [0, yaw, 0] });
    const [x2, z2] = yawed(bx0, bz0, o * 1.2, 0, yaw);
    body.push({ geo: box(0.14, 0.008, 1.2), color: stripe, pos: [x2, 0.03, z2], rot: [0, yaw, 0] });
  }
  const [kx, kz] = yawed(bx0, bz0, -0.25, -0.1, yaw);
  body.push(cb(0.2, 0.16, 0.2, "#c9a05f", kx, 0.02, kz, 8));
  body.push(cb(0.21, 0.21, 0.03, "#8a6a3a", kx, 0.2, kz, 8));
  body.push({
    geo: new THREE.TorusGeometry(0.17, 0.018, 4, 8, Math.PI),
    color: "#8a6a3a",
    pos: [kx, 0.22, kz],
    rot: [0, yaw, 0],
  });
  body.push(bb(0.3, 0.12, 0.2, "#f4efe4", kx + 0.02, 0.2, kz + 0.02, [0, yaw + 0.2, 0]));
  const [lx, lz] = yawed(bx0, bz0, 0.3, 0.2, yaw);
  body.push(
    sit({
      geo: ico(0.1),
      color: "#d9a85a",
      pos: [lx, 0, lz],
      scale: [1.8, 0.8, 1],
      rot: [0, yaw, 0],
    }),
  );
  const [fx, fz] = yawed(bx0, bz0, 0.35, -0.3, yaw);
  body.push({
    geo: cyl(0.045, 0.045, 0.28, 7),
    color: "#4f8f6a",
    pos: [fx, 0.06 + 0.02, fz],
    rot: [0, 0, Math.PI / 2 + yaw * 0.3],
  });
  const [px, pz] = yawed(bx0, bz0, 0.0, 0.35, yaw);
  body.push(disc(0.11, 0.11, 0.02, "#f4efe4", px, 0.03, pz, 8));

  // Wiesenblumen und Gras verstreut, nicht auf Tisch und Decke
  const free = (x: number, z: number) =>
    !(Math.abs(x - tx) < 1.35 && Math.abs(z - tz) < 1.15) && Math.hypot(x - bx0, z - bz0) > 1.1;
  let k = 0;
  for (let tries = 0; tries < 80 && k < 14; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.8 + rnd() * 1.4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!free(x, z) || Math.hypot(x, z) > 2.2) continue;
    if (k % 2 === 0) body.push(...flower(x, z, at(p.flowers, k), 0.22 + rnd() * 0.12));
    else body.push(...tuft(x, z, at(p.bushes, k), k));
    k++;
  }
  return { body };
}

/** Querschnitt-Tabellen des Ruderboots (9 Stationen vom Bug zum Heck). */
const BOAT = {
  z0: -2.2,
  z1: 1.4,
  beam: [0, 0.22, 0.42, 0.55, 0.61, 0.62, 0.59, 0.52, 0.44],
  sheer: [0.62, 0.52, 0.46, 0.42, 0.4, 0.4, 0.41, 0.44, 0.48],
  keel: [0.22, 0.1, 0.03, 0, 0, 0, 0, 0.01, 0.03],
};

/** Halbe Breite der Bordwand (aussen) auf Höhe y bei Station-Anteil t ∈ [0, 1]. */
function boatWallX(t: number, y: number) {
  const f = (arr: number[]) => {
    const u = t * (arr.length - 1);
    const i = Math.min(arr.length - 2, Math.floor(u));
    return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
  };
  const w = f(BOAT.beam);
  const h = f(BOAT.sheer);
  const k = f(BOAT.keel);
  const cy = k + 0.28 * (h - k);
  if (y <= cy) return (0.5 * w * (y - k)) / Math.max(0.001, cy - k);
  return 0.5 * w + (0.5 * w * (y - cy)) / Math.max(0.001, h - cy);
}

/** Rumpf als Loft über Querschnitte: Aussenhaut, Innenseite und Dollbord als getrennte Geometrien (flach schattiert). */
function boatHull(kind: "outer" | "inner" | "rim"): THREE.BufferGeometry {
  const n = BOAT.beam.length;
  const th = 0.045;
  const st: V3[][] = [];
  for (let i = 0; i < n; i++) {
    const z = BOAT.z0 + ((BOAT.z1 - BOAT.z0) * i) / (n - 1);
    const w = BOAT.beam[i];
    const h = BOAT.sheer[i];
    const k = BOAT.keel[i];
    const cy = k + 0.28 * (h - k);
    const wi = Math.max(0, w - th * 1.2);
    const ci = Math.max(0, 0.5 * w - th);
    st.push([
      [-w, h, z],
      [-0.5 * w, cy, z],
      [0, k, z],
      [0.5 * w, cy, z],
      [w, h, z],
      [wi, h, z],
      [ci, cy + th * 0.6, z],
      [0, k + th, z],
      [-ci, cy + th * 0.6, z],
      [-wi, h, z],
    ]);
  }
  const segs = kind === "outer" ? [0, 1, 2, 3] : kind === "inner" ? [5, 6, 7, 8] : [4, 9];
  const pos: number[] = [];
  const tri = (a: V3, b: V3, c: V3) => pos.push(...a, ...b, ...c);
  for (let s = 0; s < n - 1; s++) {
    for (const i of segs) {
      const j = (i + 1) % 10;
      const a = st[s][i];
      const bq = st[s][j];
      const c = st[s + 1][j];
      const d = st[s + 1][i];
      tri(a, bq, c);
      tri(a, c, d);
    }
  }
  const last = st[n - 1];
  if (kind === "outer") {
    tri(last[0], last[1], last[2]);
    tri(last[0], last[2], last[3]);
    tri(last[0], last[3], last[4]);
  } else if (kind === "inner") {
    tri(last[5], last[6], last[7]);
    tri(last[5], last[7], last[8]);
    tri(last[5], last[8], last[9]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Ruderboot: halb aufs Ufer gezogen (Bug zeigt nach −z auf das Land), zwei Ruder, Sitzbretter, Fangleine am Pflock. */
function ruderboot({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const hull = ["#3f7fa8", "#b5483c", "#4a8f6a"][Math.floor(rnd() * 3)];
  const local: Part[] = [
    { geo: boatHull("outer"), color: hull },
    { geo: boatHull("inner"), color: "#d8b784" },
    { geo: boatHull("rim"), color: "#f2e8d0" },
  ];
  const tAt = (z: number) => (z - BOAT.z0) / (BOAT.z1 - BOAT.z0);
  // Sitzbretter
  for (const z of [-0.5, 0.5]) {
    const hw = boatWallX(tAt(z), 0.26) - 0.03;
    local.push(bx(hw * 2, 0.04, 0.26, WOOD_LIGHT, 0, 0.26, z));
  }
  // Dollen am Dollbord und zwei Ruder, quer über die Sitzbretter gelegt
  for (const s of [-1, 1]) {
    const t = tAt(-0.05);
    const x = boatWallX(t, 0.4) - 0.02;
    local.push(cb(0.025, 0.03, 0.12, IRON, s * x, 0.38, -0.05, 6));
  }
  for (const s of [-1, 1]) {
    const a: V3 = [s * 0.2, 0.31, 1.0];
    const e: V3 = [-s * 0.2, 0.31, -0.95];
    local.push(between(a, e, 0.025, 0.025, WOOD_LIGHT, 5));
    local.push({
      geo: box(0.12, 0.02, 0.4),
      color: darken(WOOD_LIGHT, 0.9),
      pos: [-s * 0.24, 0.31, -1.12],
      rot: [0, s * 0.19, 0],
    });
    local.push(cb(0.032, 0.032, 0.14, WOOD_DARK, s * 0.2, 0.31, 1.07, 6));
  }
  local.push(cb(0.1, 0.08, 0.18, "#7f8c8d", 0.18, 0.04, 1.0, 8));
  const pitch = 0.08;
  const pivotZ = 0.3;
  body.push(...transformParts(local, [0, 0, pivotZ], [pitch, 0, 0]));
  // Bugspitze in Weltkoordinaten für die Fangleine
  const bow = new THREE.Vector3(0, 0.5, BOAT.z0)
    .applyEuler(new THREE.Euler(pitch, 0, 0))
    .add(new THREE.Vector3(0, 0, pivotZ));
  body.push(cb(0.04, 0.05, 0.55, WOOD, 0.4, 0, -2.0, 6));
  body.push(between([bow.x, bow.y, bow.z], [0.4, 0.5, -2.0], 0.014, 0.014, ROPE, 4));
  // Ufer: Steine, Schilf und Büsche
  body.push(stone(0.14, at(p.rocks, 0), -0.72, -1.5, 0.4));
  body.push(stone(0.12, at(p.rocks, 1), 0.74, -1.1, 1.1));
  body.push(stone(0.1, at(p.rocks, 2), -0.76, 0.1, 2.0));
  body.push(
    sit({ geo: ico(0.3, 1), color: at(p.bushes, 0), pos: [-0.6, 0, -1.7], scale: [1, 0.9, 1] }),
  );
  for (const [x, z, k] of [
    [0.7, 0.0, 0],
    [-0.74, 0.5, 1],
    [0.7, -0.4, 2],
  ] as [number, number, number][]) {
    body.push(...tuft(x, z, at(p.bushes, k), k));
    body.push(...flower(x * 0.97, z + 0.15, at(p.flowers, k), 0.25));
  }
  return { body };
}

/** Kapelle: weisse Saalkapelle mit Sockel, Apsis, Rundbogenfenstern (leuchten), Rundfenster, Glockentürmchen mit Kreuz. */
function kapelle({ p }: Ctx): Built {
  const b = new Builder();
  const W = 2.8;
  const D = 4.4;
  const cz = -0.3;
  const y0 = 0.28;
  const H = 2.1;
  const eave = y0 + H;
  const wall = "#f9f5ea";
  const found = darken(STONE, 0.93);
  const roof = "#a24f3a";
  const slate = "#566270";

  b.add(bb(W + 0.2, y0, D + 0.2, found, 0, 0, cz));
  b.add(bb(W, H, D, wall, 0, y0, cz));
  // Apsis im Chor (hinten): achtseitig, Facette genau nach hinten
  b.add({
    geo: cyl(0.85, 0.85, H, 8),
    color: wall,
    pos: [0, y0 + H / 2, cz - D / 2],
    rot: [0, Math.PI / 8, 0],
  });
  b.add({
    geo: cyl(0.95, 0.95, y0, 8),
    color: found,
    pos: [0, y0 / 2, cz - D / 2],
    rot: [0, Math.PI / 8, 0],
  });
  b.add({
    geo: cyl(0, 0.95, 0.9, 8),
    color: roof,
    pos: [0, eave + 0.45, cz - D / 2],
    rot: [0, Math.PI / 8, 0],
  });
  const apse = new Frame(b, 0, 0, cz - D / 2 - 0.85 * Math.cos(Math.PI / 8), Math.PI);
  windowAt(apse, 0, 1.3, 0.3, 0.7, {
    arched: true,
    glass: "#ffd9a0",
    frame: "#8a7560",
    sill: false,
    bars: "vertical",
  });

  const F = wallFrames(b, W, D, 0, cz);
  doorAt(F.front, 0, 0.9, 1.7, y0, {
    leaf: WOOD,
    frame: "#8a7560",
    arched: true,
    steps: true,
    stone: STONE,
  });
  for (const f of [F.left, F.right]) {
    for (const u of [-1.0, 1.0]) {
      windowAt(f, u, 1.3, 0.55, 0.95, {
        arched: true,
        glass: "#ffd9a0",
        frame: "#8a7560",
        bars: "vertical",
        sillColor: STONE,
      });
    }
  }
  // Ecklisenen
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(bb(0.14, H, 0.14, "#e5ddca", sx * (W / 2 - 0.05), y0, cz + sz * (D / 2 - 0.05)));

  // Satteldach mit weisser Giebelfüllung, rundes Fenster im Giebel
  gableRoof(new Frame(b, 0, eave, cz, 0), 3.5, 1.5, 4.8, roof, { rows: 3, plate: wall });
  roundWindow(new Frame(b, 0, eave, cz + 2.4 + 0.024, 0), 0, 0.72, 0.22, "#8a7560", "#ffd9a0");

  // Glockentürmchen auf dem First (vorn): Schaft, offener Glockenstuhl, Glocke, Spitze, Kreuz
  const tz = 1.0;
  b.add(bb(0.8, 0.9, 0.8, wall, 0, 3.4, tz));
  b.add(bb(0.9, 0.06, 0.9, "#e5ddca", 0, 4.3, tz));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) b.add(bb(0.1, 0.75, 0.1, wall, sx * 0.35, 4.36, tz + sz * 0.35));
  b.add(bb(0.9, 0.06, 0.9, "#e5ddca", 0, 5.11, tz));
  b.add(cb(0.13, 0.2, 0.3, "#e0b341", 0, 4.4, tz, 8));
  b.add({ geo: ico(0.04), color: IRON, pos: [0, 4.38, tz] });
  b.add({ geo: cyl(0, 0.62, 0.9, 4), color: slate, pos: [0, 5.62, tz], rot: [0, Math.PI / 4, 0] });
  b.add(bb(0.07, 0.55, 0.07, IRON, 0, 6.05, tz));
  b.add(bx(0.32, 0.07, 0.07, IRON, 0, 6.3, tz));

  // Umgebung: Hecken, Blumentöpfe, Plattenweg, Bank, Blumen
  for (const s of [-1, 1]) {
    b.add(
      sit({
        geo: ico(0.42, 1),
        color: at(p.bushes, s + 1),
        pos: [s * 1.75, 0, 1.45],
        scale: [1, 0.85, 1],
      }),
    );
    b.add(cb(0.14, 0.1, 0.22, "#b5593a", s * 0.85, 0.1, 2.3, 8));
    b.add({ geo: ico(0.13), color: at(p.flowers, s + 2), pos: [s * 0.85, 0.42, 2.3] });
  }
  for (const [i, z] of [2.75, 3.15].entries()) {
    b.add(bb(0.9 - i * 0.1, 0.04, 0.4, p.paving, i ? -0.06 : 0.05, 0, z));
  }
  b.add(bx(0.4, 0.05, 1.1, WOOD_LIGHT, -1.9, 0.45, 0.6));
  b.add(bx(0.05, 0.4, 1.1, WOOD_LIGHT, -1.72, 0.7, 0.6));
  for (const x of [-2.05, -1.75])
    for (const z of [0.15, 1.05]) b.add(bb(0.06, 0.43, 0.06, WOOD, x, 0, z));
  for (let i = 0; i < 5; i++) {
    b.body.push(...flower(1.75 + (i % 2) * 0.22, -1.4 + i * 0.55, at(p.flowers, i), 0.24));
  }
  b.body.push(...tuft(-1.9, -1.4, at(p.bushes, 1), 0));
  b.body.push(...tuft(-1.95, -2.2, at(p.bushes, 2), 1));
  return { body: b.body, glow: b.glow };
}

/** Steinkreis: neun aufrechte Steine in unterschiedlicher Höhe, einer liegt umgestürzt in der Lücke, Altarstein in der Mitte. */
function steinkreis({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const n = 9;
  const R = 3.1;
  const gap = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const tone = darken(at(p.rocks, i), 0.9 + rnd() * 0.14);
    const w = 0.55 + rnd() * 0.25;
    if (i === gap) {
      // umgestürzt: liegt tangential, Fuss zeigt zur Mitte
      body.push(
        sit({
          geo: cyl(w * 0.4, w * 0.55, 1.9, 5),
          color: tone,
          pos: [Math.sin(a) * (R - 0.25), 0, Math.cos(a) * (R - 0.25)],
          rot: [0, a, Math.PI / 2],
          scale: [1.2, 1, 0.85],
        }),
      );
      body.push(
        sit({
          geo: ico(0.34),
          color: at(p.bushes, 0),
          pos: [Math.sin(a) * (R - 0.25), 0, Math.cos(a) * (R - 0.25)],
          scale: [1.7, 0.4, 1.1],
          rot: [0, a, 0],
        }),
      );
      continue;
    }
    const h = 1.1 + rnd() * 0.9;
    const x = Math.sin(a) * R;
    const z = Math.cos(a) * R;
    body.push({
      geo: cyl(w * 0.4, w * 0.6, h, 5),
      color: tone,
      pos: [x, h / 2, z],
      rot: [0, a + rnd() * 0.3, 0],
      scale: [1.25, 1, 0.75],
    });
    // Moosfuss
    body.push(
      sit({
        geo: ico(0.3),
        color: at(p.bushes, i),
        pos: [x * 1.02, 0, z * 1.02],
        scale: [1.2, 0.35, 1.2],
      }),
    );
  }
  // Altarstein in der Mitte, kleine Steine, Gras und Blumen
  body.push(
    sit({
      geo: rock(0.8),
      color: darken(at(p.rocks, 1), 0.95),
      pos: [0, 0, 0],
      rot: [0, 0.5, 0],
      scale: [1.5, 0.38, 1.1],
    }),
  );
  body.push(stone(0.16, at(p.rocks, 2), 1.4, 0.9, 0.6));
  body.push(stone(0.13, at(p.rocks, 0), -1.1, 1.3, 1.4));
  body.push(stone(0.18, at(p.rocks, 1), -1.3, -1.0, 2.2));
  body.push(stone(0.12, at(p.rocks, 2), 3.5, -1.0, 0.3));
  body.push(stone(0.15, at(p.rocks, 0), -3.2, 1.8, 1.9));
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.9 + rnd() * 2.3;
    body.push(...tuft(Math.sin(a) * r, Math.cos(a) * r, at(p.bushes, i), i));
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 1.2 + rnd() * 1.6;
    body.push(...flower(Math.sin(a) * r, Math.cos(a) * r, at(p.flowers, i), 0.2 + rnd() * 0.1));
  }
  return { body };
}

/** Heuballen: Pyramide aus drei Rundballen, ein liegender und ein stehender Ballen, loser Heuhaufen mit Heugabel. */
function heuhaufen({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const hay = [STRAW, "#d9b85c", "#ecd283"].map((c) => mix(c, p.grassHill, 0.12));
  const twine = "#a8873a";
  const R = 0.62;
  const bale = (x: number, y0: number, z: number, axis: "x" | "z" | "y", i: number) => {
    // Schnurringe und Stirnscheiben stehen minimal über dem Ballen: 2 cm anheben, damit nichts im Boden steckt
    const y = y0 + 0.02;
    const len = axis === "y" ? 1.2 : 1.3;
    const rot: V3 =
      axis === "x" ? [0, 0, Math.PI / 2] : axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    body.push({ geo: cyl(R, R, len, 12), color: at(hay, i), pos: [x, y, z], rot });
    const dir = axis === "x" ? [1, 0, 0] : axis === "z" ? [0, 0, 1] : [0, 1, 0];
    for (const t of [-0.35, 0.35]) {
      body.push({
        geo: cyl(R + 0.012, R + 0.012, 0.05, 10),
        color: twine,
        pos: [x + dir[0] * t, y + dir[1] * t, z + dir[2] * t],
        rot,
      });
    }
    for (const s of [-1, 1]) {
      const o = (len / 2 + 0.006) * s;
      body.push({
        geo: cyl(0.42, 0.42, 0.012, 8),
        color: darken(at(hay, i), 0.86),
        pos: [x + dir[0] * o, y + dir[1] * o, z + dir[2] * o],
        rot,
      });
      const o2 = (len / 2 + 0.012) * s;
      body.push({
        geo: cyl(0.2, 0.2, 0.012, 8),
        color: mix(at(hay, i), "#ffffff", 0.15),
        pos: [x + dir[0] * o2, y + dir[1] * o2, z + dir[2] * o2],
        rot,
      });
    }
  };
  // Pyramide links
  bale(-2.3, R, -1.1, "x", 0);
  bale(-2.3, R, 0.15, "x", 1);
  bale(-2.3, R + R * Math.sqrt(3), -0.475, "x", 2);
  // einzelne Ballen
  bale(-0.4, R, 1.4, "z", 1);
  bale(-0.35, 0.6, -1.45, "y", 0);

  // Loser Haufen rechts: drei flache Kuppen, Halme am Rand, Heugabel
  const px = 1.85;
  const pz = 0.2;
  body.push(sit({ geo: ico(0.9, 1), color: hay[0], pos: [px, 0, pz], scale: [1.25, 0.8, 1.15] }));
  body.push(
    sit({ geo: ico(0.6, 1), color: hay[2], pos: [px + 0.7, 0, pz + 0.55], scale: [1.2, 0.8, 1] }),
  );
  body.push(
    sit({ geo: ico(0.5, 1), color: hay[1], pos: [px - 0.6, 0, pz - 0.7], scale: [1.2, 0.75, 1] }),
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd();
    const r = 1.05 + rnd() * 0.4;
    body.push(
      sit({
        geo: cyl(0, 0.04, 0.3, 4),
        color: at(hay, i),
        pos: [px + Math.sin(a) * r, 0, pz + Math.cos(a) * r],
        rot: [Math.PI / 2 + rnd() * 0.6, rnd() * 3, 0],
      }),
    );
  }
  const top: V3 = [px + 0.3, 1.95, pz + 0.55];
  const foot: V3 = [px - 0.05, 0.5, pz + 0.12];
  body.push(between(top, foot, 0.028, 0.028, WOOD_LIGHT, 5));
  body.push(
    between(
      [foot[0] - 0.12, foot[1] - 0.02, foot[2] + 0.04],
      [foot[0] + 0.12, foot[1] + 0.02, foot[2] - 0.04],
      0.022,
      0.022,
      "#9aa3ab",
      4,
    ),
  );
  for (const s of [-1, 0, 1]) {
    body.push(
      between(
        [foot[0] + s * 0.1, foot[1], foot[2] - s * 0.03],
        [foot[0] + s * 0.1 - 0.05, foot[1] - 0.35, foot[2] - 0.04],
        0.018,
        0.004,
        "#9aa3ab",
        3,
      ),
    );
  }
  // Büsche und Blumen am Rand
  body.push(...tuft(0.8, -1.8, at(p.bushes, 0), 0));
  body.push(...tuft(-3.2, 1.5, at(p.bushes, 1), 1));
  body.push(...flower(0.9, 1.2, at(p.flowers, 0), 0.24));
  body.push(...flower(1.1, 1.35, at(p.flowers, 3), 0.22));
  return { body };
}

/** Holzlager: gestapelte Rundhölzer (Stirnseiten hell) unter einem Pultdach mit Rückwand, Hackklotz mit Beil. */
function holzlager({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const r = 0.15;
  const bark = ["#7a5233", "#8a6040", "#6b4423"];
  const cut = ["#d9b483", "#c9a070", "#e0bf92"];
  const logSide = new THREE.CylinderGeometry(r, r, 1.0, 6, 1, true);
  logSide.rotateX(Math.PI / 2);
  const logCap = new THREE.CircleGeometry(r * 0.94, 6);
  const rows = 5;
  for (let row = 0; row < rows; row++) {
    const cnt = row % 2 ? 9 : 10;
    const off = row % 2 ? 0.15 : 0;
    for (let i = 0; i < cnt; i++) {
      const x = -1.35 + off + i * 0.3;
      const y = 0.12 + r + row * 0.26;
      const k = (row * 7 + i * 3) % 3;
      body.push({ geo: logSide, color: bark[k], pos: [x, y, 0] });
      body.push({ geo: logCap, color: cut[(k + row) % 3], pos: [x, y, 0.501] });
    }
  }
  // Auflager, Rückwand, Pfosten, Dach
  for (const z of [-0.3, 0.3]) body.push(bb(3.3, 0.1, 0.12, WOOD, 0, 0, z));
  body.push(bb(3.8, 1.55, 0.06, "#8a6a4a", 0, 0, -0.66));
  for (let i = 0; i < 6; i++)
    body.push(bb(0.03, 1.5, 0.02, darken("#8a6a4a", 0.8), -1.6 + i * 0.64, 0, -0.62));
  for (const s of [-1, 1]) {
    body.push(bb(0.12, 1.9, 0.12, WOOD, s * 1.88, 0, 0.62));
    body.push(bb(0.12, 1.55, 0.12, WOOD, s * 1.88, 0, -0.62));
    for (const y of [0.55, 1.05]) body.push(bx(0.05, 0.1, 1.2, WOOD_LIGHT, s * 1.88, y, 0));
  }
  body.push(bb(0.12, 1.55, 0.12, WOOD, 0, 0, -0.62));
  const slope = Math.atan2(0.35, 1.24);
  const roofC = "#8b5e3c";
  body.push(bx(3.96, 0.07, 1.8, roofC, 0, 1.8, 0.22, [-slope, 0, 0]));
  // Dachlatten quer über die Schräge, Stirnbrett vorn
  for (let i = 0; i < 6; i++) {
    const z = -0.45 + i * 0.28;
    body.push(
      bx(3.96, 0.03, 0.06, darken(roofC, 0.8), 0, 1.85 + (z - 0.22) * Math.tan(slope), z, [
        -slope,
        0,
        0,
      ]),
    );
  }
  body.push(
    bx(3.96, 0.1, 0.05, WOOD_DARK, 0, 1.8 + (1.06 - 0.22) * Math.tan(slope) - 0.06, 1.06, [
      -slope,
      0,
      0,
    ]),
  );
  // Hackklotz mit Beil, lose Scheite, Späne
  body.push(cb(0.26, 0.28, 0.45, TRUNK, 1.4, 0, 0.85, 8));
  body.push(cb(0.24, 0.24, 0.012, "#d9b483", 1.4, 0.45, 0.85, 8));
  body.push(between([1.43, 0.48, 0.85], [1.05, 0.9, 0.8], 0.022, 0.025, WOOD_LIGHT, 5));
  body.push(bx(0.16, 0.12, 0.04, IRON, 1.46, 0.5, 0.85, [0, 0, 0.5]));
  for (const [x, z, a] of [
    [-1.3, 0.95, 0.2],
    [-0.8, 1.0, -0.1],
    [-1.05, 0.88, 0.1],
  ] as [number, number, number][]) {
    body.push(
      sit({
        geo: cyl(0.1, 0.1, 0.8, 6),
        color: at(bark, x < -1 ? 0 : 1),
        pos: [x, 0, z],
        rot: [0, a, Math.PI / 2],
      }),
    );
  }
  for (let i = 0; i < 7; i++) {
    body.push(
      bb(0.1 + rnd() * 0.05, 0.015, 0.05, at(cut, i), 0.9 + rnd() * 1.0, 0, 0.8 + rnd() * 0.3, [
        0,
        rnd() * 3,
        0,
      ]),
    );
  }
  body.push(...tuft(-1.7, 1.0, at(p.bushes, 0), 0));
  return { body };
}

/** Bienenstöcke: vier bunte Beuten mit Satteldeckel auf einer langen Holzbank, Smoker, Blumen davor. */
function bienenstoecke({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  body.push(bx(4.2, 0.06, 0.6, WOOD_LIGHT, 0, 0.42, 0));
  for (const x of [-1.9, 0, 1.9])
    for (const z of [-0.22, 0.22]) body.push(bb(0.1, 0.39, 0.1, WOOD, x, 0, z));
  body.push(bx(4.0, 0.05, 0.05, WOOD, 0, 0.18, 0.22));
  const colors = [0, 1, 2, 3].map((i) => mix(at(p.flowers, i + 1), "#ffffff", 0.3));
  colors.forEach((c, i) => {
    const x = -1.5 + i;
    body.push(bb(0.68, 0.34, 0.56, c, x, 0.45, 0));
    body.push(bb(0.66, 0.3, 0.54, darken(c, 0.93), x, 0.79, 0));
    body.push(bx(0.7, 0.012, 0.58, darken(c, 0.7), x, 0.79, 0));
    body.push(bb(0.74, 0.04, 0.64, "#e8e2d0", x, 1.09, 0));
    body.push({ geo: gable(0.7, 0.16, 0.6, 0.02), color: "#d9d2bd", pos: [x, 1.17, 0] });
    body.push(bx(0.3, 0.035, 0.02, "#2a1f18", x, 0.5, 0.285));
    body.push(bx(0.36, 0.02, 0.1, WOOD_LIGHT, x, 0.47, 0.33));
  });
  body.push(cb(0.05, 0.06, 0.15, IRON, 1.95, 0.45, 0.1, 7));
  body.push({ geo: cyl(0, 0.05, 0.09, 6), color: IRON, pos: [1.95, 0.645, 0.1] });
  // Blumen vor der Bank, hohe Stauden dahinter, Gras
  for (let i = 0; i < 14; i++) {
    const x = -1.95 + i * 0.3 + (rnd() - 0.5) * 0.1;
    const z = 0.55 + rnd() * 0.4;
    body.push(...flower(x, z, at(p.flowers, i), 0.18 + rnd() * 0.14));
  }
  [-1.8, 0, 1.8].forEach((x, k) =>
    body.push(...flower(x, -0.66, at(p.flowers, k + 5), 0.95, "#4f8f47")),
  );
  body.push(...tuft(-2.0, 0.5, at(p.bushes, 0), 0));
  body.push(...tuft(2.0, 0.55, at(p.bushes, 1), 1));
  return { body };
}

/** Gemüsefeld: sechs Beetreihen mit Erde und Nutzpflanzen, in der Mitte die Vogelscheuche mit Hut und Krähe. */
function vogelscheuche({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const rowsZ = [-2.5, -1.6, -0.7, 0.7, 1.6, 2.5];
  for (const z of rowsZ) body.push(bb(5.6, 0.12, 0.55, SOIL, 0, 0, z));
  const green = (i: number) => at(p.bushes, i);
  const top = 0.12;
  // Reihe 1: Sonnenblumen
  for (const x of [-2.1, -0.7, 0.7, 2.1]) {
    const h = 1.1 + rnd() * 0.3;
    body.push(cb(0.025, 0.032, h, "#4f8f47", x, top, rowsZ[0], 5));
    body.push({
      geo: cyl(0.18, 0.18, 0.04, 8),
      color: "#f2c230",
      pos: [x, top + h, rowsZ[0] + 0.02],
      rot: [Math.PI / 2 - 0.2, 0, 0],
    });
    body.push({
      geo: cyl(0.1, 0.1, 0.05, 8),
      color: TRUNK,
      pos: [x, top + h - 0.004, rowsZ[0] + 0.04],
      rot: [Math.PI / 2 - 0.2, 0, 0],
    });
  }
  // Reihe 2: Kohlköpfe
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.8;
    body.push(disc(0.22, 0.22, 0.04, green(i), x, top + 0.02, rowsZ[1], 8));
    body.push({
      geo: ico(0.16),
      color: i === 3 ? "#8e5b9b" : mix(green(i + 1), "#d4e8a0", 0.4),
      pos: [x, top + 0.14, rowsZ[1]],
    });
  }
  // Reihe 3: Karotten (Kraut)
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.8;
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + i;
      const d = new THREE.Vector3(Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5).normalize();
      body.push({
        geo: cyl(0, 0.035, 0.24, 4),
        color: green(b + i),
        pos: [x + d.x * 0.1, top + d.y * 0.1, rowsZ[2] + d.z * 0.1],
        rot: orient([d.x, d.y, d.z]),
      });
    }
  }
  // Reihe 4: Salat
  for (let i = 0; i < 8; i++) {
    body.push({
      geo: ico(0.14),
      color: at(["#a9d46f", "#8fc65a", "#b8de80"], i),
      pos: [-2.45 + i * 0.7, top + 0.07, rowsZ[3]],
      scale: [1.3, 0.6, 1.3],
    });
  }
  // Reihe 5: Tomaten an Stäben
  for (const x of [-2.0, -0.7, 0.7, 2.0]) {
    body.push(bb(0.03, 1.0, 0.03, WOOD, x, top, rowsZ[4]));
    body.push({
      geo: ico(0.2),
      color: green(1),
      pos: [x, top + 0.42, rowsZ[4]],
      scale: [1, 1.3, 1],
    });
    for (let k = 0; k < 2; k++) {
      body.push({
        geo: ico(0.065),
        color: "#d93a2b",
        pos: [x + (k ? 0.17 : -0.15), top + 0.3 + k * 0.2, rowsZ[4] + 0.1],
      });
    }
  }
  // Reihe 6: Lauch
  for (let i = 0; i < 13; i++) {
    body.push(
      cb(0.02, 0.04, 0.34, i % 2 ? "#6fa84f" : "#8fc65a", -2.4 + i * 0.4, top, rowsZ[5], 4),
    );
  }

  // Vogelscheuche
  const shirt = mix(at(p.flowers, 1), "#8a6a4a", 0.35);
  body.push(cb(0.4, 0.5, 0.1, SOIL, 0, 0, 0, 10));
  body.push(cb(0.045, 0.055, 2.0, WOOD, 0, 0.1, 0, 6));
  body.push(cylAxisX(0.04, 1.5, WOOD, 0, 1.5, 0, 6));
  body.push(cb(0.2, 0.26, 0.62, shirt, 0, 1.0, 0, 8));
  body.push(cylAxisX(0.09, 1.2, shirt, 0, 1.5, 0, 7));
  for (const s of [-1, 1]) {
    body.push(cb(0.09, 0.1, 0.65, "#4a6a8a", s * 0.1, 0.35, 0, 7));
    body.push({ geo: ico(0.09), color: STRAW, pos: [s * 0.68, 1.5, 0], scale: [1.4, 0.8, 0.8] });
    body.push(bx(0.1, 0.1, 0.02, "#d9c9a0", s * 0.12, 0.6, 0.1));
  }
  body.push({ geo: ico(0.2, 1), color: "#e8d8a8", pos: [0, 1.85, 0], scale: [1, 1.1, 1] });
  for (const s of [-1, 1]) body.push({ geo: ico(0.025), color: IRON, pos: [s * 0.075, 1.9, 0.18] });
  body.push(bx(0.12, 0.02, 0.02, IRON, 0, 1.78, 0.19));
  body.push(cb(0.4, 0.4, 0.03, "#7a5a3a", 0, 2.01, 0, 10));
  body.push(cb(0.16, 0.2, 0.22, "#6b4a2b", 0, 2.04, 0, 8));
  body.push(cb(0.205, 0.205, 0.04, at(p.flowers, 0), 0, 2.07, 0, 8));
  for (const x of [-0.25, 0.05, 0.3])
    body.push({
      geo: cyl(0, 0.03, 0.2, 4),
      color: STRAW,
      pos: [x, 1.7, 0.1],
      rot: [0.3, 0, x * 2],
    });
  // Krähe auf dem rechten Arm
  const cx = 0.5;
  body.push({ geo: ico(0.1), color: "#2a2a30", pos: [cx, 1.68, 0], scale: [0.85, 0.8, 1.5] });
  body.push({ geo: ico(0.055), color: "#2a2a30", pos: [cx, 1.78, 0.13] });
  body.push({
    geo: cyl(0, 0.02, 0.08, 4),
    color: "#e8a030",
    pos: [cx, 1.77, 0.22],
    rot: [Math.PI / 2, 0, 0],
  });
  body.push(bx(0.08, 0.02, 0.18, "#2a2a30", cx, 1.67, -0.2, [0.3, 0, 0]));
  return { body };
}

/** Wegkreuz: Steinsockel, Holzkreuz mit Schindeldach, Schild, Blumen und Windlicht am Fuss. */
function wegkreuz({ p }: Ctx): Built {
  const body: Part[] = [];
  const stoneTone = at(p.rocks, 0);
  body.push(bb(0.7, 0.12, 0.7, darken(stoneTone, 0.92), 0, 0, 0));
  body.push(bb(0.46, 0.25, 0.46, stoneTone, 0, 0.12, 0));
  body.push(bb(0.54, 0.05, 0.54, mix(stoneTone, "#ffffff", 0.2), 0, 0.37, 0));
  const wood = "#7a4a2b";
  body.push(bb(0.16, 1.95, 0.16, wood, 0, 0.42, 0));
  body.push(bx(0.9, 0.14, 0.14, wood, 0, 1.9, 0));
  body.push(bb(0.26, 0.3, 0.03, "#e8d9b0", 0, 1.0, 0.1));
  body.push(bx(0.035, 0.18, 0.02, WOOD_DARK, 0, 1.15, 0.115));
  body.push(bx(0.12, 0.035, 0.02, WOOD_DARK, 0, 1.2, 0.115));
  // Schindeldach über dem Kreuz
  body.push({ geo: gable(1.1, 0.3, 0.5, 0.03), color: "#5a4332", pos: [0, 2.28, 0] });
  body.push(bx(0.07, 0.07, 0.56, WOOD_DARK, 0, 2.62, 0));
  for (const s of [-1, 1])
    body.push(bx(0.025, 0.06, 0.5, darken("#5a4332", 0.8), s * 0.26, 2.4, 0, [0, 0, -s * 0.5]));
  // Blumen, Büsche, Windlicht
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const r = 0.62 + (i % 2) * 0.1;
    body.push(...flower(Math.sin(a) * r, Math.cos(a) * r, at(p.flowers, i), 0.2 + (i % 3) * 0.05));
  }
  body.push(
    sit({ geo: ico(0.2, 1), color: at(p.bushes, 0), pos: [0.5, 0, -0.45], scale: [1, 0.85, 1] }),
  );
  body.push(sit({ geo: ico(0.17, 1), color: at(p.bushes, 1), pos: [-0.5, 0, -0.5] }));
  body.push(cb(0.055, 0.05, 0.1, "#e8f0f4", 0.2, 0, 0.42, 7));
  body.push({ geo: ico(0.03), color: "#f0c060", pos: [0.2, 0.08, 0.42] });
  return { body };
}

/** Unregelmässiger Fels: Ikosaeder, Eckpunkte deterministisch verschoben, Unterseite abgeflacht, steht auf y = 0. */
function boulder(r: number, seed: number, scale: V3): { geo: THREE.BufferGeometry; top: V3[] } {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const pos = g.attributes.position;
  const hash = (x: number, y: number, z: number) => {
    const s =
      Math.sin(
        Math.round(x * 100) * 12.9898 +
          Math.round(y * 100) * 78.233 +
          Math.round(z * 100) * 37.719 +
          seed * 17.13,
      ) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = 0.84 + hash(x, y, z) * 0.3;
    pos.setXYZ(i, x * f * scale[0], Math.max(y * f, -0.62 * r) * scale[1], z * f * scale[2]);
  }
  g.computeBoundingBox();
  const minY = g.boundingBox!.min.y;
  g.translate(0, -minY, 0);
  g.computeVertexNormals();
  g.computeBoundingBox();
  const maxY = g.boundingBox!.max.y;
  const top: V3[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > maxY * 0.72) top.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
  }
  return { geo: g, top };
}

/** Findlinge: drei grosse, unregelmässige Felsblöcke mit Moos, dazu Kiesel, Gras und Blumen. */
function findlinge({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const spec: { r: number; x: number; z: number; yaw: number; sc: V3 }[] = [
    { r: 1.1, x: -0.7, z: 0.3, yaw: 0.5, sc: [1.25, 1.05, 1.0] },
    { r: 0.8, x: 1.5, z: -0.8, yaw: 1.7, sc: [1.1, 0.95, 1.0] },
    { r: 0.55, x: 0.7, z: 1.6, yaw: 0.2, sc: [1.1, 0.9, 1.0] },
  ];
  spec.forEach((s, i) => {
    const bd = boulder(s.r, i + 1, s.sc);
    body.push({
      geo: bd.geo,
      color: darken(at(p.rocks, i), 0.88 + rnd() * 0.12),
      pos: [s.x, 0, s.z],
      rot: [0, s.yaw, 0],
    });
    // Moos auf der Oberseite: zwei Polster an hoch liegenden Eckpunkten
    const picks: V3[] = [];
    for (const v of bd.top) {
      if (picks.length < 2 && picks.every((q) => Math.hypot(q[0] - v[0], q[2] - v[2]) > s.r * 0.7))
        picks.push(v);
    }
    picks.forEach((v, k) => {
      const [wx, wz] = yawed(s.x, s.z, v[0] * 0.92, v[2] * 0.92, s.yaw);
      body.push({
        geo: ico(s.r * 0.26),
        color: mix(at(p.bushes, i + k), "#5f7f3a", 0.4),
        pos: [wx, v[1] - 0.02, wz],
        scale: [1.2, 0.45, 1.2],
      });
    });
    // Moos am Fuss
    const [fx, fz] = yawed(s.x, s.z, s.r * 0.9, s.r * 0.5, s.yaw);
    body.push(
      sit({
        geo: ico(s.r * 0.3),
        color: at(p.bushes, i),
        pos: [fx, 0, fz],
        scale: [1.3, 0.4, 1.1],
      }),
    );
  });
  body.push(stone(0.16, at(p.rocks, 2), -1.9, -1.2, 0.4));
  body.push(stone(0.12, at(p.rocks, 0), 0.0, -1.0, 1.3));
  body.push(stone(0.2, at(p.rocks, 1), -0.2, 1.7, 2.4));
  body.push(stone(0.13, at(p.rocks, 2), 2.0, 0.6, 0.9));
  body.push(stone(0.1, at(p.rocks, 0), 1.0, 0.7, 0.1));
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.5 + rnd() * 2.0;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    // nicht in den Fels stellen
    if (spec.some((s) => Math.hypot(x - s.x, z - s.z) < s.r * 1.55)) continue;
    body.push(...tuft(x, z, at(p.bushes, i), i));
  }
  for (const [x, z, k] of [
    [-2.0, 0.9, 0],
    [0.2, -1.5, 1],
    [2.2, -0.2, 2],
  ] as [number, number, number][]) {
    body.push(...flower(x, z, at(p.flowers, k), 0.22));
  }
  return { body };
}

/** Schaukelbaum: grosse Laubkrone, kräftiger Stamm mit waagrechtem Ast, Seilschaukel mit Brett, Wurzeln, Falllaub. */
function schaukelbaum({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  body.push(cb(0.32, 0.5, 2.8, TRUNK, 0, 0, 0, 9));
  body.push(cb(0.2, 0.32, 1.6, TRUNK, 0, 2.7, 0, 8));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    body.push(
      between(
        [Math.sin(a) * 0.3, 0.45, Math.cos(a) * 0.3],
        [Math.sin(a) * 0.95, 0.07, Math.cos(a) * 0.95],
        0.16,
        0.05,
        TRUNK,
        5,
      ),
    );
  }
  // dicker Ast nach +x, leicht ansteigend
  body.push(between([0.15, 2.5, 0.05], [2.0, 2.75, 0.3], 0.2, 0.1, darken(TRUNK, 0.95), 7));
  body.push(between([-0.1, 3.0, 0.0], [-1.1, 3.5, 0.3], 0.14, 0.07, TRUNK, 6));
  // Krone
  const crown: { r: number; pos: V3; sc?: V3 }[] = [
    { r: 1.5, pos: [0, 4.4, 0], sc: [1, 0.85, 1] },
    { r: 1.1, pos: [-1.0, 3.9, 0.4] },
    { r: 1.1, pos: [0.9, 4.1, -0.7] },
    { r: 1.0, pos: [0.3, 3.8, 1.0] },
    { r: 1.05, pos: [-0.5, 4.0, -1.0] },
    { r: 0.95, pos: [1.0, 4.0, 0.55] },
    { r: 0.8, pos: [-0.2, 5.1, 0.2] },
  ];
  crown.forEach((c, i) =>
    body.push({ geo: ico(c.r, 1), color: at(p.leaves, i), pos: c.pos, scale: c.sc }),
  );
  // Schaukel: zwei Seile vom Ast, Brett knapp über dem Boden
  const sx = [1.2, 1.7];
  const topY = [2.66, 2.72];
  sx.forEach((x, i) => {
    body.push(bb(0.03, topY[i] - 0.52, 0.03, ROPE, x, 0.52, 0.2));
    body.push({ geo: ico(0.035), color: ROPE, pos: [x, topY[i] - 0.02, 0.2] });
  });
  body.push(bx(0.7, 0.05, 0.22, WOOD_LIGHT, 1.45, 0.5, 0.2));
  // Boden: Falllaub, Gras, Blumen
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.9 + rnd() * 1.8;
    body.push(disc(0.1, 0.08, 0.015, at(p.leaves, i), Math.sin(a) * r, 0.008, Math.cos(a) * r, 5));
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 1.0 + rnd() * 1.7;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (Math.hypot(x - 1.45, z - 0.2) < 0.8) continue;
    body.push(...(i % 2 ? flower(x, z, at(p.flowers, i), 0.22) : tuft(x, z, at(p.bushes, i), i)));
  }
  return { body };
}

/** Senkrechte Mauerspalten mit unregelmässiger Oberkante (Ruinen): `height(s)` gibt die Höhe bei s ∈ [0, 1] vor. */
function crumbleWall(
  body: Part[],
  rnd: () => number,
  tones: string[],
  axis: "x" | "z",
  fixed: number,
  from: number,
  to: number,
  thick: number,
  height: (s: number) => number,
  top: V3[],
) {
  const L = to - from;
  let pos = 0;
  let k = 0;
  while (pos < L - 0.05) {
    const len = Math.min(L - pos, 0.55 + rnd() * 0.4);
    const s = (pos + len / 2) / L;
    const h = Math.max(0.28, height(s) + (rnd() - 0.5) * 0.35);
    const c = from + pos + len / 2;
    const tone = darken(at(tones, k), 0.9 + rnd() * 0.18);
    const [w, d] = axis === "x" ? [len - 0.02, thick] : [thick, len - 0.02];
    const [x, z] = axis === "x" ? [c, fixed] : [fixed, c];
    body.push(bx(w, h, d, tone, x, h / 2, z));
    // Steinlagen als schmale Fugenbänder
    for (const y of [0.55, 1.1, 1.65, 2.2]) {
      if (y < h - 0.12) body.push(bx(w + 0.02, 0.03, d + 0.02, darken(tone, 0.82), x, y, z));
    }
    top.push([x, h, z]);
    pos += len;
    k++;
  }
}

/** Ruine: bröckelnde Steinmauern um einen Hof, ein Rundbogenfenster, Fundamentreste, Säulenrest, Schutt und Efeu. */
function ruine({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const tones = [at(p.rocks, 0), at(p.rocks, 1), at(p.rocks, 2), STONE].map((c) =>
    mix(c, "#9a8f80", 0.35),
  );
  const thick = 0.55;
  const tops: V3[] = [];
  const wallZ = -2.6;
  const leftX = -3.4;
  // Rückwand links vom Fenster, hohe Ecke
  crumbleWall(body, rnd, tones, "x", wallZ, -3.4, -1.5, thick, (s) => 2.9 - s * 0.7, tops);
  // unter und über dem Fenster
  body.push(bb(1.0, 0.9, thick, darken(tones[0], 0.95), -1.0, 0, wallZ));
  body.push(bx(1.2, 0.1, thick + 0.12, mix(STONE, "#ffffff", 0.2), -1.0, 0.95, wallZ));
  body.push(bb(1.0, 0.3, thick, darken(tones[1], 0.95), -1.0, 2.55, wallZ));
  crumbleWall(body, rnd, tones, "x", wallZ, -0.5, 3.0, thick, (s) => 2.5 - s * 1.8, tops);
  // Fensterbogen aus neun Keilsteinen über der Kämpferlinie y = 1.7
  const spring = 1.7;
  for (let k = 0; k < 9; k++) {
    const th = (Math.PI * (k + 0.5)) / 9;
    const rc = 0.65;
    const key = k === 4;
    body.push({
      geo: box(0.25, key ? 0.36 : 0.3, thick + 0.06),
      color: key ? mix(STONE, "#ffffff", 0.3) : darken(STONE, k % 2 ? 0.88 : 0.97),
      pos: [-1.0 + rc * Math.cos(th), spring + rc * Math.sin(th), wallZ],
      rot: [0, 0, th - Math.PI / 2],
    });
  }
  // Seitenwände: links hoch, rechts niedriger Stumpf
  crumbleWall(
    body,
    rnd,
    tones,
    "z",
    leftX,
    -2.6 + thick / 2,
    0.9,
    thick,
    (s) => 2.6 - s * 1.9,
    tops,
  );
  crumbleWall(
    body,
    rnd,
    tones,
    "z",
    3.0,
    -2.6 + thick / 2,
    -0.3,
    thick,
    (s) => 1.7 - s * 1.0,
    tops,
  );
  // niedrige Fundamentreste an der Front mit Tordurchgang
  crumbleWall(body, rnd, tones, "x", 1.5, -3.4, -1.7, thick, () => 0.38, tops);
  crumbleWall(body, rnd, tones, "x", 1.5, -0.5, 0.9, thick, () => 0.3, tops);
  crumbleWall(body, rnd, tones, "x", 1.5, 1.7, 3.0, thick, () => 0.42, tops);
  // Bewuchs auf den Mauerkronen
  tops
    .filter((_, i) => i % 3 === 0)
    .forEach(([x, y, z], i) => {
      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * Math.PI * 2 + i;
        body.push({
          geo: cyl(0, 0.035, 0.22, 4),
          color: at(p.bushes, b + i),
          pos: [x + Math.sin(a) * 0.1, y + 0.1, z + Math.cos(a) * 0.1],
          rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35],
        });
      }
    });
  // Säulenrest und gestürzte Trommel
  body.push(cb(0.28, 0.3, 1.2, mix(STONE, "#ffffff", 0.15), 1.2, 0, -0.7, 8));
  body.push(cb(0.22, 0.28, 0.2, darken(STONE, 0.9), 1.2, 1.2, -0.7, 8));
  body.push(
    sit({
      geo: cyl(0.27, 0.27, 0.85, 8),
      color: mix(STONE, "#ffffff", 0.1),
      pos: [2.0, 0, 0.6],
      rot: [0, 0.6, Math.PI / 2],
    }),
  );
  // Bodenplatten im Hof
  const paving = darken(p.paving, 0.85);
  for (const [x, z, y] of [
    [-1.5, -1.3, 0],
    [-0.4, -1.4, 0.01],
    [-1.2, -0.3, 0],
    [0.2, -0.2, 0.01],
    [-2.2, -0.9, 0.01],
  ] as [number, number, number][]) {
    body.push(bb(0.9, 0.05, 0.7, paving, x, y, z, [0, rnd() * 0.3, 0]));
  }
  // Schutt: Steine und Blöcke am Boden, nur auf freien Flächen (nicht in Mauern, Säule oder Platten)
  const freeSpot = (x: number, z: number) =>
    !(x < -2.95 && z < 1.0) &&
    !(x > 2.6 && z < -0.2) &&
    Math.abs(z - wallZ) > 0.6 &&
    Math.abs(z - 1.5) > 0.6 &&
    Math.hypot(x - 1.2, z + 0.7) > 0.8 &&
    Math.hypot(x - 2.0, z - 0.6) > 1.0 &&
    !(x > -2.8 && x < 0.7 && z > -1.8 && z < -0.0);
  let placed = 0;
  for (let tries = 0; tries < 60 && placed < 9; tries++) {
    const x = -3.5 + rnd() * 6.9;
    const z = -2.3 + rnd() * 5.5;
    if (!freeSpot(x, z)) continue;
    body.push(stone(0.14 + rnd() * 0.16, at(tones, placed), x, z, rnd() * 3));
    placed++;
  }
  let blocks = 0;
  for (let tries = 0; tries < 60 && blocks < 4; tries++) {
    const x = -3.5 + rnd() * 6.9;
    const z = -2.3 + rnd() * 5.5;
    if (!freeSpot(x, z)) continue;
    body.push(
      sit({
        geo: box(0.38, 0.22, 0.3),
        color: at(tones, blocks + 1),
        pos: [x, 0, z],
        rot: [0.1, rnd() * 3, 0.12],
      }),
    );
    blocks++;
  }
  // Efeu an der Rückwand und Büsche
  for (let i = 0; i < 6; i++) {
    const x = -3.2 + i * 0.35 + (i > 3 ? 1.2 : 0);
    const y = 0.5 + (i % 3) * 0.55;
    body.push({
      geo: ico(0.24),
      color: at(p.leaves, i),
      pos: [x, y, wallZ + thick / 2 + 0.02],
      scale: [1.1, 1.0, 0.35],
    });
  }
  body.push(
    sit({ geo: ico(0.42, 1), color: at(p.bushes, 0), pos: [-2.4, 0, 0.1], scale: [1, 0.9, 1] }),
  );
  body.push(sit({ geo: ico(0.3, 1), color: at(p.bushes, 1), pos: [2.5, 0, -1.2] }));
  for (let i = 0; i < 4; i++)
    body.push(...flower(-2.3 + i * 0.22, 0.7 + (i % 2) * 0.2, at(p.flowers, i), 0.22));
  return { body };
}

/** Rebberg: fünf Reihen Rebstöcke an Pfählen und Drähten, Laub in den Laubtönen der Stimmung, Trauben, Kisten und Fass. */
function weinberg({ p, rnd }: Ctx): Built {
  const body: Part[] = [];
  const rows = [-3.0, -1.5, 0, 1.5, 3.0];
  const grape = ["#5b2a6e", "#a3c45a", "#6b3a8a"];
  rows.forEach((z, r) => {
    body.push(bb(10.8, 0.1, 0.6, SOIL, 0, 0, z));
    for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) body.push(bb(0.09, 1.5, 0.09, WOOD, x, 0, z));
    for (const y of [0.6, 1.1, 1.5]) body.push(bx(10.6, 0.012, 0.012, "#9aa3ab", 0, y, z));
    for (let k = 0; k < 7; k++) {
      const x = -4.8 + k * 1.6 + (rnd() - 0.5) * 0.2;
      body.push(bb(0.06, 0.6, 0.06, TRUNK, x, 0.08, z));
      body.push({
        geo: octa(0.38),
        color: at(p.leaves, r + k),
        pos: [x, 0.92, z],
        scale: [2.1, 1.15, 0.6],
      });
      body.push({
        geo: octa(0.3),
        color: at(p.leaves, r + k + 1),
        pos: [x + 0.2, 1.3, z],
        scale: [2.3, 1.0, 0.6],
      });
      body.push({
        geo: octa(0.07),
        color: at(grape, r + k),
        pos: [x + (rnd() - 0.5) * 0.4, 0.62, z + 0.16],
        scale: [1, 1.5, 1],
      });
    }
  });
  // Ernte am vorderen rechten Rand: Kisten mit Trauben, Fass
  body.push(bb(0.55, 0.32, 0.4, WOOD_LIGHT, 5.0, 0, 3.55));
  body.push(bb(0.55, 0.32, 0.4, darken(WOOD_LIGHT, 0.92), 5.0, 0.32, 3.55));
  for (let i = 0; i < 3; i++)
    body.push({
      geo: octa(0.1),
      color: at(grape, i),
      pos: [4.88 + i * 0.12, 0.7, 3.55],
      scale: [1, 0.8, 1],
    });
  body.push(cb(0.28, 0.28, 0.65, "#8a5a2b", 4.2, 0, 3.55, 8));
  for (const y of [0.15, 0.5]) body.push(cb(0.295, 0.295, 0.04, IRON, 4.2, y, 3.55, 8));
  body.push(
    sit({ geo: rock(0.3), color: at(p.rocks, 0), pos: [-5.6, 0, 3.4], scale: [1.2, 0.8, 1] }),
  );
  body.push(sit({ geo: rock(0.22), color: at(p.rocks, 1), pos: [-5.2, 0, 3.7] }));
  body.push(...tuft(-4.0, 3.6, at(p.bushes, 0), 0));
  body.push(...tuft(2.5, 3.7, at(p.bushes, 1), 1));
  return { body };
}

const BUILDERS: Record<SeedObjektTyp, (c: Ctx) => Built> = {
  wassermuehle,
  faehre,
  wehr,
  fischerhuette,
  picknickplatz,
  ruderboot,
  kapelle,
  steinkreis,
  heuhaufen,
  holzlager,
  bienenstoecke,
  vogelscheuche,
  wegkreuz,
  findlinge,
  schaukelbaum,
  ruine,
  weinberg,
};

/**
 * Bauteile eines Seed-Objekts: `body` mit Vertex-Farben, `glow` = leuchtende Teile (nur Kapelle, Mühle, Fischerhütte;
 * sonst leer). Lokal um den Ursprung, Front nach +z, Boden bei y = 0, Wasseroberfläche bei y ≈ 0.05.
 * Für die Lage `quer` (Fähre, Wehr) gelten `opts.hd` (halbe Länge quer zum Fluss, Standard `spanFor(water)`) und
 * `opts.water` (Wasserbreite, Standard 6). Gleicher Typ, gleiche Palette und gleiche Optionen ergeben immer dasselbe Modell.
 */
export function seedObjectParts(
  typ: SeedObjektTyp,
  p: Palette,
  opts: { hd?: number; water?: number } = {},
): { body: Part[]; glow: Part[] } {
  const water = opts.water ?? 6;
  const hd = opts.hd ?? spanFor(water);
  const built = BUILDERS[typ]({ p, rnd: seededRandom(`seed:${typ}`), hd, water });
  return { body: built.body, glow: built.glow ?? [] };
}

/**
 * Trauerweide für Instanzen am Ufer: kurzer Stamm, gewölbte Krone, Vorhang aus weich gerundeten, hängenden
 * Zweigbündeln (zwei Ringe). Feste Farben
 * (Stamm braun, Laub hellgrün): die Szene multipliziert eine Instanzfarbe darauf. Grundfläche Kreis r ≤ 1.6, Höhe ≈ 4 m.
 */
export function willowParts(): Part[] {
  const parts: Part[] = [];
  const leaf = ["#7aa65a", "#8db86a"];
  parts.push(cb(0.2, 0.3, 1.5, "#6b4423", 0, 0, 0, 6));
  parts.push(between([0, 1.4, 0], [0.4, 2.7, 0.1], 0.14, 0.08, "#6b4423", 5));
  parts.push(between([0, 1.4, 0], [-0.4, 2.6, -0.1], 0.14, 0.08, "#6b4423", 5));
  // Krone: gewölbte, glatte Kuppel (Ikosaeder mit Unterteilung), leicht abgeflacht
  parts.push({ geo: ico(0.95, 1), color: leaf[0], pos: [0, 3.45, 0], scale: [1.25, 0.62, 1.25] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    parts.push({
      geo: ico(0.7, 0),
      color: leaf[i % 2],
      pos: [Math.sin(a) * 0.55, 3.25, Math.cos(a) * 0.55],
      scale: [1.1, 0.6, 1.1],
    });
  }
  // Vorhang aus hängenden Zweigen: schlanke, weich gerundete Tropfenformen rund um die Krone, aussen länger
  const curtain = (r: number, n: number, top: number, len: number, rot: number, c0: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const l = len * (0.85 + (0.3 * ((i * 7) % 5)) / 4);
      parts.push({
        geo: new THREE.OctahedronGeometry(0.5, 0),
        color: leaf[(i + c0) % 2],
        pos: [Math.sin(a) * r, top - l / 2, Math.cos(a) * r],
        rot: [0, a, 0],
        scale: [0.36, l, 0.2],
      });
    }
  };
  curtain(1.12, 13, 3.25, 1.9, 0, 0);
  curtain(0.78, 8, 3.35, 1.4, 0.35, 1);
  return parts;
}

/**
 * Steinbogenbrücke, Achse entlang +z, Länge `span` (z ∈ [−span/2, span/2]), Breite `width` (x ∈ [−width/2, width/2]):
 * Körper mit Kreisbogen als Fahrbahn und Gewölbe, Keilsteine als Bogenring, Brüstung mit Abdeckplatten, Pflaster,
 * Eckpfeiler. Scheitel der Fahrbahn bei ≈ 1.2 m, die Enden schliessen bei y ≈ 0.05 bündig an.
 */
export function stoneBridgeParts(span: number, width = 2.2): Part[] {
  const parts: Part[] = [];
  const S = span / 2;
  const yEnd = 0.05;
  const crest = 1.2;
  const T = 0.4;
  const rise = crest - yEnd;
  const Rd = (S * S + rise * rise) / (2 * rise);
  const cy = crest - Rd;
  const Rs = Rd - T;
  const deck = (z: number) => cy + Math.sqrt(Math.max(0, Rd * Rd - z * z));
  const soffit = (z: number) => cy + Math.sqrt(Math.max(0, Rs * Rs - z * z));
  const a = Math.sqrt(Rs * Rs - cy * cy);
  const body = "#aaa498";

  // Körper: Profil in der (z, y)-Ebene, entlang x extrudiert
  const wb = width - 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(-S, 0);
  shape.lineTo(-a, 0);
  const nArc = 16;
  for (let i = 1; i <= nArc; i++) {
    const z = -a + (2 * a * i) / nArc;
    shape.lineTo(z, i === nArc ? 0 : soffit(z));
  }
  shape.lineTo(S, 0);
  shape.lineTo(S, yEnd);
  const nDeck = 24;
  for (let i = nDeck - 1; i >= 0; i--) {
    const z = -S + (2 * S * i) / nDeck;
    shape.lineTo(z, i === 0 ? yEnd : deck(z));
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: wb, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(wb / 2, 0, 0);
  parts.push({ geo: g, color: body });

  // Bogenring aus Keilsteinen (über die ganze Breite, etwas vor der Seitenwand)
  const alpha = Math.asin(a / Rs) * 0.95;
  const nV = 13;
  for (let k = 0; k < nV; k++) {
    const phi = -alpha + (2 * alpha * (k + 0.5)) / nV;
    const rc = Rs + 0.125;
    const key = k === (nV - 1) / 2;
    parts.push({
      geo: box(width, key ? 0.34 : 0.28, ((2 * alpha * Rs) / nV) * 1.01 + 0.02),
      color: key ? "#cfc8ba" : k % 2 ? "#b3ab9d" : "#c4bdb0",
      pos: [0, cy + rc * Math.cos(phi), rc * Math.sin(phi)],
      rot: [phi, 0, 0],
    });
  }

  // Pflaster in Abschnitten entlang der Kurve
  const N = Math.max(8, Math.round(span / 0.9));
  const step = span / N;
  const road = width / 2 - 0.3;
  for (let j = 0; j < N; j++) {
    const zc = -S + (j + 0.5) * step;
    const phi = Math.asin(zc / Rd);
    const y = deck(zc);
    for (const s of [-1, 1]) {
      parts.push({
        geo: box(road - 0.02, 0.05, step + 0.01),
        color: (j + (s > 0 ? 1 : 0)) % 2 ? "#c9bfa2" : "#b9ae92",
        pos: [s * (road / 2), y + Math.cos(phi) * 0.015, zc + Math.sin(phi) * 0.015],
        rot: [phi, 0, 0],
      });
    }
  }
  // Brüstung mit Abdeckplatten zwischen den Eckpfeilern
  const N2 = Math.max(6, Math.round((span - 1) / 0.9));
  const step2 = (span - 1) / N2;
  const px = width / 2 - 0.15;
  for (let j = 0; j < N2; j++) {
    const zc = -(S - 0.5) + (j + 0.5) * step2;
    const phi = Math.asin(zc / Rd);
    const nz = Math.sin(phi);
    const ny = Math.cos(phi);
    const y = deck(zc);
    for (const s of [-1, 1]) {
      parts.push({
        geo: box(0.3, 0.5, step2 + 0.02),
        color: j % 2 ? "#b8b2a7" : "#aaa498",
        pos: [s * px, y + ny * 0.23, zc + nz * 0.23],
        rot: [phi, 0, 0],
      });
      parts.push({
        geo: box(0.4, 0.07, step2 + 0.04),
        color: "#cfc8ba",
        pos: [s * (width / 2 - 0.2), y + ny * 0.515, zc + nz * 0.515],
        rot: [phi, 0, 0],
      });
    }
  }
  // Eckpfeiler mit Deckplatte
  for (const e of [-1, 1]) {
    for (const s of [-1, 1]) {
      const z = e * (S - 0.26);
      const x = s * (width / 2 - 0.26);
      parts.push(bb(0.44, 0.8, 0.44, "#b8b2a7", x, 0, z));
      parts.push(bb(0.52, 0.08, 0.52, "#cfc8ba", x, 0.8, z));
    }
  }
  return parts;
}

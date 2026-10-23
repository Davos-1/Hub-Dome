import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { box, cyl, cylZ, gable, mergeParts, type Part } from "../geo";

/** Geometrie eines Gebäudes: `body` mit Vertex-Farben, `glow` = leuchtende Teile (Fenster, Laternen). */
export type Model = {
  body: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  /** Höhe der Oberkante über dem Boden (Meter), für Beschriftung und Trefferfläche. */
  top: number;
};

/** Sammelt Bauteile für Karosserie und leuchtende Teile. */
export class Builder {
  body: Part[] = [];
  glow: Part[] = [];
  add(p: Part) {
    this.body.push(p);
    return this;
  }
  light(p: Part) {
    this.glow.push(p);
    return this;
  }
  build(top = 0): Model {
    return {
      top,
      body: mergeParts(this.body),
      // mergeParts braucht mindestens ein Teil: bei Modellen ohne Leuchtteile ein unsichtbar kleines
      glow: mergeParts(
        this.glow.length ? this.glow : [{ geo: box(0.001, 0.001, 0.001), color: "#000000" }],
      ),
    };
  }
}

export const STONE = "#b8b2a7";
export const WHITE = "#f6f3ec";
export const WOOD = "#7a4a2b";
export const BRICK = "#a35a45";
export const SMOKE = "#f1f1f1";
export const WARM = "#ffe2a0";

export const ROOF_COLORS = ["#b4533a", "#5f7a94", "#8a6a45", "#6f8f60", "#9c5a70"];

/** Stabile Dachfarbe aus einer ID. */
export function roofColorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ROOF_COLORS[h % ROOF_COLORS.length];
}

export const darken = (hex: string, f: number) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
};

export const mix = (a: string, b: string, t: number) => {
  const c = new THREE.Color(a);
  c.lerp(new THREE.Color(b), t);
  return `#${c.getHexString()}`;
};

/** Farben für Kleinteile (Beschläge, Rinnen, Glas). */
export const IRON = "#4b5563";
export const BRASS = "#e0b341";
export const SLATE = "#8b9198";
export const GLASS = "#cfe0ff";
export const LEAF = "#5f8f4a";

/** Steinton, der leicht zur Wandfarbe neigt (Sockel, Fensterbänke, Stufen). */
export const stoneFor = (wall: string) => mix(STONE, wall, 0.15);

/** Kleiner Vieleck-Klumpen (20 Dreiecke): Büsche, Blüten, Knäufe, ohne die Dreieckszahl zu sprengen. */
export const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);

/** Halbkreis-Scheibe (Türbogen) mit 6 Segmenten, Achse entlang z, Rundung nach oben (24 statt 32 Dreiecke). */
const halfDisc = (r: number, depth: number) => {
  const g = new THREE.CylinderGeometry(r, r, depth, 6, 1, false, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2);
  return g;
};

/** Kleine Blüte (8 Dreiecke). */
export const blossom = (r: number) => new THREE.OctahedronGeometry(r, 0);

/** Abgerundeter Quader mit nur einer Rundungsstufe (108 statt 300 Dreiecke) für kleine Anbauten. */
export const rboxLow = (w: number, h: number, d: number, r = 0.05) =>
  new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2, h / 2, d / 2));

/** Neigt eine frische Geometrie um die X-Achse (für Vordächer); die Vorderkante (+z) senkt sich bei positivem Winkel. */
export const tilt = <G extends THREE.BufferGeometry>(g: G, rx: number): G => {
  g.rotateX(rx);
  return g;
};

/**
 * Lokales Koordinatensystem für Anbauteile: Ursprung (ox, oy, oz) und Drehung `yaw` um Y.
 * u = nach rechts (von aussen gesehen), v = nach oben (absolute Höhe, wenn oy = 0), n = aus der Wand heraus.
 * So werden Fenster, Türen und Giebelteile einmal an der Vorderseite beschrieben und an jede Wand gesetzt.
 */
export class Frame {
  private readonly c: number;
  private readonly s: number;
  constructor(
    readonly b: Builder,
    readonly ox = 0,
    readonly oy = 0,
    readonly oz = 0,
    readonly yaw = 0,
  ) {
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
  }
  /** Weltposition eines lokalen Punktes. */
  at(u: number, v: number, n: number): [number, number, number] {
    return [this.ox + u * this.c + n * this.s, this.oy + v, this.oz - u * this.s + n * this.c];
  }
  /** Bauteil; `rz` kippt es um die lokale n-Achse (Schrägen am Giebel). */
  add(geo: THREE.BufferGeometry, color: string, u: number, v: number, n: number, rz = 0) {
    this.b.add({ geo, color, pos: this.at(u, v, n), rot: [0, this.yaw, rz] });
    return this;
  }
  /** Leuchtteil (Scheiben, Lampen). */
  lit(geo: THREE.BufferGeometry, color: string, u: number, v: number, n: number, rz = 0) {
    this.b.light({ geo, color, pos: this.at(u, v, n), rot: [0, this.yaw, rz] });
    return this;
  }
  box(w: number, h: number, d: number, color: string, u: number, v: number, n: number, rz = 0) {
    return this.add(box(w, h, d), color, u, v, n, rz);
  }
  litBox(w: number, h: number, d: number, color: string, u: number, v: number, n: number) {
    return this.lit(box(w, h, d), color, u, v, n);
  }
}

/** Die vier Wände eines Quaders (Breite w in x, Tiefe d in z, Mittelpunkt cx/cz) als Frames auf der Wandfläche. */
export function wallFrames(b: Builder, w: number, d: number, cx = 0, cz = 0) {
  return {
    front: new Frame(b, cx, 0, cz + d / 2, 0),
    back: new Frame(b, cx, 0, cz - d / 2, Math.PI),
    right: new Frame(b, cx + w / 2, 0, cz, Math.PI / 2),
    left: new Frame(b, cx - w / 2, 0, cz, -Math.PI / 2),
  };
}

/** Umlaufendes Band um einen Quader (Gesims, Schalungsfuge, Sockelkante): ein Teil deckt alle vier Wände ab. */
export function band(
  b: Builder,
  w: number,
  d: number,
  y: number,
  h: number,
  color: string,
  grow = 0.014,
  cx = 0,
  cz = 0,
) {
  b.add({ geo: box(w + grow * 2, h, d + grow * 2), color, pos: [cx, y, cz] });
}

/** Steinsockel über der Bodenplatte (y von `base` an), ragt leicht aus der Wand. */
export function plinth(
  b: Builder,
  w: number,
  d: number,
  base: number,
  wall: string,
  cx = 0,
  cz = 0,
) {
  band(b, w, d, base + 0.07, 0.14, stoneFor(wall), 0.025, cx, cz);
}

/** Vier Eckpfeiler (Lisenen) von y0 bis y1; ragen 0.025 aus der Wand. */
export function corners(
  b: Builder,
  w: number,
  d: number,
  y0: number,
  y1: number,
  color: string,
  cx = 0,
  cz = 0,
  size = 0.09,
) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add({
        geo: box(size, y1 - y0, size),
        color,
        pos: [
          cx + sx * (w / 2 - size / 2 + 0.025),
          (y0 + y1) / 2,
          cz + sz * (d / 2 - size / 2 + 0.025),
        ],
      });
    }
  }
}

export type WindowOpts = {
  /** Rahmenfarbe (Standard weiss). */
  frame?: string;
  /** Scheibenfarbe (leuchtet nachts). */
  glass?: string;
  /** Läden in dieser Farbe; `null`/fehlt = keine. */
  shutter?: string | null;
  /** Fensterbank (Standard an). */
  sill?: boolean;
  /** Farbe der Fensterbank (Standard Stein). */
  sillColor?: string;
  /** Sturzbrett über dem Fenster. */
  head?: boolean;
  /** Blumenkasten mit Büschen und Blüten. */
  flowers?: boolean;
  /** Sprossen: Kreuz (Standard), nur senkrecht oder keine. */
  bars?: "cross" | "vertical" | "none";
  /** Spitzbogen oben (schmale Turmfenster). */
  arched?: boolean;
  /** Läden ohne Füllung (spart Dreiecke an Seiten und Rückwand). */
  plain?: boolean;
};

const FR = 0.045;

/**
 * Fenster auf einer Wand: Rahmen, leuchtende Scheibe, Sprossen, Fensterbank, optional Läden und Blumenkasten.
 * (u, v) ist die Fenstermitte, (w, h) das Glasmass.
 */
export function windowAt(f: Frame, u: number, v: number, w: number, h: number, o: WindowOpts = {}) {
  const fc = o.frame ?? WHITE;
  const top = v + h / 2;
  f.box(w + FR * 2, h + FR * 2, 0.05, fc, u, v, 0.02);
  f.litBox(w, h, 0.04, o.glass ?? WARM, u, v, 0.03);
  const tip = o.arched ? (w / 2) * 1.5 : 0;
  if (o.arched) {
    f.add(triPlate(w / 2 + FR, tip + FR * 1.5, 0.05), fc, u, top, 0.02);
    f.lit(triPlate(w / 2, tip, 0.04), o.glass ?? WARM, u, top, 0.03);
  }
  const bars = o.bars ?? "cross";
  if (bars !== "none") {
    f.box(0.028, h + tip * 0.8, 0.03, fc, u, v + tip * 0.4, 0.05);
    if (bars === "cross") f.box(w, 0.028, 0.03, fc, u, v, 0.05);
  }
  if (o.sill !== false && !o.flowers) {
    f.box(w + 0.17, 0.05, 0.12, o.sillColor ?? STONE, u, v - h / 2 - FR - 0.005, 0.06);
  }
  if (o.head) {
    f.box(w + 0.15, 0.05, 0.08, darken(fc, 0.9), u, top + FR + 0.015 + tip, 0.04);
  }
  if (o.shutter) {
    const sw = w * 0.4;
    for (const s of [-1, 1]) {
      const su = u + s * (w / 2 + FR + sw / 2 + 0.008);
      f.box(sw, h + FR * 2 + 0.02, 0.035, o.shutter, su, v, 0.018);
      if (!o.plain)
        f.box(sw * 0.55, (h + FR * 2) * 0.72, 0.012, darken(o.shutter, 0.8), su, v, 0.04);
    }
  }
  if (o.flowers) {
    const by = v - h / 2 - FR + 0.06;
    f.box(w + 0.1, 0.11, 0.13, WOOD, u, by, 0.1);
    f.box(w + 0.04, 0.07, 0.1, LEAF, u, by + 0.08, 0.1);
    const pink = ["#ec4899", "#f59e0b", "#ef4444"];
    for (let i = 0; i < 3; i++) {
      f.add(
        blossom(0.045),
        pink[i % pink.length],
        u - w / 2 + 0.08 + (i * (w - 0.16)) / 2,
        by + 0.14,
        0.11,
      );
    }
  }
}

/** Rundfenster (Giebel, Turm): Ring, leuchtende Scheibe, Kreuz. Mitte (u, v), Radius der Scheibe r. */
export function roundWindow(
  f: Frame,
  u: number,
  v: number,
  r: number,
  frame = WHITE,
  glass = WARM,
) {
  f.add(cylZ(r + 0.05, r + 0.05, 0.05, 8), frame, u, v, 0.02);
  f.lit(new THREE.CircleGeometry(r, 8), glass, u, v, 0.052);
  f.box(0.026, r * 2, 0.03, frame, u, v, 0.05);
  f.box(r * 2, 0.026, 0.03, frame, u, v, 0.05);
}

export type DoorOpts = {
  /** Farbe des Türblatts (Akzent). */
  leaf: string;
  /** Farbe des Türrahmens (Standard weiss). */
  frame?: string;
  /** Rundbogen oben. */
  arched?: boolean;
  /** Fensterchen im Türblatt (leuchtet). */
  glass?: boolean;
  /** Wandlampe neben der Tür: -1 links, 1 rechts, 0 keine. */
  lamp?: -1 | 0 | 1;
  /** Zwei Stufen aus Stein vor der Tür (reichen bis n = 0.5). */
  steps?: boolean;
  /** Steinfarbe der Stufen. */
  stone?: string;
};

/** Türrahmen mit Laibung als ein Teil: Rechteck oder Rundbogen, innen ausgeschnitten. */
function doorFrameGeo(w: number, h: number, j: number, depth: number, arched: boolean) {
  const shape = new THREE.Shape();
  const hole = new THREE.Path();
  if (arched) {
    const ro = w / 2 + j;
    shape.moveTo(-ro, 0);
    shape.lineTo(-ro, h);
    shape.absarc(0, h, ro, Math.PI, 0, true);
    shape.lineTo(ro, 0);
    hole.moveTo(-w / 2, 0);
    hole.lineTo(w / 2, 0);
    hole.lineTo(w / 2, h);
    hole.absarc(0, h, w / 2, 0, Math.PI, false);
    hole.lineTo(-w / 2, 0);
  } else {
    shape.moveTo(-w / 2 - j, 0);
    shape.lineTo(-w / 2 - j, h + j);
    shape.lineTo(w / 2 + j, h + j);
    shape.lineTo(w / 2 + j, 0);
    hole.moveTo(-w / 2, 0);
    hole.lineTo(w / 2, 0);
    hole.lineTo(w / 2, h);
    hole.lineTo(-w / 2, h);
  }
  shape.closePath();
  hole.closePath();
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -0.01);
  return g;
}

/**
 * Haustür: Rahmen mit Laibung, Türblatt mit Füllungen (oder Fensterchen), Klinke, Steinstufen, Lampe.
 * u = Mitte, w/h = Mass des Türblatts, `base` = Höhe der Schwelle.
 */
export function doorAt(f: Frame, u: number, w: number, h: number, base: number, o: DoorOpts) {
  const arched = o.arched ?? false;
  const body = arched ? h - w / 2 : h;
  f.add(doorFrameGeo(w, body, 0.08, 0.07, arched), o.frame ?? WHITE, u, base, 0);
  // Türblatt in der Laibung
  f.box(w, body, 0.04, o.leaf, u, base + body / 2, -0.005);
  if (arched) f.add(halfDisc(w / 2, 0.04), o.leaf, u, base + body, -0.005);
  const dark = darken(o.leaf, 0.82);
  if (o.glass) f.litBox(w * 0.5, h * 0.2, 0.02, WARM, u, base + h * 0.7, 0.02);
  else f.box(w * 0.66, h * 0.3, 0.02, dark, u, base + h * 0.7, 0.02);
  f.box(w * 0.66, h * 0.3, 0.02, dark, u, base + h * 0.3, 0.02);
  f.add(ico(0.032), BRASS, u + w * 0.3, base + h * 0.48, 0.05);
  if (o.steps) {
    const st = o.stone ?? STONE;
    f.box(w + 0.4, 0.2, 0.3, st, u, 0.1, 0.13);
    f.box(w + 0.66, 0.1, 0.5, darken(st, 0.94), u, 0.05, 0.25);
  }
  if (o.lamp) lantern(f, u + o.lamp * (w / 2 + 0.3), base + h * 0.82);
}

/** Wandlampe: Arm, Glaskörper (leuchtet), Dach. (u, v) = Mitte des Glaskörpers. */
export function lantern(f: Frame, u: number, v: number) {
  f.box(0.03, 0.03, 0.1, IRON, u, v + 0.02, 0.05);
  f.lit(cyl(0.04, 0.04, 0.12, 6), WARM, u, v, 0.11);
  f.add(cyl(0.012, 0.06, 0.05, 6), IRON, u, v + 0.085, 0.11);
}

/** Schräges Vordach (Pultdach) an der Wand mit zwei Streben: Anschlusshöhe v, Auskragung `depth`. */
export function canopy(
  f: Frame,
  u: number,
  v: number,
  w: number,
  depth: number,
  color: string,
  trim: string,
) {
  f.add(tilt(box(w, 0.05, depth), 0.14), color, u, v, depth / 2);
  f.box(w + 0.02, 0.07, 0.035, trim, u, v - depth * 0.07, depth);
  for (const s of [-1, 1]) {
    f.add(
      tilt(box(0.035, 0.035, depth * 0.95), -0.45),
      WOOD,
      u + s * (w / 2 - 0.1),
      v - 0.16,
      depth * 0.44,
    );
  }
}

/**
 * Punkt auf der Dachfläche eines Satteldachs (siehe `gableRoof`): `side` = ±1 (Seite in u), `t` = Anteil
 * von der Traufe (0) bis zum First (1), `off` = Abstand senkrecht über der Fläche. Liefert u, v und die
 * Neigung `rz` für Teile, die auf der Schräge liegen (Dachfenster, Gauben).
 */
export function slopeAt(width: number, height: number, side: number, t: number, off: number) {
  const a = Math.atan2(height, width / 2);
  return {
    u: side * (width / 2) * (1 - t) + side * Math.sin(a) * (0.04 + off),
    v: height * t + Math.cos(a) * (0.04 + off),
    rz: -side * a,
  };
}

/** Dreieckiges Brett (Giebelfüllung), Mittelpunkt der Grundkante bei u = 0, Dicke t. */
export function triPlate(half: number, height: number, t = 0.024) {
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  return g;
}

export type GableOpts = {
  /** Ton für First, Ortgang und Rinne (Standard: dunkles Dach). */
  trim?: string;
  /** Dachrinne an beiden Traufen. */
  gutter?: boolean;
  /** Giebelfüllung an den Stirnseiten in dieser Farbe (Wand), `undefined` = keine. */
  plate?: string;
  /** Schindelreihen je Dachseite (dünne Leisten längs des Firsts). */
  rows?: number;
};

/**
 * Satteldach mit First, Ortgangbrettern, Rinne, Giebelfüllung und Schindelreihen. Der Frame sitzt auf der
 * Traufhöhe in der Mitte des Daches; der First verläuft entlang n, die Giebel liegen bei n = ±depth/2.
 */
export function gableRoof(
  f: Frame,
  width: number,
  height: number,
  depth: number,
  color: string,
  o: GableOpts = {},
) {
  const trim = o.trim ?? darken(color, 0.72);
  f.add(gable(width, height, depth), color, 0, 0, 0);
  f.box(0.15, 0.08, depth + 0.03, trim, 0, height + 0.01, 0);
  const a = Math.atan2(height, width / 2);
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const len = Math.hypot(width / 2, height) + 0.06;
  for (const s of [-1, 1]) {
    for (const side of [-1, 1]) {
      f.box(
        len,
        0.075,
        0.05,
        trim,
        (side * width) / 4 + side * sa * 0.035,
        height / 2 + ca * 0.035,
        s * (depth / 2 - 0.012),
        -side * a,
      );
    }
  }
  const rows = o.rows ?? 0;
  const rowColor = darken(color, 0.88);
  for (let i = 1; i <= rows; i++) {
    const t = i / (rows + 1);
    for (const side of [-1, 1]) {
      f.box(
        0.06,
        0.028,
        depth - 0.14,
        rowColor,
        side * (width / 2) * (1 - t) + side * sa * 0.045,
        height * t + ca * 0.045,
        0,
        -side * a,
      );
    }
  }
  if (o.gutter) {
    for (const side of [-1, 1]) {
      f.add(cylZ(0.035, 0.035, depth - 0.12, 6), SLATE, side * (width / 2 - 0.015), 0, 0);
    }
  }
  if (o.plate) {
    const s = 0.78;
    for (const sg of [-1, 1]) {
      f.add(triPlate((width / 2) * s, height * s), o.plate, 0, 0.07, sg * (depth / 2 + 0.012));
    }
  }
}

/**
 * Steinkamin mit Fugen und Abdeckplatte, von y0 (steckt im Dach oder steht am Boden) bis y1 (Oberkante der
 * Abdeckung); die dunkle Rauchöffnung liegt bei y1. Gibt die Höhe der Öffnung zurück (für den Rauch).
 */
export function chimney(
  b: Builder,
  x: number,
  z: number,
  y0: number,
  y1: number,
  size: number,
  color = "#9b958a",
) {
  b.add({ geo: box(size, y1 - y0, size), color, pos: [x, (y0 + y1) / 2, z] });
  const joint = darken(color, 0.84);
  for (let y = y1 - 0.26; y > y0 + 0.15; y -= 0.3) {
    b.add({ geo: box(size + 0.014, 0.024, size + 0.014), color: joint, pos: [x, y, z] });
  }
  b.add({
    geo: box(size + 0.1, 0.07, size + 0.1),
    color: darken(color, 0.78),
    pos: [x, y1 - 0.035, z],
  });
  b.add({ geo: box(size * 0.5, 0.014, size * 0.5), color: "#2c2926", pos: [x, y1 + 0.003, z] });
  return y1 + 0.01;
}
const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Euler-Drehung, die die Y-Achse eines Bauteils auf die Richtung `n` ausrichtet (z.B. Bullaugen auf einer Kuppel). */
export function orient(n: [number, number, number]): [number, number, number] {
  tmpQ.setFromUnitVectors(UP, new THREE.Vector3(...n).normalize());
  tmpE.setFromQuaternion(tmpQ);
  return [tmpE.x, tmpE.y, tmpE.z];
}

/** Punkt auf einer Kugel (Radius r, Mittelpunkt (0,cy,0)) bei Azimut/Elevation (Bogenmass). */
export function onSphere(r: number, cy: number, azimuth: number, elevation: number) {
  const x = Math.sin(azimuth) * Math.cos(elevation);
  const y = Math.sin(elevation);
  const z = Math.cos(azimuth) * Math.cos(elevation);
  return {
    pos: [x * r, cy + y * r, z * r] as [number, number, number],
    normal: [x, y, z] as [number, number, number],
  };
}

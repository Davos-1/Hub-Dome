import * as THREE from "three";
import { seededRandom } from "./colors";

/** Kantenlänge aller Wegtexturen in Pixel. */
const SIZE = 512;

/**
 * Wie viele Meter eine Kachel der jeweiligen Textur abdeckt. Die UV-Koordinaten der Wege
 * (Meter) werden durch diesen Wert geteilt. `kies` ist der Massstab der bestehenden Kies-Textur.
 */
export const TILE_METERS = {
  kies: 1.4,
  pflaster: 1.2,
  platten: 2.4,
  erde: 2.0,
  tritt: 0.8,
} as const;

/**
 * Minimale 2D-Zeichenschnittstelle (Teilmenge von `CanvasRenderingContext2D`). Die Maler unten
 * brauchen nur diese Mitglieder und lassen sich so ohne DOM in Unit-Tests aufzeichnen.
 */
export type Painter = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "fillRect"
  | "beginPath"
  | "ellipse"
  | "fill"
  | "moveTo"
  | "lineTo"
  | "closePath"
  | "stroke"
  | "quadraticCurveTo"
>;

/** Zeichnet eine kachelbare Textur der Kantenlänge `n` (Pixel) mit dem Zufall `rnd`. */
export type PaintFn = (ctx: Painter, n: number, rnd: () => number) => void;

type Rgb = readonly [number, number, number];
type Pt = { x: number; y: number };

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
/** Deckende Farbe, optional mit Helligkeitsfaktor `f`. */
const rgb = (c: Rgb, f = 1) => `rgb(${byte(c[0] * f)},${byte(c[1] * f)},${byte(c[2] * f)})`;
/** Halbtransparente Farbe. */
const rgba = (c: Rgb, a: number) =>
  `rgba(${byte(c[0])},${byte(c[1])},${byte(c[2])},${a.toFixed(2)})`;
const range = (rnd: () => number, a: number, b: number) => a + rnd() * (b - a);
/** Wert in [0, n) zurückfalten (auch für negative Werte). */
const mod = (v: number, n: number) => ((v % n) + n) % n;
/** Sicherheitsabstand (Pixel) für die Reichweite von Formen beim Spiegeln. */
const MARGIN = 0.5;

/**
 * Ruft `draw` für jede Kopie einer Form auf, die in die Kachel [0, n] ragt: Versatz -n, 0 oder +n
 * je Achse. `x`/`y` liegen in [0, n), `rx`/`ry` ist die halbe Ausdehnung der Form. So kachelt die
 * Textur nahtlos, und Formen im Innern werden nur einmal gezeichnet.
 */
function wrap(
  n: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  draw: (cx: number, cy: number) => void,
): void {
  for (const dx of [-n, 0, n]) {
    if (x + dx + rx + MARGIN <= 0 || x + dx - rx - MARGIN >= n) continue;
    for (const dy of [-n, 0, n]) {
      if (y + dy + ry + MARGIN <= 0 || y + dy - ry - MARGIN >= n) continue;
      draw(x + dx, y + dy);
    }
  }
}

/** Gefüllte, gedrehte Ellipse (Mittelpunkt wird in die Kachel gefaltet und gespiegelt). */
function dot(
  ctx: Painter,
  n: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  colour: string,
): void {
  const sin = Math.sin(rot);
  const cos = Math.cos(rot);
  const hx = Math.hypot(rx * cos, ry * sin);
  const hy = Math.hypot(rx * sin, ry * cos);
  ctx.fillStyle = colour;
  wrap(n, mod(x, n), mod(y, n), hx, hy, (cx, cy) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Ineinander liegende Ellipsenfaktoren: wenig Deckkraft je Schicht ergibt einen weichen Rand. */
const SOFT = [1, 0.68, 0.38] as const;

/** Weicher Fleck: `dot` mit geschachtelten Ellipsen, `alpha` gilt je Schicht. */
function softDot(
  ctx: Painter,
  n: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  tint: Rgb,
  alpha: number,
  layers: readonly number[] = SOFT,
): void {
  for (const f of layers) dot(ctx, n, x, y, rx * f, ry * f, rot, rgba(tint, alpha));
}

/** Kleines Rechteck (Körnung), um den Mittelpunkt `x`/`y`, gespiegelt wie `dot`. */
function fleck(
  ctx: Painter,
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
): void {
  ctx.fillStyle = colour;
  wrap(n, mod(x, n), mod(y, n), w / 2, h / 2, (cx, cy) => {
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  });
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Unregelmässig abgerundete Form (Superellipse mit Streuung) als Stützpunkte um (0, 0). */
function blobPoints(
  rnd: () => number,
  rx: number,
  ry: number,
  count: number,
  squareness: number,
  wobble: number,
): Pt[] {
  const phase = rnd() * Math.PI * 2;
  const e = 2 / squareness;
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = phase + ((i + range(rnd, -0.2, 0.2)) / count) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Streuung nur nach innen, damit die Fugen nie zuwachsen
    const f = 1 - wobble * rnd();
    pts.push({
      x: Math.sign(c) * Math.abs(c) ** e * rx * f,
      y: Math.sign(s) * Math.abs(s) ** e * ry * f,
    });
  }
  return fitBlob(pts, rx, ry);
}

/** Skaliert die Stützpunkte so, dass die geglättete Kurve die Halbachsen `rx`/`ry` genau erreicht. */
function fitBlob(pts: Pt[], rx: number, ry: number): Pt[] {
  const k = pts.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < k; i++) {
    const p = pts[i];
    const m0 = mid(pts[(i + k - 1) % k], p);
    const m1 = mid(p, pts[(i + 1) % k]);
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const u = 1 - t;
      mx = Math.max(mx, Math.abs(u * u * m0.x + 2 * u * t * p.x + t * t * m1.x));
      my = Math.max(my, Math.abs(u * u * m0.y + 2 * u * t * p.y + t * t * m1.y));
    }
  }
  return pts.map((p) => ({ x: (p.x * rx) / mx, y: (p.y * ry) / my }));
}

/** Geschlossener, glatter Pfad durch die Mittelpunkte der Kanten (Punkte sind Kontrollpunkte). */
function smoothPath(
  ctx: Painter,
  pts: Pt[],
  cx: number,
  cy: number,
  scale: number,
  ox: number,
  oy: number,
): void {
  const k = pts.length;
  const at = (i: number): Pt => ({
    x: cx + ox + pts[i % k].x * scale,
    y: cy + oy + pts[i % k].y * scale,
  });
  const start = mid(at(k - 1), at(0));
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < k; i++) {
    const p = at(i);
    const q = mid(p, at(i + 1));
    ctx.quadraticCurveTo(p.x, p.y, q.x, q.y);
  }
  ctx.closePath();
}

/** Rechteck mit abgerundeten Ecken als Pfad (Ecken sind die Kontrollpunkte). */
function roundRectPath(
  ctx: Painter,
  l: number,
  t: number,
  r: number,
  b: number,
  rad: number,
): void {
  ctx.beginPath();
  ctx.moveTo(l + rad, t);
  ctx.lineTo(r - rad, t);
  ctx.quadraticCurveTo(r, t, r, t + rad);
  ctx.lineTo(r, b - rad);
  ctx.quadraticCurveTo(r, b, r - rad, b);
  ctx.lineTo(l + rad, b);
  ctx.quadraticCurveTo(l, b, l, b - rad);
  ctx.lineTo(l, t + rad);
  ctx.quadraticCurveTo(l, t, l + rad, t);
  ctx.closePath();
}

/** Grösste Abweichung der Punkte von (0, 0) je Achse. */
function reachOf(pts: Pt[]): Pt {
  return {
    x: Math.max(...pts.map((p) => Math.abs(p.x))),
    y: Math.max(...pts.map((p) => Math.abs(p.y))),
  };
}

const MORTAR: Rgb = [188, 180, 166];
const SHADOW: Rgb = [100, 90, 76];
const WHITE: Rgb = [255, 255, 255];

/**
 * Kopfsteinpflaster: 6 × 6 abgerundete, leicht unregelmässige Steine im Reihenverband
 * (jede zweite Reihe um einen halben Stein versetzt), dunklere Mörtelfugen von rund 5 px.
 */
function paintCobble(ctx: Painter, n: number, rnd: () => number): void {
  const k = n / SIZE;
  const cells = 6;
  const cw = n / cells;
  const joint = 3.6 * k;

  ctx.fillStyle = rgb(MORTAR);
  ctx.fillRect(0, 0, n, n);
  // Körnung im Mörtel (liegt unter den Steinen und zeigt sich nur in den Fugen)
  for (let i = 0; i < 700; i++) {
    const dark = rnd() < 0.55;
    fleck(
      ctx,
      n,
      rnd() * n,
      rnd() * n,
      range(rnd, 1, 2.2) * k,
      range(rnd, 1, 2.2) * k,
      dark ? rgba(SHADOW, range(rnd, 0.2, 0.4)) : rgba([222, 214, 200], range(rnd, 0.35, 0.6)),
    );
  }

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const x = mod((col + 0.5 + (row % 2) * 0.5) * cw + range(rnd, -0.75, 0.75) * k, n);
      const y = mod((row + 0.5) * cw + range(rnd, -0.75, 0.75) * k, n);
      const rx = (cw - joint) / 2 - rnd() * 0.5 * k;
      const ry = (cw - joint) / 2 - rnd() * 0.5 * k;
      const pts = blobPoints(rnd, rx, ry, 12, 2.6 + rnd() * 0.6, 0.05);
      const v = range(rnd, 238, 254);
      const warm = range(rnd, -4, 4);
      const base: Rgb = [v + 1 + warm, v - 2, v - 10 - warm];
      // Maserung (hell oder dunkel) und feine Punkte auf dem Stein
      const patina = {
        ox: range(rnd, -0.2, 0.2) * rx,
        oy: range(rnd, -0.2, 0.2) * ry,
        tint: rnd() < 0.5 ? WHITE : SHADOW,
      };
      const specks = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * 0.65;
        return {
          x: Math.cos(a) * d * rx,
          y: Math.sin(a) * d * ry,
          r: range(rnd, 0.6, 1.2) * k,
        };
      });
      const reach = reachOf(pts);
      wrap(n, x, y, reach.x, reach.y, (cx, cy) => {
        // Rand (dunkler) → Körper (nach oben links versetzt, lässt unten rechts den Rand stehen)
        ctx.fillStyle = rgb(base, 0.93);
        smoothPath(ctx, pts, cx, cy, 1, 0, 0);
        ctx.fill();
        ctx.fillStyle = rgb(base);
        smoothPath(ctx, pts, cx, cy, 0.93, -0.04 * rx, -0.06 * ry);
        ctx.fill();
        // weiche Ebenen: Maserung, Schatten unten rechts, Reflex oben links
        const soft = (scales: number[], tint: Rgb, alpha: number, ox: number, oy: number) => {
          ctx.fillStyle = rgba(tint, alpha);
          for (const sc of scales) {
            smoothPath(ctx, pts, cx, cy, sc, ox, oy);
            ctx.fill();
          }
        };
        soft([0.7, 0.4], patina.tint, 0.035, patina.ox, patina.oy);
        soft([0.72, 0.52, 0.32], SHADOW, 0.03, 0.05 * rx, 0.14 * ry);
        soft([0.7, 0.5, 0.3], WHITE, 0.07, -0.1 * rx, -0.2 * ry);
        ctx.fillStyle = rgba(SHADOW, 0.35);
        for (const s of specks) {
          ctx.beginPath();
          ctx.ellipse(cx + s.x, cy + s.y, s.r, s.r, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
}

/** Plattenreihen in Zwölfteln der Kachelbreite: Längen 6, 4 und 3 Einheiten, Stossfugen nie fluchtend. */
const FLAG_ROWS = [
  { lens: [6, 3, 3], start: 0 },
  { lens: [4, 4, 4], start: 3 },
  { lens: [6, 6], start: 2 },
] as const;
const FLAG_UNITS = 12;
const JOINT: Rgb = [186, 180, 168];

/**
 * Steinplatten: 3 Reihen im Verband mit drei verschiedenen Plattenlängen, Fugen von rund 5 px,
 * pro Platte leichte Tonabweichung, feine Körnung und eine schmale Kante für das Relief.
 */
function paintFlag(ctx: Painter, n: number, rnd: () => number): void {
  const k = n / SIZE;
  const unit = n / FLAG_UNITS;
  const rowH = n / FLAG_ROWS.length;
  const joint = 5 * k;

  ctx.fillStyle = rgb(JOINT);
  ctx.fillRect(0, 0, n, n);
  for (let i = 0; i < 500; i++) {
    const dark = rnd() < 0.6;
    fleck(
      ctx,
      n,
      rnd() * n,
      rnd() * n,
      range(rnd, 1, 2) * k,
      range(rnd, 1, 2) * k,
      dark ? rgba(SHADOW, range(rnd, 0.15, 0.3)) : rgba(WHITE, range(rnd, 0.25, 0.5)),
    );
  }

  FLAG_ROWS.forEach((row, r) => {
    let at = row.start;
    for (const len of row.lens) {
      const hw = (len * unit) / 2;
      const hh = rowH / 2;
      const x = mod((at + len / 2) * unit, n);
      const y = (r + 0.5) * rowH;
      at += len;
      // Plattenkanten leicht von Hand gestreut → Fugen zwischen etwa 4 und 6 px
      const l = -hw + joint / 2 + range(rnd, -0.6, 0.6) * k;
      const rt = hw - joint / 2 + range(rnd, -0.6, 0.6) * k;
      const t = -hh + joint / 2 + range(rnd, -0.6, 0.6) * k;
      const b = hh - joint / 2 + range(rnd, -0.6, 0.6) * k;
      const rad = range(rnd, 2.5, 5) * k;
      const v = range(rnd, 224, 248);
      const warm = range(rnd, -5, 5);
      const base: Rgb = [v + 1 + warm, v - 2, v - 8 - warm];
      const w = rt - l;
      const h = b - t;
      const blotches = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => ({
        x: (l + rt) / 2 + range(rnd, -0.18, 0.18) * w,
        y: (t + b) / 2 + range(rnd, -0.18, 0.18) * h,
        rx: range(rnd, 0.18, 0.3) * w,
        ry: range(rnd, 0.18, 0.3) * h,
        rot: rnd() * Math.PI,
        colour:
          rnd() < 0.5
            ? rgba(WHITE, range(rnd, 0.05, 0.09))
            : rgba(SHADOW, range(rnd, 0.015, 0.035)),
      }));
      const flecks = Array.from({ length: Math.floor((w * h) / (55 * k * k)) }, () => ({
        x: l + 2 * k + rnd() * (w - 4 * k),
        y: t + 2 * k + rnd() * (h - 4 * k),
        s: range(rnd, 1, 1.8) * k,
        colour:
          rnd() < 0.6 ? rgba(SHADOW, range(rnd, 0.18, 0.4)) : rgba(WHITE, range(rnd, 0.35, 0.6)),
      }));
      wrap(n, x, y, hw, hh, (cx, cy) => {
        ctx.fillStyle = rgb(base);
        roundRectPath(ctx, cx + l, cy + t, cx + rt, cy + b, rad);
        ctx.fill();
        for (const o of blotches) {
          ctx.fillStyle = o.colour;
          for (const f of SOFT) {
            ctx.beginPath();
            ctx.ellipse(cx + o.x, cy + o.y, o.rx * f, o.ry * f, o.rot, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Kante: hell oben/links, dunkel unten/rechts
        ctx.lineWidth = 1.6 * k;
        ctx.strokeStyle = rgba(WHITE, 0.45);
        ctx.beginPath();
        ctx.moveTo(cx + l + 0.8 * k, cy + b - rad);
        ctx.lineTo(cx + l + 0.8 * k, cy + t + rad);
        ctx.quadraticCurveTo(cx + l + 0.8 * k, cy + t + 0.8 * k, cx + l + rad, cy + t + 0.8 * k);
        ctx.lineTo(cx + rt - rad, cy + t + 0.8 * k);
        ctx.stroke();
        ctx.strokeStyle = rgba(SHADOW, 0.22);
        ctx.beginPath();
        ctx.moveTo(cx + rt - 0.8 * k, cy + t + rad);
        ctx.lineTo(cx + rt - 0.8 * k, cy + b - rad);
        ctx.quadraticCurveTo(cx + rt - 0.8 * k, cy + b - 0.8 * k, cx + rt - rad, cy + b - 0.8 * k);
        ctx.lineTo(cx + l + rad, cy + b - 0.8 * k);
        ctx.stroke();
        for (const f of flecks) {
          ctx.fillStyle = f.colour;
          ctx.fillRect(cx + f.x - f.s / 2, cy + f.y - f.s / 2, f.s, f.s);
        }
      });
    }
  });
}

const EARTH: Rgb = [232, 219, 197];
const EARTH_DARK: Rgb = [190, 160, 120];
const EARTH_MID: Rgb = [212, 188, 150];
const EARTH_LIGHT: Rgb = [250, 240, 222];
const TRACK: Rgb = [168, 138, 100];

/**
 * Erdweg: helles, warmes Braun aus weichen Flecken verschiedener Grösse, wenige kleine Kiesel
 * und zwei leicht wellige, dunklere Fahrspuren in Längsrichtung (V). Die Spuren schwanken mit
 * ganzen Perioden und schliessen deshalb oben und unten nahtlos an.
 */
function paintEarth(ctx: Painter, n: number, rnd: () => number): void {
  const k = n / SIZE;

  ctx.fillStyle = rgb(EARTH);
  ctx.fillRect(0, 0, n, n);

  // grosse, weiche Flecken: drei ineinander liegende Ellipsen ergeben einen weichen Rand
  for (let i = 0; i < 110; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = range(rnd, 28, 72) * k;
    const squash = range(rnd, 0.6, 1);
    const rot = rnd() * Math.PI;
    const tint = [EARTH_DARK, EARTH_MID, EARTH_LIGHT][Math.floor(rnd() * 3)];
    const a = range(rnd, 0.05, 0.09);
    for (const f of [1, 0.7, 0.42]) {
      dot(ctx, n, x, y, r * f, r * f * squash, rot, rgba(tint, a));
    }
  }
  // mittlere Flecken
  for (let i = 0; i < 700; i++) {
    const r = range(rnd, 6, 18) * k;
    const tint = rnd() < 0.55 ? EARTH_DARK : EARTH_LIGHT;
    softDot(
      ctx,
      n,
      rnd() * n,
      rnd() * n,
      r,
      r * range(rnd, 0.6, 1),
      rnd() * Math.PI,
      tint,
      range(rnd, 0.04, 0.08),
      [1, 0.6],
    );
  }

  // Fahrspuren: Mittellinie x(y) schwankt mit ganzzahligen Perioden → nahtlos in V
  const steps = 100;
  for (const [cx, amp, waves] of [
    [0.25 * n, 6 * k, 2],
    [0.75 * n, 5 * k, 3],
  ] as const) {
    const phase = rnd() * Math.PI * 2;
    for (let i = 0; i < steps; i++) {
      const y = ((i + rnd() * 0.4) * n) / steps;
      const x = cx + amp * Math.sin((y / n) * Math.PI * 2 * waves + phase) + range(rnd, -2, 2) * k;
      dot(
        ctx,
        n,
        x,
        y,
        range(rnd, 12, 19) * k,
        range(rnd, 10, 18) * k,
        0,
        rgba(TRACK, range(rnd, 0.03, 0.055)),
      );
      dot(
        ctx,
        n,
        x,
        y,
        range(rnd, 5, 9) * k,
        range(rnd, 8, 13) * k,
        0,
        rgba(TRACK, range(rnd, 0.025, 0.05)),
      );
    }
  }

  // einzelne Kiesel mit Schatten unten rechts und Reflex oben links
  for (let i = 0; i < 22; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = range(rnd, 2.5, 6.5) * k;
    const ry = r * range(rnd, 0.65, 0.95);
    const rot = rnd() * Math.PI;
    const v = range(rnd, 186, 214);
    dot(ctx, n, x + 1.2 * k, y + 1.6 * k, r, ry, rot, rgba([110, 92, 70], 0.4));
    dot(ctx, n, x, y, r, ry, rot, rgb([v, v - 4, v - 12]));
    dot(ctx, n, x - 0.25 * r, y - 0.3 * ry, r * 0.4, ry * 0.35, rot, rgba(WHITE, 0.3));
  }

  // feine Körnung
  for (let i = 0; i < 2600; i++) {
    const s = range(rnd, 1, 2) * k;
    fleck(
      ctx,
      n,
      rnd() * n,
      rnd() * n,
      s,
      s,
      rnd() < 0.55
        ? rgba([125, 100, 70], range(rnd, 0.2, 0.4))
        : rgba(EARTH_LIGHT, range(rnd, 0.35, 0.55)),
    );
  }
}

const STEP: Rgb = [229, 229, 226];

/** Ader als Punktfolge relativ zum Startpunkt: leicht gekrümmt, Richtung driftet. */
function veinPoints(rnd: () => number, angle: number, length: number, k: number): Pt[] {
  const segs = 5 + Math.floor(rnd() * 3);
  const pts: Pt[] = [{ x: 0, y: 0 }];
  let a = angle;
  for (let i = 0; i < segs; i++) {
    a += range(rnd, -0.55, 0.55);
    const l = (length / segs) * range(rnd, 0.7, 1.3);
    const p = pts[pts.length - 1];
    pts.push({ x: p.x + Math.cos(a) * l * k, y: p.y + Math.sin(a) * l * k });
  }
  return pts;
}

/**
 * Trittstein: sehr feine Steinkörnung (Punkte und dünne Adern) auf hellgrauem Grund, mit einigen
 * grossen, kaum sichtbaren Wolken für die Tonvarianz.
 */
function paintStep(ctx: Painter, n: number, rnd: () => number): void {
  const k = n / SIZE;

  ctx.fillStyle = rgb(STEP);
  ctx.fillRect(0, 0, n, n);

  for (let i = 0; i < 70; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = range(rnd, 8, 26) * k;
    const squash = range(rnd, 0.6, 1);
    const rot = rnd() * Math.PI;
    const tint: Rgb = rnd() < 0.5 ? [196, 196, 192] : WHITE;
    const a = range(rnd, 0.06, 0.1);
    for (const f of [1, 0.6]) dot(ctx, n, x, y, r * f, r * f * squash, rot, rgba(tint, a));
  }

  // Adern: dunkle Linie mit hellem Gegenstück daneben, einzelne mit Abzweig
  const veins: { x: number; y: number; pts: Pt[]; w: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const pts = veinPoints(rnd, rnd() * Math.PI * 2, range(rnd, 90, 220), k);
    veins.push({ x, y, pts, w: range(rnd, 0.7, 1.5) * k });
    if (rnd() < 0.45) {
      const from = pts[1 + Math.floor(rnd() * (pts.length - 2))];
      veins.push({
        x: x + from.x,
        y: y + from.y,
        pts: veinPoints(rnd, rnd() * Math.PI * 2, range(rnd, 30, 80), k),
        w: range(rnd, 0.6, 1) * k,
      });
    }
  }
  for (const v of veins) {
    const reach = reachOf(v.pts);
    const pad = v.w + 1.5 * k;
    const dark = rgba([150, 148, 142], range(rnd, 0.22, 0.36));
    const light = rgba(WHITE, 0.5);
    const line = (ox: number, oy: number) => {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      for (let i = 1; i < v.pts.length - 1; i++) {
        const a = v.pts[i];
        const b = v.pts[i + 1];
        ctx.quadraticCurveTo(ox + a.x, oy + a.y, ox + (a.x + b.x) / 2, oy + (a.y + b.y) / 2);
      }
      const last = v.pts[v.pts.length - 1];
      ctx.lineTo(ox + last.x, oy + last.y);
      ctx.stroke();
    };
    wrap(n, mod(v.x, n), mod(v.y, n), reach.x + pad, reach.y + pad, (cx, cy) => {
      ctx.lineWidth = v.w;
      ctx.strokeStyle = light;
      line(cx + 1.2 * k, cy + 1.2 * k);
      ctx.strokeStyle = dark;
      line(cx, cy);
    });
  }

  // feine Körnung
  for (let i = 0; i < 2800; i++) {
    const s = range(rnd, 1, 1.9) * k;
    const roll = rnd();
    const colour =
      roll < 0.5
        ? rgba([110, 110, 108], range(rnd, 0.25, 0.5))
        : roll < 0.92
          ? rgba(WHITE, range(rnd, 0.5, 0.8))
          : rgba([176, 172, 166], 0.45);
    fleck(ctx, n, rnd() * n, rnd() * n, s, s, colour);
  }
}

/** Alle Maler der Wegtexturen (ohne DOM nutzbar, z. B. mit einem aufzeichnenden `Painter`). */
export const PAINTERS = {
  cobble: paintCobble,
  flag: paintFlag,
  earth: paintEarth,
  step: paintStep,
} satisfies Record<string, PaintFn>;

/** Zeichnet die Textur `paint` auf eine 512-px-Zeichenfläche, seeded über `name`. */
function makeTexture(name: string, paint: PaintFn): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d")!;
  paint(ctx, SIZE, seededRandom(name));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Kachelbare Kopfsteinpflaster-Textur (Kachel = `TILE_METERS.pflaster`). */
export function cobbleTexture(): THREE.CanvasTexture {
  return makeTexture("pflaster", paintCobble);
}

/** Kachelbare Steinplatten-Textur (Kachel = `TILE_METERS.platten`). */
export function flagTexture(): THREE.CanvasTexture {
  return makeTexture("platten", paintFlag);
}

/** Kachelbare Erdweg-Textur mit Fahrspuren in V-Richtung (Kachel = `TILE_METERS.erde`). */
export function earthTexture(): THREE.CanvasTexture {
  return makeTexture("erde", paintEarth);
}

/** Kachelbare, sehr feine Trittstein-Textur (Kachel = `TILE_METERS.tritt`). */
export function stepTexture(): THREE.CanvasTexture {
  return makeTexture("tritt", paintStep);
}

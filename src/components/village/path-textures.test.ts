import { describe, expect, it } from "vitest";
import { seededRandom } from "./colors";
import { PAINTERS, TILE_METERS, type Painter } from "./path-textures";

const N = 512;
/** Seeds der echten Texturen (siehe `makeTexture` in path-textures.ts). */
const SEEDS = { cobble: "pflaster", flag: "platten", earth: "erde", step: "tritt" } as const;
type Key = keyof typeof PAINTERS;
const KEYS = Object.keys(PAINTERS) as Key[];

type Shape = {
  kind: "rect" | "path";
  op: "fill" | "stroke";
  style: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** Zeichnet jeden fill/stroke/fillRect-Aufruf mit Farbe und Umriss (Bounding Box) auf. */
class Recorder implements Painter {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  shapes: Shape[] = [];
  private pts: [number, number][] = [];

  fillRect(x: number, y: number, w: number, h: number): void {
    this.shapes.push({
      kind: "rect",
      op: "fill",
      style: this.fillStyle,
      x0: x,
      y0: y,
      x1: x + w,
      y1: y + h,
    });
  }
  beginPath(): void {
    this.pts = [];
  }
  moveTo(x: number, y: number): void {
    this.pts.push([x, y]);
  }
  lineTo(x: number, y: number): void {
    this.pts.push([x, y]);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    // Kontrollpunkt zählt mit: Umriss ist eine (leicht zu grosse) Hülle der Kurve
    this.pts.push([cx, cy], [x, y]);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number): void {
    const hx = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
    const hy = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
    this.pts.push([x - hx, y - hy], [x + hx, y + hy]);
  }
  closePath(): void {}
  fill(): void {
    this.push("fill", this.fillStyle, 0);
  }
  stroke(): void {
    this.push("stroke", this.strokeStyle, this.lineWidth / 2);
  }
  private push(op: Shape["op"], style: string, pad: number): void {
    const xs = this.pts.map((p) => p[0]);
    const ys = this.pts.map((p) => p[1]);
    this.shapes.push({
      kind: "path",
      op,
      style,
      x0: Math.min(...xs) - pad,
      y0: Math.min(...ys) - pad,
      x1: Math.max(...xs) + pad,
      y1: Math.max(...ys) + pad,
    });
  }
}

/** Lässt einen Maler mit dem Seed laufen und liefert alle aufgezeichneten Formen. */
function record(key: Key, seed: string = SEEDS[key]): Shape[] {
  const rec = new Recorder();
  PAINTERS[key](rec, N, seededRandom(seed));
  return rec.shapes;
}

const recorded = Object.fromEntries(KEYS.map((k) => [k, record(k)])) as Record<Key, Shape[]>;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Schlüssel einer Form (Art, Farbe, Grösse, Mittelpunkt), auf Tausendstel gerundet. */
const keyOf = (s: Shape, cx: number, cy: number) =>
  `${s.kind}|${s.op}|${s.style}|${r3(s.x1 - s.x0)}|${r3(s.y1 - s.y0)}|${r3(cx)}|${r3(cy)}`;

/** Farbe als Kanäle 0..255 und Deckkraft; wirft bei unbekanntem Format. */
function parseColour(c: string): { rgb: [number, number, number]; a: number } {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    return {
      rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number],
      a: 1,
    };
  }
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (!m) throw new Error(`Unbekanntes Farbformat: ${c}`);
  return {
    rgb: [Number(m[1]), Number(m[2]), Number(m[3])],
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/** Hintergrund, auf dem die Textur später liegt (helle Referenz der Wegfarben). */
const REF = [0xe8, 0xe4, 0xdc];

/** Farbe mit Deckkraft über die Referenz gelegt: so sieht man, was am Ende von ihr bleibt. */
function effective(c: string): [number, number, number] {
  const { rgb, a } = parseColour(c);
  return rgb.map((v, i) => a * v + (1 - a) * REF[i]) as [number, number, number];
}
/** Helligkeit nach Rec. 709 auf den kodierten Werten, 0..1. */
const luma = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const saturation = ([r, g, b]: number[]) =>
  (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);

describe("TILE_METERS", () => {
  it("nennt die Kachelgrösse jeder Wegtextur in Metern", () => {
    expect(TILE_METERS).toEqual({ kies: 1.4, pflaster: 1.2, platten: 2.4, erde: 2.0, tritt: 0.8 });
  });
});

describe.each(KEYS)("Maler %s", (key) => {
  const shapes = recorded[key];

  it("ist deterministisch (gleicher Seed, gleiche Aufrufe) und hängt vom Seed ab", () => {
    expect(record(key)).toEqual(shapes);
    expect(record(key, "anderer-seed")).not.toEqual(shapes);
  });

  it("füllt zuerst die ganze Kachel; alle Formen liegen in den 3 × 3 Kacheln um sie", () => {
    const bg = shapes[0];
    expect(bg.kind).toBe("rect");
    expect([bg.x0, bg.y0, bg.x1, bg.y1]).toEqual([0, 0, N, N]);
    expect(shapes.length).toBeGreaterThan(100);
    // Kopien liegen höchstens eine Kachel neben der Kachel (Versatz -N, 0, +N)
    const stray = shapes.filter(
      (s) =>
        ![s.x0, s.y0, s.x1, s.y1].every(Number.isFinite) ||
        s.x0 < -N ||
        s.y0 < -N ||
        s.x1 > 2 * N ||
        s.y1 > 2 * N,
    );
    expect(stray).toEqual([]);
  });

  it("kachelt nahtlos: jede Form, die über einen Rand ragt, hat ihre Kopie am Gegenrand", () => {
    const have = new Set(shapes.map((s) => keyOf(s, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2)));
    let crossing = 0;
    let copies = 0;
    const missing: string[] = [];
    for (const s of shapes) {
      const cx = (s.x0 + s.x1) / 2;
      const cy = (s.y0 + s.y1) / 2;
      for (const i of [-1, 0, 1]) {
        for (const j of [-1, 0, 1]) {
          if (i === 0 && j === 0) continue;
          // Wäre die um (i·N, j·N) verschobene Kopie in der Kachel sichtbar? Dann muss es sie geben.
          const visible =
            s.x1 + i * N > 0 && s.x0 + i * N < N && s.y1 + j * N > 0 && s.y0 + j * N < N;
          if (!visible) continue;
          copies++;
          if (!have.has(keyOf(s, cx + i * N, cy + j * N))) {
            missing.push(
              `${s.kind} ${s.style} bei ${r3(cx)}/${r3(cy)} fehlt für Versatz ${i}/${j}`,
            );
          }
        }
      }
      if (s.x0 < 0 || s.y0 < 0 || s.x1 > N || s.y1 > N) crossing++;
    }
    // Der Test ist nur aussagekräftig, wenn es überhaupt Formen über den Rändern gibt
    expect(crossing).toBeGreaterThan(5);
    expect(copies).toBeGreaterThan(5);
    expect(missing.slice(0, 5)).toEqual([]);
  });

  it("bleibt hell, ohne Schwarz und ohne gesättigte Farben", () => {
    const eff = shapes.map((s) => effective(s.style));
    const mean = eff.reduce((sum, c) => sum + luma(c), 0) / eff.length;
    expect(mean).toBeGreaterThan(0.55);
    expect(mean).toBeLessThan(0.95);
    expect(Math.min(...eff.map(luma))).toBeGreaterThan(0.4);
    expect(Math.max(...eff.map(saturation))).toBeLessThan(0.3);
  });
});

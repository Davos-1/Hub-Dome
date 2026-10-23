import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P6: Kontrast der Oberfläche nach WCAG AA (Text ≥ 4.5:1) für das Standard-Thema und die Glas-Varianten.
 * Durchscheinende Flächen werden über dem ungünstigsten Hintergrund gemessen: weisser Himmel (helle Schrift)
 * bzw. schwarze Nacht (dunkle Schrift).
 */
const css = readFileSync(path.join(__dirname, "globals.css"), "utf8");

type Rgba = [number, number, number, number];

function block(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`(^|\\n)${selector.replace(/[[\]"=]/g, "\\$&")} \\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) {
    for (const d of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

function parse(v: string): Rgba | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(v);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
  return null;
}

const over = (top: Rgba, base: Rgba): Rgba => [
  top[0] * top[3] + base[0] * (1 - top[3]),
  top[1] * top[3] + base[1] * (1 - top[3]),
  top[2] * top[3] + base[2] * (1 - top[3]),
  1,
];

function lum(c: Rgba) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

const ratio = (a: Rgba, b: Rgba) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const root = block(":root");
const shared = block("[data-hd-theme]");
const THEMES: Record<string, Record<string, string>> = {
  holz: root,
  nachtglas: { ...root, ...shared, ...block('[data-hd-theme="nachtglas"]') },
  waldglas: { ...root, ...shared, ...block('[data-hd-theme="waldglas"]') },
  rauchglas: { ...root, ...shared, ...block('[data-hd-theme="rauchglas"]') },
};

/** Text auf Fläche: [Text-Token, Flächen-Tokens von unten nach oben]. */
const PAIRS: [string, string[]][] = [
  ["hd-ink", ["hd-surface"]],
  ["hd-ink-2", ["hd-surface"]],
  ["hd-muted", ["hd-surface"]],
  ["hd-ink", ["hd-surface", "hd-raised"]],
  ["hd-muted", ["hd-surface", "hd-raised"]],
  ["hd-ink-2", ["hd-surface", "hd-sunken"]],
  ["hd-danger", ["hd-surface"]],
  ["hd-danger", ["hd-surface", "hd-danger-soft"]],
  ["hd-accent-ink", ["hd-surface", "hd-accent"]],
  ["hd-selected-ink", ["hd-surface", "hd-selected"]],
  ["hd-new-ink", ["hd-surface", "hd-new"]],
  ["hd-info-ink", ["hd-surface", "hd-info-soft"]],
  ["hd-head-ink", ["hd-surface", "hd-head"]],
  ["hd-highlight-ink", ["hd-surface", "hd-highlight"]],
  ["hd-danger-ink", ["hd-surface", "hd-danger"]],
];

describe("Kontrast der Oberfläche (WCAG AA)", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: Text ≥ 4.5:1 über hellem und dunklem Hintergrund`, () => {
      expect(Object.keys(t).length).toBeGreaterThan(20);
      const fails: string[] = [];
      for (const [fg, layers] of PAIRS) {
        const ink = parse(t[fg]);
        expect(ink, `${name} ${fg}`).not.toBeNull();
        for (const base of [
          [255, 255, 255, 1],
          [0, 0, 0, 1],
          [120, 170, 90, 1],
        ] as Rgba[]) {
          let bg = base;
          for (const l of layers) {
            const c = parse(t[l]);
            expect(c, `${name} ${l}`).not.toBeNull();
            bg = over(c!, bg);
          }
          const text = over(ink!, bg);
          const r = ratio(text, bg);
          if (r < 4.5)
            fails.push(`${fg} auf ${layers.join("+")} über ${base.join(",")}: ${r.toFixed(2)}`);
        }
      }
      expect(fails).toEqual([]);
    });
  }
});

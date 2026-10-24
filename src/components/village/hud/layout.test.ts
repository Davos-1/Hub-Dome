import { describe, expect, it } from "vitest";
import { HUD, hudLayout, RING_X, RING_Y, sucherAround, type Rect } from "./layout";

const SIZES: [number, number][] = [
  [924, 540],
  [1024, 700],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];
const LISTS = [0, 320, 420];

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Fläche von Haus samt Sucher und Kacheln. */
const ringOf = (h: Rect): Rect => ({
  x: h.x - RING_X,
  y: h.y - RING_Y,
  w: h.w + 2 * RING_X,
  h: h.h + 2 * RING_Y,
});

/** Zoomregler rechts (34 px breit, vertikal mittig, rund 260 px hoch). */
const zoomOf = (W: number, H: number): Rect => ({ x: W - 16 - 34, y: H / 2 - 130, w: 34, h: 260 });
/** Leiste unten (nur ohne Tafel), höchstens 520 px breit, mittig in der Fläche rechts der Liste. */
const barOf = (W: number, H: number, L: number): Rect => ({
  x: L + (W - L) / 2 - 260,
  y: H - 16 - 44,
  w: 520,
  h: 44,
});

describe("Anordnung um die Welt (Tafel am Ort)", () => {
  it("Tafel, Kacheln, Leiste, Zoomregler und Liste überlappen sich nicht", () => {
    const problems: string[] = [];
    for (const [W, H] of SIZES)
      for (const L of LISTS)
        for (const tafel of [false, true]) {
          const tag = `${W}×${H} Liste ${L} Tafel ${tafel}`;
          const lay = hudLayout({ width: W, height: H, listW: L, level: "haus", tafel });
          expect(lay.house, tag).not.toBeNull();
          const house = lay.house!;
          const zoom = zoomOf(W, H);
          const list: Rect = { x: 0, y: 0, w: L, h: H };
          // Haus immer rechts der Liste, unter der Kopfzeile und im Bild
          if (house.x < L) problems.push(`${tag}: Haus unter der Liste`);
          if (house.y < HUD.top) problems.push(`${tag}: Haus unter der Kopfzeile`);
          if (house.x + house.w > W || house.y + house.h > H)
            problems.push(`${tag}: Haus ausserhalb`);
          if (lay.ring) {
            const ring = ringOf(house);
            if (intersects(ring, zoom)) problems.push(`${tag}: Kacheln auf dem Zoomregler`);
            if (L && intersects(ring, list)) problems.push(`${tag}: Kacheln auf der Liste`);
            if (ring.y < HUD.top - 1) problems.push(`${tag}: Kacheln unter der Kopfzeile`);
            if (!tafel && intersects(ring, barOf(W, H, L)))
              problems.push(`${tag}: Kacheln auf der Leiste`);
            if (lay.tafel && intersects(ring, lay.tafel))
              problems.push(`${tag}: Kacheln auf der Tafel`);
          }
          if (lay.tafel) {
            const t = lay.tafel;
            if (intersects(t, house)) problems.push(`${tag}: Tafel auf dem Haus`);
            if (intersects(t, zoom)) problems.push(`${tag}: Tafel auf dem Zoomregler`);
            if (L && t.x < L) problems.push(`${tag}: Tafel auf der Liste`);
            if (t.x + t.w > W || t.y + t.h > H) problems.push(`${tag}: Tafel ausserhalb`);
            if (t.w < 250) problems.push(`${tag}: Tafel zu schmal (${t.w})`);
          }
        }
    expect(problems).toEqual([]);
  });

  it("bei 924 × 540 und 1440 × 900 ohne Liste stehen Haus, Kacheln und Tafel nebeneinander", () => {
    for (const [W, H] of [
      [924, 540],
      [1440, 900],
    ] as const) {
      const lay = hudLayout({ width: W, height: H, listW: 0, level: "haus", tafel: true });
      expect(lay.ring).toBe(true);
      expect(lay.tafel?.dock).toBe(false);
      // Die Tafel steht rechts der Kacheln
      expect(lay.tafel!.x).toBeGreaterThanOrEqual(lay.house!.x + lay.house!.w + RING_X);
    }
  });

  it("schmale Fläche (Liste und Tafel zugleich): Tafel dockt an, Kacheln entfallen", () => {
    const lay = hudLayout({ width: 924, height: 540, listW: 420, level: "haus", tafel: true });
    expect(lay.tafel?.dock).toBe(true);
    expect(lay.ring).toBe(false);
  });

  it("Handy: Tafel als Blatt unten, Haus oben", () => {
    const lay = hudLayout({ width: 390, height: 844, listW: 0, level: "haus", tafel: true });
    expect(lay.tafel?.sheet).toBe(true);
    expect(lay.house!.y + lay.house!.h).toBeLessThanOrEqual(lay.tafel!.y);
  });

  it("Quartier: Tafel rechts, Kamera passt das Quartier links davon ein", () => {
    const lay = hudLayout({ width: 1440, height: 900, listW: 0, level: "quartier", tafel: true });
    expect(lay.tafel?.dock).toBe(true);
    expect(lay.frame.right).toBeLessThan((2 * lay.tafel!.x) / 1440 - 1 + 1e-9);
  });

  it("Inventar: Welt nur im Streifen oben", () => {
    const lay = hudLayout({
      width: 1440,
      height: 900,
      listW: 0,
      level: "dorf",
      tafel: false,
      strip: 150,
    });
    expect(lay.frame.top).toBe(1);
    expect(lay.frame.bottom).toBeCloseTo(1 - 300 / 900);
  });

  it("Sucher umschliesst die Hülle, Kacheln liegen ausserhalb und mittig an den vier Seiten", () => {
    const hull = { x: 500, y: 300, w: 200, h: 120 };
    const { sucher, tiles } = sucherAround(hull);
    expect(sucher.x).toBeLessThan(hull.x);
    expect(sucher.y + sucher.h).toBeGreaterThan(hull.y + hull.h);
    const [top, right, bottom, left] = tiles;
    expect(top.x).toBe(600);
    expect(top.y + HUD.tileH / 2).toBeLessThan(sucher.y);
    expect(right.x - HUD.tileW / 2).toBeGreaterThan(sucher.x + sucher.w);
    expect(bottom.y - HUD.tileH / 2).toBeGreaterThan(sucher.y + sucher.h);
    expect(left.x + HUD.tileW / 2).toBeLessThan(sucher.x);
  });
});

import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { generateMap, heightAt } from "./map";
import { generateMapV2 } from "./map-v2";
import { panoramaOf, riverDistance } from "./panorama";
import { makeSeed } from "./seed";

/**
 * P2: Die Karte geht ohne Kante in den Hintergrund über. Der vordere Ring beginnt unter der Bodenscheibe und
 * liegt an ihrem Rand darüber (ausser in Tälern, wo ein Wasserlauf weiterfliesst). Gilt für v1 und v2.
 */
const SEEDS = Array.from({ length: 40 }, (_, i) => makeSeed(seededRandom(`pano-${i}`)));

describe("Panorama: Übergang Karte → Berge", () => {
  for (const [name, gen] of [
    ["v1", generateMap],
    ["v2", generateMapV2],
  ] as const) {
    it(`${name}: innen unter dem Boden, am Rand darüber, nach aussen höher`, () => {
      for (const seed of SEEDS) {
        const m = gen(seed);
        const p = panoramaOf(m);
        const R = p.groundRadius;
        const ring = p.rings[0];
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          const x = Math.cos(a) * R;
          const z = Math.sin(a) * R;
          const inner = ring.rIn;
          expect(ring.height(a, inner)).toBeLessThanOrEqual(
            heightAt(m, Math.cos(a) * inner, Math.sin(a) * inner),
          );
          if (riverDistance(m, x, z) > 30)
            expect(ring.height(a, R), `${seed} ${a}`).toBeGreaterThan(heightAt(m, x, z) + 0.3);
          // Der hintere Ring ragt über den vorderen (gestaffelt), wenigstens irgendwo deutlich
        }
        const farTop = Math.max(
          ...Array.from({ length: 90 }, (_, k) =>
            p.rings[2].height((k / 90) * Math.PI * 2, (p.rings[2].rIn + p.rings[2].rOut) / 2),
          ),
        );
        const nearTop = Math.max(
          ...Array.from({ length: 90 }, (_, k) => ring.height((k / 90) * Math.PI * 2, ring.rOut)),
        );
        expect(farTop).toBeGreaterThan(nearTop * 2);
      }
    });
  }

  it("Schnee nur bei hohen Gipfeln, bei «Alpin» tiefer", () => {
    const maps = SEEDS.map(generateMapV2);
    for (const m of maps) {
      const p = panoramaOf(m);
      expect(p.snowLine).toBeGreaterThan(p.treeLine);
    }
    const alpin = maps.filter((m) => m.stimmung === "alpin").map((m) => panoramaOf(m).snowLine);
    const other = maps.filter((m) => m.stimmung !== "alpin").map((m) => panoramaOf(m).snowLine);
    if (alpin.length && other.length) expect(Math.min(...alpin)).toBeLessThan(Math.max(...other));
  });
});

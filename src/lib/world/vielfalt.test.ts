import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { generateMap, riversOf, waterEdgeDist, type WorldMap } from "./map";
import { generateMapV2, LANDSCHAFTEN_V2 } from "./map-v2";
import { makeSeed } from "./seed";

/**
 * P4: Wie verschieden sind Welten wirklich? Merkmale je Welt (Landschaft, Stimmung, Wasser nahe am Dorf,
 * Hügelhöhe, Wald- und Felsanteil, Seed-Objekte) über 100 Seeds. Generator v2 muss deutlich vielfältiger sein
 * als v1 (dort: 16 Kombinationen, Wasser immer am Rand, fast immer dieselben Merkmale).
 */

const SEEDS = Array.from({ length: 100 }, (_, i) => makeSeed(seededRandom(`vielfalt-${i}`)));

/** Abstand des nächsten Flusses, Bachs oder Sees zur Dorfmitte (über Kreise abgetastet; Teiche zählen nicht). */
function waterNear(world: WorldMap): number {
  const m = { ...world, pond: null };
  let best = Infinity;
  for (let r = 20; r <= 120; r += 4)
    for (let a = 0; a < 48; a++) {
      const x = Math.cos((a / 48) * Math.PI * 2) * r;
      const z = Math.sin((a / 48) * Math.PI * 2) * r;
      if (waterEdgeDist(m, x, z) < 0) best = Math.min(best, r);
    }
  return best;
}

/** Merkmale einer Welt als Text (gleich = gleiche Welt auf einen Blick). */
function features(m: WorldMap): string {
  const objs = [
    ...(m.objects ?? []).map((o) => o.typ),
    ...(m.pond ? ["teich"] : []),
    ...(m.pasture ? ["weide"] : []),
    ...(m.windmill ? ["windmuehle"] : []),
    ...(m.orchard ? ["obstgarten"] : []),
  ].sort();
  return [m.landschaft, m.stimmung, riversOf(m).length, m.lake ? "see" : "", objs.join("+")].join(
    "|",
  );
}

describe("Vielfalt der Welten (P4)", { timeout: 60_000 }, () => {
  const v1 = SEEDS.map(generateMap);
  const v2 = SEEDS.map(generateMapV2);

  it("v2 nutzt alle Landschaftstypen und viele Kombinationen mit der Stimmung", () => {
    const types = new Set(v2.map((m) => m.landschaft));
    expect(types.size).toBe(LANDSCHAFTEN_V2.length);
    const combos = new Set(v2.map((m) => `${m.landschaft}/${m.stimmung}`));
    expect(combos.size).toBeGreaterThanOrEqual(22);
    expect(new Set(v1.map((m) => `${m.landschaft}/${m.stimmung}`)).size).toBeLessThanOrEqual(16);
  });

  it("keine zwei v2-Welten haben dieselben Merkmale (Landschaft, Stimmung, Wasser, Objekte)", () => {
    const f = v2.map(features);
    expect(new Set(f).size).toBeGreaterThanOrEqual(98);
  });

  it("Fluss, Bach oder See liegt in den meisten v2-Welten nahe am Dorf (v1: nie näher als 64 m)", () => {
    const near2 = v2.filter((m) => waterNear(m) <= 64).length;
    const near1 = v1.filter((m) => waterNear(m) <= 64).length;
    expect(near2).toBeGreaterThanOrEqual(70);
    expect(near1).toBe(0);
  });

  it("kontinuierliche Parameter streuen breit (Hügel, Wald, Felsen, Farbton)", () => {
    const span = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(span(v2.map((m) => m.hills.amp))).toBeGreaterThan(5);
    expect(span(v2.map((m) => m.params!.forest))).toBeGreaterThan(0.7);
    expect(span(v2.map((m) => m.params!.tint))).toBeGreaterThan(1.5);
    expect(span(v2.map((m) => (m.rocks ?? []).length))).toBeGreaterThan(8);
  });

  it("jede v2-Welt hat eine Auswahl an Merkmalen, nicht alles und nicht nichts", () => {
    for (const m of v2) {
      const n =
        (m.objects ?? []).length +
        [m.pond, m.pasture, m.windmill, m.orchard].filter(Boolean).length;
      expect(n, m.seed).toBeGreaterThanOrEqual(3);
      expect(n, m.seed).toBeLessThanOrEqual(9);
    }
    // Kein Objekt kommt in mehr als 60 % der Welten vor (v1: Weide 90 %)
    const count = new Map<string, number>();
    for (const m of v2)
      for (const k of features(m).split("|")[4].split("+").filter(Boolean))
        count.set(k, (count.get(k) ?? 0) + 1);
    for (const [k, c] of count) expect(c, k).toBeLessThanOrEqual(60);
  });
});

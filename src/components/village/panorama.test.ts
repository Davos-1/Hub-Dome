import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/random";
import { generateMap } from "@/lib/world/map";
import { generateMapV2 } from "@/lib/world/map-v2";
import { makeSeed } from "@/lib/world/seed";
import { panoramaBudget } from "./panorama";

/** P2: Budget des Hintergrunds über viele Welten (v1 und v2). */
describe("Panorama-Budget", () => {
  const seeds = Array.from({ length: 16 }, (_, i) => makeSeed(seededRandom(`budget-${i}`)));
  it("Desktop ≤ 100 000 Dreiecke und ≤ 8 Draw Calls, Mobile ≤ 25 000", () => {
    for (const seed of seeds)
      for (const map of [generateMap(seed), generateMapV2(seed)]) {
        const hi = panoramaBudget(map, false);
        const lo = panoramaBudget(map, true);
        expect(hi.triangles, seed).toBeLessThanOrEqual(100_000);
        expect(hi.drawCalls).toBeLessThanOrEqual(8);
        expect(lo.triangles, seed).toBeLessThanOrEqual(25_000);
        expect(lo.drawCalls).toBeLessThanOrEqual(8);
      }
  }, 60_000);
});

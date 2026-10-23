import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/random";
import { generateWorld } from "@/lib/world/generate";
import { makeSeed } from "@/lib/world/seed";
import { DISTS, village } from "@/lib/world/test-world";
import { pathBudget } from "./path-layer";

/** P7: feinere Wege bleiben im Budget (höchstens sechs Draw Calls; Dreiecke auch bei 40 Häusern begrenzt). */
describe("Wege: Budget", () => {
  it("Desktop und Mobile, v1 und v2, bis 40 Häuser", () => {
    const rows: string[] = [];
    for (let i = 0; i < 6; i++) {
      const seed = makeSeed(seededRandom(`budget-weg-${i}`));
      for (const version of [1, 2]) {
        const w = generateWorld({ version, seed, houses: village(40, DISTS.alleNeun, seed, 2) });
        const desk = pathBudget(w, false);
        const mob = pathBudget(w, true);
        rows.push(`${seed} v${version}: ${desk.tris}/${desk.calls} · ${mob.tris}/${mob.calls}`);
        expect(desk.calls).toBeLessThanOrEqual(6);
        expect(desk.tris, rows.at(-1)).toBeLessThanOrEqual(50_000);
        expect(mob.tris, rows.at(-1)).toBeLessThanOrEqual(25_000);
      }
    }
  }, 120_000);
});

import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "../fachbereiche";
import { seededRandom } from "../random";
import { generateWorld } from "./generate";
import { relocateDoc, relocationResult } from "./relocate";
import { makeSeed } from "./seed";
import { DISTS, village, violations } from "./test-world";

const SEEDS = Array.from({ length: 36 }, (_, i) => makeSeed(seededRandom(`umzug-${i}`)));

describe("Quartier umziehen", () => {
  it("andere Häuser bleiben stehen, das Haus landet im Zielquartier, die Welt bleibt gültig", () => {
    const problems: string[] = [];
    let moved = 0;
    SEEDS.forEach((seed, i) => {
      const version = i % 3 === 0 ? 1 : 2;
      const n = [3, 8, 14, 22][i % 4];
      const hs = village(n, i % 2 ? DISTS.zufall : DISTS.gemischt, seed);
      const before = generateWorld({ version, seed, houses: hs });
      const r = seededRandom(`wahl-${seed}`);
      const pick = hs[1 + Math.floor(r() * n)];
      const to = FACH_ORDER.filter((f) => f !== pick.fach)[Math.floor(r() * 7)];
      const doc = relocateDoc(before, { v: 1 }, pick.id);
      const houses = hs.map((h) => (h.id === pick.id ? { ...h, fach: to } : h));
      const after = generateWorld({ version, seed, houses, doc });

      // Kein anderes Haus bewegt sich, keine Fixierung wird verworfen
      expect(after.settlement.droppedPins, seed).toEqual([]);
      for (const [id, h] of Object.entries(before.settlement.houses)) {
        if (id === pick.id) continue;
        const a = after.settlement.houses[id];
        expect([a.x, a.z, a.angle], `${seed} ${id}`).toEqual([h.x, h.z, h.angle]);
      }
      const res = relocationResult(after, pick.id, to);
      if (res.ok) {
        moved++;
        expect(after.settlement.houses[pick.id].quarterId).toBe(to);
      }
      for (const v of violations(after)) problems.push(`${seed} n=${n}: ${v}`);
    });
    expect(problems.slice(0, 10)).toEqual([]);
    // Fast immer findet sich ein Platz (sonst meldet der Server den Grund und ändert nichts)
    expect(moved).toBeGreaterThanOrEqual(SEEDS.length - 2);
  }, 120_000);

  it("die Gasse des alten Quartiers bleibt nur fixiert, solange dort noch Häuser stehen", () => {
    const seed = SEEDS[0];
    const hs = village(4, DISTS.alleNeun, seed);
    const before = generateWorld({ seed, houses: hs });
    const only = hs[1];
    const doc = relocateDoc(before, { v: 1, deko: [] }, only.id);
    expect(doc.quartiere?.[only.fach]).toBeUndefined();
    expect(doc.haeuser?.[only.id]).toBeUndefined();
    expect(doc.deko).toEqual([]);
    expect(Object.keys(doc.haeuser ?? {}).sort()).toEqual(
      Object.keys(before.settlement.houses)
        .filter((id) => id !== only.id)
        .sort(),
    );
  });

  it("v3: der Eckpunkt des umziehenden Hauses entfällt, andere bleiben", () => {
    const seed = SEEDS[0];
    const hs = village(6, DISTS.gemischt, seed);
    const before = generateWorld({ version: 3, seed, houses: hs, lowDetail: true });
    const [a, b] = hs.slice(1, 3).map((h) => h.id);
    const P = { x: 1, z: 2 };
    expect(relocateDoc(before, { v: 1, roadBends: { [a]: P, [b]: P } }, a).roadBends).toEqual({
      [b]: P,
    });
    expect("roadBends" in relocateDoc(before, { v: 1, roadBends: { [a]: P } }, a)).toBe(false);
  });
});

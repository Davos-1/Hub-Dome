import { describe, expect, it } from "vitest";
import type { FachbereichId } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { seededRandom } from "../random";
import { generateWorld } from "./generate";
import { pointShapeDist, toWorld, type Pt } from "./geom";
import { NODE_RP } from "./axes";
import { PLOT } from "./plot";
import type { QuarterRoad } from "./roads";
import { makeSeed } from "./seed";
import { pinsFromSettlement, plotShape } from "./settlement";
import { DISTS, village, violations } from "./test-world";
import type { WorldDoc } from "./doc";

/**
 * v3: Eckpunkte im Stichweg und Reihenfolge der fixierten Häuser (Befunde der Abnahme 4h): Ein Weg über einen
 * Eckpunkt führt nie durchs eigene Grundstück, quer über die eigene Gasse, den Kernweg oder den Quartierplatz;
 * fixierte Häuser landen unabhängig von der Reihenfolge, in der Browser oder Server sie laden.
 */

const SEEDS = Array.from({ length: 6 }, (_, i) => makeSeed(seededRandom(`eckpunkt-${i}`)));
const Q: FachbereichId = "grundlagen";
const FORMS: QuarterRoad[] = [
  { form: "gasse" },
  { form: "ring", radius: 7 },
  { form: "halbkreis", radius: 7 },
  { form: "intelligent", curve: 2 },
];

function oneQuarter(n: number, extra: number, seed: string): LayoutHouse[] {
  const hs = village(extra, DISTS.gemischt, seed);
  for (let i = 0; i < n; i++)
    hs.push({ id: `q${i}`, kind: "modul", fach: Q, order: 100 + i, items: [] });
  return hs;
}

/** Wie im Bau-Modus: Quartiere fixieren, dann die Wegform setzen. */
function withForm(seed: string, hs: LayoutHouse[], road: QuarterRoad) {
  const w0 = generateWorld({ version: 3, seed, houses: hs, lowDetail: true });
  const doc: WorldDoc = {
    v: 1,
    quartiere: pinsFromSettlement(w0.settlement).quartiere,
    quarterRoads: { [Q]: road },
  };
  return { doc, world: generateWorld({ version: 3, seed, houses: hs, doc, lowDetail: true }) };
}

/** Kreuzen sich die Strecken ab und cd echt (nicht nur berührend)? */
function cross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

function crosses(p: Pt[], q: Pt[]): boolean {
  for (let i = 0; i < p.length - 1; i++)
    for (let j = 0; j < q.length - 1; j++) if (cross(p[i], p[i + 1], q[j], q[j + 1])) return true;
  return false;
}

describe("v3: Eckpunkte im Stichweg", () => {
  it("ein angenommener Eckpunkt führt nie durchs eigene Grundstück, über Gasse, Kernweg oder Platz", () => {
    let accepted = 0;
    let behind = 0;
    for (const seed of SEEDS.slice(0, 4)) {
      const hs = oneQuarter(8, 4, seed);
      for (const road of FORMS) {
        const { doc, world } = withForm(seed, hs, road);
        const node = world.settlement.nodes.find((n) => n.quarterId === Q)!;
        const own = world.settlement.paths.filter(
          (p) => p.ownerId === Q && (p.kind === "gasse" || p.kind === "haupt"),
        );
        const homes = Object.values(world.settlement.houses)
          .filter((h) => h.quarterId === Q && world.settlement.spurs[h.id])
          .slice(0, 3);
        const r = seededRandom(`${seed}-${road.form}`);
        for (const h of homes) {
          const at = (lx: number, lz: number) => toWorld(h.x, h.z, h.angle, lx, lz);
          const gate = at(0, PLOT.front - 0.05);
          const bends: { p: Pt; behind?: boolean }[] = [
            { p: at(0, -PLOT.back - 1.2), behind: true },
            { p: at(PLOT.hw * 0.5, -PLOT.back - 2), behind: true },
            { p: at(0, PLOT.front + 4) },
            { p: at(PLOT.hw + 1.6, PLOT.front + 1) },
            { p: { x: node.x + 1, z: node.z } },
            ...Array.from({ length: 3 }, () => {
              const a = r() * Math.PI * 2;
              const d = 1.5 + r() * 6;
              return { p: { x: gate.x + Math.cos(a) * d, z: gate.z + Math.sin(a) * d } };
            }),
          ];
          for (const b of bends) {
            const w = generateWorld({
              version: 3,
              seed,
              houses: hs,
              doc: { ...doc, ...pinsFromSettlement(world.settlement), roadBends: { [h.id]: b.p } },
              lowDetail: true,
            });
            const dropped = w.settlement.droppedBends.includes(h.id);
            if (b.behind) {
              expect(dropped, `${seed} ${road.form} ${h.id} hinter dem Haus`).toBe(true);
              behind++;
              continue;
            }
            if (dropped) continue;
            const hh = w.settlement.houses[h.id];
            const spur = w.settlement.spurs[h.id];
            expect(spur, `${seed} ${road.form} ${h.id}`).toBeTruthy();
            accepted++;
            // Nach dem Tor nie mehr im eigenen Grundstück
            const plot = plotShape(hh.x, hh.z, hh.angle);
            let s = 0;
            for (let i = 1; i < spur.length; i++) {
              s += Math.hypot(spur[i].x - spur[i - 1].x, spur[i].z - spur[i - 1].z);
              if (s >= 1.2) expect(pointShapeDist(spur[i].x, spur[i].z, plot)).toBeGreaterThan(0);
            }
            // Quert weder eigene Gasse, Hauptweg noch Kernweg und bleibt neben dem Quartierplatz
            for (const p of own) expect(crosses(spur, p.points), `${p.id}`).toBe(false);
            for (const p of spur)
              expect(Math.hypot(p.x - node.x, p.z - node.z)).toBeGreaterThan(NODE_RP - 0.3);
            expect(violations(w)).toEqual([]);
          }
        }
      }
    }
    expect(behind).toBeGreaterThan(20);
    expect(accepted).toBeGreaterThan(10);
  }, 240_000);
});

describe("v3: fixierte Häuser", () => {
  it("Reihenfolge der Häuser ändert nichts (Intelligent mündet in schon gesetzte Wege)", () => {
    for (const seed of ["fqqn8sx7", ...SEEDS.slice(0, 3)]) {
      const hs = oneQuarter(16, 4, seed);
      const { doc, world } = withForm(seed, hs, { form: "intelligent", curve: 2 });
      const pinned: WorldDoc = { ...doc, ...pinsFromSettlement(world.settlement) };
      const key = (w: ReturnType<typeof generateWorld>) =>
        JSON.stringify([w.settlement.houses, w.settlement.spurs]);
      const ref = generateWorld({ version: 3, seed, houses: hs, doc: pinned, lowDetail: true });
      expect(ref.settlement.droppedPins).toEqual([]);
      const quarter = hs.filter((h) => h.fach === Q);
      const rest = hs.filter((h) => h.fach !== Q);
      const r = seededRandom(seed);
      const orders = [
        [...rest, ...[...quarter].reverse()],
        [...quarter.slice(1), quarter[0], ...rest],
        [...hs].sort(() => r() - 0.5),
      ];
      for (const order of orders) {
        const w = generateWorld({ version: 3, seed, houses: order, doc: pinned, lowDetail: true });
        expect(w.settlement.droppedPins, seed).toEqual([]);
        expect(key(w), seed).toBe(key(ref));
      }
    }
  }, 120_000);
});

import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { moveGroup, draftFromDoc, draftDoc, unpinHouses } from "./build";
import type { WorldDoc } from "./doc";
import { dragBase, groupGhost, houseGhost, quarterDeko } from "./free-drag";
import { generateWorld, type World, type WorldInput } from "./generate";
import { makeSeed } from "./seed";
import { isFreePin, pinsFromSettlement } from "./settlement";
import { DISTS, village, violations } from "./test-world";

/**
 * P1 (Generator v2): Häuser frei ziehen und Quartiere als Gruppe verschieben. Jede Eingabe endet gültig oder
 * wird mit Grund abgewiesen; was gültig war, steht nach dem Speichern (Fixierung, Neuberechnung wie auf dem
 * Server) genau dort, ohne dass sonst etwas wandert.
 */
const SEEDS = Array.from({ length: 24 }, (_, i) => makeSeed(seededRandom(`frei-${i}`)));

function input(seed: string, n: number, dist = DISTS.gemischt): WorldInput {
  return { seed, version: 2, houses: village(n, dist, seed) };
}

/** Welt nach dem Speichern eines Entwurfs: alles fixiert, so wie der Bau-Modus speichert. */
function saved(inp: WorldInput, doc: WorldDoc): World {
  return generateWorld({ ...inp, doc });
}

const fixed = (w: World): WorldDoc => ({ v: 1, ...pinsFromSettlement(w.settlement), deko: w.deko });

describe("Haus frei ziehen (v2)", () => {
  it("zufällige Lagen enden gültig (und halten beim Neuladen) oder werden mit Grund abgewiesen", () => {
    let ok = 0;
    let bad = 0;
    for (const seed of SEEDS.slice(0, 14)) {
      const inp = input(seed, 14);
      const world = generateWorld(inp);
      const doc = fixed(world);
      const r = seededRandom(`zug-${seed}`);
      const ids = Object.keys(world.settlement.houses);
      const id = ids[Math.floor(r() * ids.length)];
      const h = world.settlement.houses[id];
      const base = dragBase({ ...inp, doc }, world, h.quarterId, new Set([id]));
      for (let k = 0; k < 14; k++) {
        const x = h.x + (r() - 0.5) * 50;
        const z = h.z + (r() - 0.5) * 50;
        const g = houseGhost(base, id, x, z);
        if (!g.ok) {
          expect(g.grund.length, `${seed} ${id}`).toBeGreaterThan(2);
          bad++;
          continue;
        }
        ok++;
        expect(Math.hypot(g.x - x, g.z - z)).toBeLessThan(5);
        const next: WorldDoc = {
          ...doc,
          haeuser: { ...doc.haeuser, [id]: { r: g.dir, x: g.x, z: g.z } },
        };
        const w2 = saved(inp, next);
        expect(w2.settlement.droppedPins, `${seed} ${id} ${g.x},${g.z}`).toEqual([]);
        const moved = w2.settlement.houses[id];
        expect([moved.x, moved.z, moved.slot]).toEqual([g.x, g.z, "frei"]);
        expect(moved.angle).toBeCloseTo(g.angle, 6);
        // Alle anderen Häuser bleiben, wo sie waren
        for (const o of ids.filter((o) => o !== id))
          expect([w2.settlement.houses[o].x, w2.settlement.houses[o].z]).toEqual([
            world.settlement.houses[o].x,
            world.settlement.houses[o].z,
          ]);
        expect(violations(w2), `${seed} ${id}`).toEqual([]);
      }
    }
    // Beides kommt vor: der Test prüft wirklich gültige und ungültige Lagen
    expect(ok).toBeGreaterThan(20);
    expect(bad).toBeGreaterThan(20);
  }, 120_000);

  it("Reihenfolge der Fixierungen spielt keine Rolle (die Datenbank sortiert Schlüssel um)", () => {
    for (const seed of SEEDS.slice(14, 20)) {
      const inp = input(seed, 16, DISTS.alleNeun);
      let world = generateWorld(inp);
      const r = seededRandom(`reihe-${seed}`);
      // Mehrere Häuser nacheinander frei ziehen
      for (let k = 0; k < 4; k++) {
        const ids = Object.keys(world.settlement.houses);
        const id = ids[Math.floor(r() * ids.length)];
        const h = world.settlement.houses[id];
        const base = dragBase({ ...inp, doc: fixed(world) }, world, h.quarterId, new Set([id]));
        const g = houseGhost(base, id, h.x + (r() - 0.5) * 16, h.z + (r() - 0.5) * 16);
        if (!g.ok) continue;
        const doc = fixed(world);
        world = saved(inp, {
          ...doc,
          haeuser: { ...doc.haeuser, [id]: { r: g.dir, x: g.x, z: g.z } },
        });
        expect(world.settlement.droppedPins).toEqual([]);
      }
      const doc = fixed(world);
      const entries = Object.entries(doc.haeuser ?? {});
      for (let k = 0; k < 3; k++) {
        const shuffled = [...entries].sort(() => r() - 0.5);
        const w2 = saved(inp, { ...doc, haeuser: Object.fromEntries(shuffled) });
        expect(w2.settlement.droppedPins).toEqual([]);
        for (const [id, h] of Object.entries(world.settlement.houses))
          expect([w2.settlement.houses[id].x, w2.settlement.houses[id].z]).toEqual([h.x, h.z]);
      }
    }
  }, 120_000);

  it("Zurück auf Automatik: ohne Fixierung bekommt das Haus wieder einen Platz, nichts anderes wandert", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const inp = input(seed, 12);
      const world = generateWorld(inp);
      const doc = fixed(world);
      const id = "h3";
      const h = world.settlement.houses[id];
      const base = dragBase({ ...inp, doc }, world, h.quarterId, new Set([id]));
      // Erste gültige Lage auf einem Kreis um das Haus
      let moved: World | null = null;
      for (let a = 0; a < 16 && !moved; a++) {
        const g = houseGhost(base, id, h.x + Math.cos(a) * 9, h.z + Math.sin(a) * 9);
        if (g.ok)
          moved = saved(inp, {
            ...doc,
            haeuser: { ...doc.haeuser, [id]: { r: g.dir, x: g.x, z: g.z } },
          });
      }
      if (!moved) continue;
      const draft = draftFromDoc(fixed(moved), moved.settlement);
      expect(isFreePin(draft.pins.haeuser[id])).toBe(true);
      const back = saved(inp, draftDoc(unpinHouses(draft, [id])));
      expect(back.settlement.unplaced).toEqual([]);
      expect(back.settlement.houses[id].quarterId).toBe(h.quarterId);
      for (const o of Object.keys(world.settlement.houses).filter((o) => o !== id))
        expect(back.settlement.houses[o].x).toBe(moved.settlement.houses[o].x);
      expect(violations(back)).toEqual([]);
    }
  }, 120_000);
});

describe("Quartier verschieben (v2)", () => {
  it("Häuser und eigene Deko bewegen sich gemeinsam, Verbindungspunkte bleiben, an der Grenze gekürzt", () => {
    const states = new Set<string>();
    for (const seed of SEEDS.slice(0, 16)) {
      const inp = input(seed, 18, DISTS.gemischt);
      const world = generateWorld(inp);
      const doc = fixed(world);
      const counts = new Map<string, number>();
      for (const h of Object.values(world.settlement.houses))
        counts.set(h.quarterId, (counts.get(h.quarterId) ?? 0) + 1);
      const q = [...counts.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0][0] as World["settlement"]["houses"][string]["quarterId"];
      const members = Object.values(world.settlement.houses).filter((h) => h.quarterId === q);
      const deko = quarterDeko(world, q);
      const base = dragBase(
        { ...inp, doc },
        world,
        q,
        new Set(members.map((h) => h.id)),
        new Set(deko.map((d) => d.id)),
      );
      const r = seededRandom(`gruppe-${seed}`);
      for (let k = 0; k < 4; k++) {
        const dx = (r() - 0.5) * 16;
        const dz = (r() - 0.5) * 16;
        const g = groupGhost(base, members, deko, dx, dz);
        states.add(g.state);
        if (g.state === "nein") {
          expect(g.grund).toBeTruthy();
          continue;
        }
        // Gleiche Richtung, nicht weiter als gewünscht (Raster 0.5 m)
        expect(Math.hypot(g.dx, g.dz)).toBeLessThanOrEqual(Math.hypot(dx, dz) + 0.75);
        if (Math.hypot(g.dx, g.dz) > 0.6) expect(g.dx * dx + g.dz * dz).toBeGreaterThan(0);
        const draft = moveGroup(draftFromDoc(doc, world.settlement), g.poses, g.deko);
        const w2 = saved(inp, draftDoc(draft));
        expect(w2.settlement.droppedPins, `${seed} ${q} ${g.dx},${g.dz}`).toEqual([]);
        expect(w2.rejected).toEqual([]);
        for (const h of members) {
          expect(w2.settlement.houses[h.id].x).toBe(g.poses[h.id].x);
          expect(w2.settlement.houses[h.id].z).toBe(g.poses[h.id].z);
        }
        // Verbindungspunkte: Quartierplätze und Ausgänge unverändert
        const nodes = (w: World) =>
          w.settlement.nodes.map((n) => `${n.quarterId} ${n.x} ${n.z}`).sort();
        expect(nodes(w2)).toEqual(nodes(world));
        expect(w2.settlement.lanes.map((l) => l.dir).sort()).toEqual(
          world.settlement.lanes.map((l) => l.dir).sort(),
        );
        expect(violations(w2), `${seed} ${q}`).toEqual([]);
      }
    }
    expect(states.has("ok") || states.has("grenze")).toBe(true);
  }, 180_000);
});

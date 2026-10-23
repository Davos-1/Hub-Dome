import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { ARTIFACT_KINDS } from "../types";
import { DEKO, DEKO_TYPEN } from "./catalog";
import { worldDocSchema, type DekoItem, type WorldDoc } from "./doc";
import { generateWorld, PLOT_CAPACITY, plotSlots } from "./generate";
import { overlaps, toWorld } from "./geom";
import { waterEdgeDist } from "./map";
import { checkDeko, dekoShape, snapDeko } from "./rules";
import { makeSeed } from "./seed";
import { pinsFromSettlement, plotShape, PLOT } from "./settlement";
import { DISTS, village, violations } from "./test-world";

const SEEDS = Array.from({ length: 220 }, (_, i) => makeSeed(seededRandom(`welt-${i}`)));

describe.each([1, 2] as const)("Welt-Generator v%i: Invarianten über viele Seeds", (version) => {
  it("keine Überlappungen, alles in der Karte, freier Zugang, Pflanzen ohne Konflikte (220 Seeds)", () => {
    const problems: string[] = [];
    SEEDS.forEach((seed, i) => {
      const dists = Object.entries(DISTS);
      const [name, dist] = dists[i % dists.length];
      const n = [0, 1, 3, 7, 12, 20, 30][i % 7];
      const w = generateWorld({ version, seed, houses: village(n, dist, seed) });
      // v2: selten bekommt bei neun Quartieren das letzte keinen Ausgang (Bach entlang der Achse)
      expect(w.settlement.unplaced.length, `${seed} ${name} n=${n}`).toBeLessThanOrEqual(
        version === 1 ? 0 : 1,
      );
      for (const v of violations(w)) problems.push(`${seed} ${name} n=${n}: ${v}`);
    });
    expect(problems.slice(0, 20)).toEqual([]);
  }, 120_000);

  it("grosse Dörfer: bis 40 Häuser bekommt jedes einen Bauplatz, bei 50 fast immer", () => {
    let villages50 = 0;
    let short50 = 0;
    let missing40 = 0;
    for (const seed of SEEDS.slice(0, 16)) {
      for (const [name, dist] of Object.entries(DISTS)) {
        const w40 = generateWorld({ version, seed, houses: village(40, dist, seed, 2) });
        // v2: Der Fluss liegt im Dorf; bis 40 Häuser fehlen höchstens 2 (trotz Rückfall auf freie Lagen)
        if (version === 1) expect(w40.settlement.unplaced, `${seed} ${name} n=40`).toEqual([]);
        else expect(w40.settlement.unplaced.length, `${seed} ${name} n=40`).toBeLessThanOrEqual(2);
        missing40 += w40.settlement.unplaced.length;
        const w50 = generateWorld({ version, seed, houses: village(50, dist, seed, 2) });
        villages50++;
        if (w50.settlement.unplaced.length) short50++;
        if (version === 1) expect(w50.settlement.unplaced.length).toBeLessThanOrEqual(1);
      }
    }
    if (version === 1) expect(short50 / villages50).toBeLessThan(0.03);
    // Anteil platzierter Häuser bei 40: mindestens 99.5 %
    expect(missing40 / (villages50 * 40)).toBeLessThanOrEqual(0.005);
  }, 120_000);

  it("ist deterministisch: gleicher Seed, gleiche Daten, gleiche Version = gleiche Welt", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const hs = village(14, DISTS.zufall, seed);
      const a = generateWorld({ version, seed, houses: hs });
      const b = generateWorld({ version, seed, houses: structuredClone(hs) });
      expect(JSON.stringify(a.layout)).toBe(JSON.stringify(b.layout));
      expect(JSON.stringify(a.vegetation)).toBe(JSON.stringify(b.vegetation));
      expect(JSON.stringify(a.lamps)).toBe(JSON.stringify(b.lamps));
      expect(a.map).toEqual(b.map);
    }
  }, 60_000);

  it("zwei Seeds ergeben verschiedene Welten (Landschaft, Stimmung, Ausgänge)", () => {
    const hs = village(8, DISTS.gemischt, "x");
    const a = generateWorld({ version, seed: SEEDS[0], houses: hs });
    const b = generateWorld({ version, seed: SEEDS[1], houses: hs });
    expect(JSON.stringify(a.layout.houses)).not.toBe(JSON.stringify(b.layout.houses));
    const kinds = new Set(
      SEEDS.slice(0, 40).map((s) => generateWorld({ version, seed: s, houses: [] }).map.landschaft),
    );
    const moods = new Set(
      SEEDS.slice(0, 40).map((s) => generateWorld({ version, seed: s, houses: [] }).map.stimmung),
    );
    expect(kinds.size).toBeGreaterThanOrEqual(version === 1 ? 4 : 6);
    expect(moods.size).toBe(4);
  }, 60_000);

  it("neue Häuser verschieben nie bestehende (auch mit mehr Objekten)", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const all = village(22, DISTS.zufall, seed);
      let prev = generateWorld({ version, seed, houses: all.slice(0, 1) });
      for (let n = 2; n <= all.length; n++) {
        const hs = all.slice(0, n);
        // ein bestehendes Haus bekommt zusätzlich Objekte (Grösse ändert sich, Bauplatz nicht)
        hs[1 + (n % (n - 1 || 1))] = {
          ...hs[1 + (n % (n - 1 || 1))],
          items: [...hs[1 + (n % (n - 1 || 1))].items, { id: `neu${n}`, kind: "quiz" }],
        };
        const next = generateWorld({ version, seed, houses: hs });
        for (const [id, h] of Object.entries(prev.settlement.houses)) {
          const k = next.settlement.houses[id];
          expect(k, `${seed}: ${id} verschwunden bei n=${n}`).toBeDefined();
          expect([k.x, k.z, k.angle], `${seed}: ${id} verschoben bei n=${n}`).toEqual([
            h.x,
            h.z,
            h.angle,
          ]);
        }
        prev = next;
      }
    }
  }, 120_000);

  it("Fixierungen halten den Stand genau fest, neue Häuser kommen dazu, ohne etwas zu verschieben", () => {
    for (const seed of SEEDS.slice(40, 60)) {
      const hs = village(12, DISTS.zufall, seed);
      const w = generateWorld({ version, seed, houses: hs });
      const doc: WorldDoc = { v: 1, ...pinsFromSettlement(w.settlement) };
      expect(worldDocSchema.safeParse(doc).success).toBe(true);
      const again = generateWorld({ version, seed, houses: hs, doc });
      expect(again.settlement.droppedPins).toEqual([]);
      expect(again.settlement.houses).toEqual(
        Object.fromEntries(
          Object.entries(w.settlement.houses).map(([id, h]) => [id, { ...h, pinned: true }]),
        ),
      );
      // Ein älteres Haus wird gelöscht und ein neues kommt dazu: fixierte bleiben stehen
      const changed = [...hs.filter((h) => h.id !== "h0"), { ...hs[1], id: "neu", order: 99 }];
      const after = generateWorld({ version, seed, houses: changed, doc });
      for (const [id, h] of Object.entries(w.settlement.houses)) {
        if (id === "h0") continue;
        expect([after.settlement.houses[id].x, after.settlement.houses[id].z]).toEqual([h.x, h.z]);
      }
      expect(after.settlement.houses.neu).toBeDefined();
    }
  }, 60_000);

  it("zufällige Deko-Eingaben enden gültig oder werden abgewiesen, nie ungültig gespeichert", () => {
    let placed = 0;
    let rejected = 0;
    for (const seed of SEEDS.slice(60, 100)) {
      const r = seededRandom(`deko-${seed}`);
      const hs = village(10, DISTS.zufall, seed);
      const deko: DekoItem[] = Array.from({ length: 40 }, (_, i) => ({
        id: `d${i}`,
        typ: DEKO_TYPEN[Math.floor(r() * DEKO_TYPEN.length)],
        x: Math.round((r() * 140 - 70) * 4) / 4,
        z: Math.round((r() * 140 - 70) * 4) / 4,
        r: Math.floor(r() * 24) * 15,
      }));
      const w = generateWorld({ version, seed, houses: hs, doc: { v: 1, deko } });
      placed += w.deko.length;
      rejected += w.rejected.length;
      expect(w.deko.length + w.rejected.length).toBe(deko.length);
      expect(violations(w)).toEqual([]);
      // Einrasten liefert immer etwas Gültiges oder nichts
      for (const d of deko.slice(0, 8)) {
        const s = snapDeko(w.editSpace, { ...d, id: `s-${d.id}` });
        if (s) expect(checkDeko(w.editSpace, s)).toBeNull();
      }
    }
    expect(placed).toBeGreaterThan(50);
    expect(rejected).toBeGreaterThan(50);
  }, 120_000);

  it("ein Steg rastet am Ufer ein und zeigt aufs Wasser", () => {
    let found = 0;
    for (const seed of SEEDS.slice(100, 160)) {
      const w = generateWorld({ version, seed, houses: village(3, DISTS.gemischt, seed) });
      const m = w.map;
      const target = m.pond ?? (m.lake ? { x: m.lake.x, z: m.lake.z, r: m.lake.r } : null);
      if (!target) continue;
      // grob neben das Wasser zielen
      const dx = -target.x;
      const dz = -target.z;
      const l = Math.hypot(dx, dz);
      const near = {
        x: target.x + (dx / l) * (target.r + 0.5),
        z: target.z + (dz / l) * (target.r + 0.5),
      };
      const s = snapDeko(w.editSpace, { id: "steg", typ: "steg", x: near.x, z: near.z, r: 0 });
      if (!s) continue;
      found++;
      expect(checkDeko(w.editSpace, s)).toBeNull();
      const tip = toWorld(s.x, s.z, (s.r * Math.PI) / 180, 0, 1.6);
      expect(waterEdgeDist(m, tip.x, tip.z)).toBeLessThan(0);
    }
    expect(found).toBeGreaterThan(10);
  }, 60_000);

  it("Deko auf dem Weg, im Garten, im Wasser oder ausserhalb wird mit Grund abgewiesen", () => {
    const seed = SEEDS[5];
    const w = generateWorld({ version, seed, houses: village(6, DISTS.gemischt, seed) });
    const p = w.layout.paths[0].points[10];
    expect(checkDeko(w.editSpace, { id: "a", typ: "bank", x: p.x, z: p.z, r: 0 })?.grund).toMatch(
      /Weg|Gasse/,
    );
    const h = Object.values(w.settlement.houses)[0];
    expect(checkDeko(w.editSpace, { id: "b", typ: "busch", x: h.x, z: h.z, r: 0 })?.grund).toMatch(
      /Garten/,
    );
    expect(checkDeko(w.editSpace, { id: "c", typ: "bank", x: 500, z: 0, r: 0 })?.grund).toBe(
      "ausserhalb der Karte",
    );
    const gate = toWorld(h.x, h.z, h.angle, 0, PLOT.front + 2.5);
    const tree = checkDeko(w.editSpace, { id: "d", typ: "laubbaum", x: gate.x, z: gate.z, r: 0 });
    expect(tree).not.toBeNull();
    expect(checkDeko(w.editSpace, { id: "e", typ: "laterne", x: 0, z: 0, r: 0 })?.grund).toBe(
      "vor der Zentrale",
    );
  }, 60_000);

  it("eigene Deko blockiert einen künftigen Bauplatz: das neue Haus weicht aus, die Deko bleibt", () => {
    const seed = SEEDS[7];
    const hs = village(4, () => 0, seed);
    const w = generateWorld({ version, seed, houses: hs });
    const doc: WorldDoc = { v: 1, ...pinsFromSettlement(w.settlement) };
    const probe = generateWorld({
      version,
      seed,
      houses: [...hs, { ...hs[1], id: "neu", order: 50 }],
      doc,
    });
    const spot = probe.settlement.houses.neu;
    const deko: DekoItem[] = [
      {
        id: "baum",
        typ: "laubbaum",
        x: Math.round(spot.x * 4) / 4,
        z: Math.round(spot.z * 4) / 4,
        r: 0,
      },
    ];
    const withTree = generateWorld({ version, seed, houses: hs, doc: { ...doc, deko } });
    expect(withTree.deko.map((d) => d.id)).toEqual(["baum"]);
    const after = generateWorld({
      version,
      seed,
      houses: [...hs, { ...hs[1], id: "neu", order: 50 }],
      doc: { ...doc, deko },
    });
    expect(after.deko.map((d) => d.id)).toEqual(["baum"]);
    const moved = after.settlement.houses.neu;
    expect(moved).toBeDefined();
    expect(overlaps(dekoShape(deko[0]), plotShape(moved.x, moved.z, moved.angle), 0)).toBe(false);
    expect(violations(after)).toEqual([]);
  }, 60_000);

  it("Garten: höchstens 12 Plätze, ab 13 Objekten ein Archivschrank", () => {
    const items = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `o${i}`, kind: ARTIFACT_KINDS[i % 7] }));
    expect(plotSlots(items(12))).toMatchObject({ archived: 0 });
    expect(plotSlots(items(12)).slots).toHaveLength(PLOT_CAPACITY);
    expect(plotSlots(items(20)).slots).toHaveLength(PLOT_CAPACITY - 1);
    expect(plotSlots(items(20)).archived).toBe(9);
    for (const s of plotSlots(items(12)).slots) {
      expect(Math.abs(s.x) + 0.56).toBeLessThan(PLOT.hw - 0.15);
      expect(s.z + 0.56).toBeLessThan(PLOT.front - 0.15);
    }
  });

  it("jeder Deko-Typ hat Bezeichnung und Grundfläche", () => {
    for (const t of DEKO_TYPEN) {
      expect(DEKO[t].label.length).toBeGreaterThan(2);
      expect(dekoShape({ typ: t, x: 0, z: 0, r: 90 })).toBeTruthy();
    }
  });
});

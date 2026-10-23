import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { seededRandom } from "../random";
import { ARTIFACT_KINDS } from "../types";
import { DEKO, DEKO_TYPEN } from "./catalog";
import { worldDocSchema, type DekoItem, type WorldDoc } from "./doc";
import { generateWorld, PLOT_CAPACITY, plotSlots } from "./generate";
import {
  corners,
  distPointPolyline,
  overlaps,
  pointShapeDist,
  shapePolylineDist,
  toWorld,
  type Shape,
} from "./geom";
import { inWater, riversOf, waterEdgeDist } from "./map";
import { SEED_OBJEKT, seedObjektShape } from "./seed-objects";
import { checkDeko, dekoShape, snapDeko } from "./rules";
import { makeSeed } from "./seed";
import { frontZone, pinsFromSettlement, plotShape, PLOT } from "./settlement";
import { treeRadius } from "./vegetation";

const SEEDS = Array.from({ length: 220 }, (_, i) => makeSeed(seededRandom(`welt-${i}`)));

type Dist = (i: number, r: () => number) => number;
const DISTS: Record<string, Dist> = {
  gemischt: (i) => (i * 5) % 8,
  zufall: (_, r) => Math.floor(r() * 9),
  einQuartier: () => 7,
  alleNeun: (i) => i % 9,
};

function village(n: number, dist: Dist, seed: string, items = 4): LayoutHouse[] {
  const r = seededRandom(`daten-${seed}-${n}`);
  return [
    { id: "zentrale", kind: "zentrale", fach: "weitere", items: [] },
    ...Array.from({ length: n }, (_, i) => ({
      id: `h${i}`,
      kind: "modul" as const,
      fach: FACH_ORDER[dist(i, r)],
      order: i,
      items: Array.from({ length: Math.floor(r() * (items * 2 + 1)) }, (_, j) => ({
        id: `a${i}-${j}`,
        kind: ARTIFACT_KINDS[Math.floor(r() * ARTIFACT_KINDS.length)],
      })),
    })),
  ];
}

/** Prüft alle Invarianten einer fertigen Welt; liefert die Verletzungen als Text. */
function violations(w: ReturnType<typeof generateWorld>): string[] {
  const out: string[] = [];
  const { map, settlement, layout } = w;
  const houses = Object.values(settlement.houses);
  const plots = houses.map((h) => ({ id: h.id, shape: plotShape(h.x, h.z, h.angle) as Shape }));
  // Grundstücke: keine Überlappung (mit Mindestabstand), in der Karte, nicht im Wasser, nicht auf Plätzen
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      if (overlaps(plots[i].shape, plots[j].shape, 0.5))
        out.push(`Grundstücke ${plots[i].id}/${plots[j].id} überlappen`);
    }
    const s = plots[i].shape;
    if (s.kind === "box" && corners(s).some((p) => Math.hypot(p.x, p.z) > map.rBuild + 1e-6))
      out.push(`${plots[i].id} ausserhalb`);
    if (inWater(map, s, 0)) out.push(`${plots[i].id} im Wasser`);
    if (pointShapeDist(0, 0, s) < map.plaza.a) out.push(`${plots[i].id} auf dem Dorfplatz`);
    for (const n of settlement.nodes) {
      if (pointShapeDist(n.x, n.z, s) < 3.0)
        out.push(`${plots[i].id} auf Quartierplatz ${n.quarterId}`);
    }
    for (const p of layout.paths) {
      if (shapePolylineDist(s, p.points) < p.width / 2 + 0.25)
        out.push(`${plots[i].id} auf Weg ${p.id}`);
    }
  }
  // Zugang: jedes Tor liegt an einem Weg oder am eigenen Quartierplatz
  for (const h of houses) {
    const gate = toWorld(h.x, h.z, h.angle, 0, PLOT.front);
    const nearPath = layout.paths.some(
      (p) => distPointPolyline(gate.x, gate.z, p.points) < p.width / 2 + 0.7,
    );
    const nearNode = settlement.nodes.some(
      (n) => Math.hypot(n.x - gate.x, n.z - gate.z) < 3.0 / Math.cos(Math.PI / 8) + 0.8,
    );
    if (!nearPath && !nearNode) out.push(`${h.id}: Tor ohne Weg`);
  }
  // Wege nicht im Wasser (ausser Brücken über Fluss und Bäche), keine Weg-Kreuzungen
  const still = { ...map, river: null, streams: [] };
  for (const p of layout.paths) {
    for (const q of p.points) {
      const inLake = map.lake && waterEdgeDist(still, q.x, q.z) < p.width / 2;
      const inPond =
        map.pond && Math.hypot(q.x - map.pond.x, q.z - map.pond.z) < map.pond.r + p.width / 2;
      if (inLake || inPond) out.push(`Weg ${p.id} im Wasser`);
    }
    const bridged = (x: number, z: number) =>
      settlement.bridges.some((b) => Math.hypot(b.x - x, b.z - z) < b.span / 2 + 0.5);
    for (const q of p.points) {
      if (
        riversOf(map).some((rv) => distPointPolyline(q.x, q.z, rv.points) < rv.width / 2) &&
        !bridged(q.x, q.z)
      ) {
        out.push(`Weg ${p.id} im Fluss ohne Brücke`);
        break;
      }
    }
  }
  // Seed-Objekte (v2): nicht in Gärten, nicht auf Wegen, Land-Objekte trocken, nicht ineinander
  const objects = map.objects ?? [];
  objects.forEach((o, i) => {
    const s = seedObjektShape(o);
    if (plots.some((p) => overlaps(s, p.shape, 0))) out.push(`Objekt ${o.typ} im Garten`);
    for (const p of layout.paths)
      if (shapePolylineDist(s, p.points) < p.width / 2) out.push(`Objekt ${o.typ} auf Weg ${p.id}`);
    const lage = SEED_OBJEKT[o.typ].lage;
    if ((lage === "land" || lage === "wassernah") && inWater(map, s, 0))
      out.push(`Objekt ${o.typ} im Wasser`);
    for (const q of objects.slice(i + 1))
      if (overlaps(s, seedObjektShape(q), 0)) out.push(`Objekte ${o.typ}/${q.typ} überlappen`);
    for (const t of w.vegetation.trees)
      if (overlaps(s, { kind: "circle", x: t.x, z: t.z, r: treeRadius(t.kind, t.s) * 0.6 }, 0))
        out.push(`Baum im Objekt ${o.typ}`);
  });
  // Pflanzen und Laternen: nicht in Grundstücken, nicht auf Wegen, nicht im Wasser, nicht ineinander
  const trees = w.vegetation.trees;
  for (const t of trees) {
    const r = treeRadius(t.kind, t.s);
    const c: Shape = { kind: "circle", x: t.x, z: t.z, r };
    if (plots.some((p) => overlaps(c, p.shape, 0)))
      out.push(`Baum im Garten bei ${t.x.toFixed(1)},${t.z.toFixed(1)}`);
    if (houses.some((h) => overlaps(c, frontZone(h.x, h.z, h.angle), 0)))
      out.push(`Baum verdeckt Haus bei ${t.x.toFixed(1)},${t.z.toFixed(1)}`);
    if (layout.paths.some((p) => distPointPolyline(t.x, t.z, p.points) < p.width / 2 + r))
      out.push(`Baum auf Weg`);
    if (t.kind !== "obst" && waterEdgeDist(map, t.x, t.z) < r) out.push(`Baum im Wasser`);
  }
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      const a = trees[i];
      const b = trees[j];
      const ra = treeRadius(a.kind, a.s);
      const rb = treeRadius(b.kind, b.s);
      if (Math.hypot(a.x - b.x, a.z - b.z) < ra + rb) out.push(`Bäume überlappen`);
    }
  }
  for (const l of w.lamps) {
    const c: Shape = { kind: "circle", x: l.x, z: l.z, r: 0.25 };
    if (plots.some((p) => overlaps(c, p.shape, 0))) out.push(`Laterne im Garten`);
    if (layout.paths.some((p) => distPointPolyline(l.x, l.z, p.points) < p.width / 2 + 0.1))
      out.push(`Laterne auf Weg`);
    if (waterEdgeDist(map, l.x, l.z) < 0.5) out.push(`Laterne im Wasser`);
  }
  // Eigene Deko: jede gesetzte ist gültig
  for (const d of w.deko) {
    const c = checkDeko(w.editSpace, d);
    if (c) out.push(`Deko ${d.id} ungültig gespeichert: ${c.grund}`);
  }
  return out;
}

describe.each([1, 2] as const)("Welt-Generator v%i: Invarianten über viele Seeds", (version) => {
  it("keine Überlappungen, alles in der Karte, freier Zugang, Pflanzen ohne Konflikte (220 Seeds)", () => {
    const problems: string[] = [];
    SEEDS.forEach((seed, i) => {
      const dists = Object.entries(DISTS);
      const [name, dist] = dists[i % dists.length];
      const n = [0, 1, 3, 7, 12, 20, 30][i % 7];
      const w = generateWorld({ version, seed, houses: village(n, dist, seed) });
      // v2: bis zur freien Platzsuche (Etappe 4) darf bei sehr vollen Quartieren ein Haus fehlen
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
        // v2: Der Fluss liegt im Dorf; bis 40 Häuser fehlen höchstens 2 (Rückfall der freien Platzsuche, Etappe 4)
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

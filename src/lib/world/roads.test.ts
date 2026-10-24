import { describe, expect, it } from "vitest";
import { FACH_ORDER, type FachbereichId } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { seededRandom } from "../random";
import { generateWorld } from "./generate";
import { angDiff, distPointPolyline, overlaps, toWorld } from "./geom";
import { CORRIDOR_HW, PLOT } from "./plot";
import {
  coreRoads,
  KURVEN,
  polarSlots,
  RADIUS,
  roadsForQuarter,
  smartPaths,
  WEGFORMEN,
  type QuarterRoad,
  type Wegform,
} from "./roads";
import { makeSeed } from "./seed";
import { pinsFromSettlement, plotShape } from "./settlement";
import { DISTS, village, violations } from "./test-world";
import type { WorldDoc } from "./doc";
import { vegetationCandidates } from "./vegetation";
import { Space } from "./space";

const SEEDS = Array.from({ length: 40 }, (_, i) => makeSeed(seededRandom(`wegform-${i}`)));
const FRAME = { x: 20, z: -5, h: 0.7 };

/** Dorf mit `n` Häusern in einem Quartier plus `extra` Häusern in anderen Quartieren. */
function oneQuarter(q: FachbereichId, n: number, extra: number, seed: string): LayoutHouse[] {
  const hs = village(extra, DISTS.gemischt, seed);
  for (let i = 0; i < n; i++)
    hs.push({ id: `q${i}`, kind: "modul", fach: q, order: 100 + i, items: [] });
  return hs;
}

/**
 * Welt mit Wegformen wie im Bau-Modus: zuerst die Quartiere an ihrem heutigen Ausgang fixieren (Wegformen gelten
 * nur für fixierte Quartiere), dann die Formen setzen; die Häuser ordnen sich neu.
 */
function withForms(
  seed: string,
  hs: LayoutHouse[],
  roads: Partial<Record<FachbereichId, QuarterRoad>>,
  extra: Partial<WorldDoc> = {},
) {
  const w0 = generateWorld({ version: 3, seed, houses: hs });
  const doc: WorldDoc = {
    v: 1,
    quartiere: pinsFromSettlement(w0.settlement).quartiere,
    quarterRoads: roads,
    ...extra,
  };
  return { doc, world: generateWorld({ version: 3, seed, houses: hs, doc }) };
}

describe("Wegformen: Geometrie", () => {
  it("Bauplätze rund um den Platz überlappen sich nie und lassen die eigene Achse frei", () => {
    const roads: QuarterRoad[] = [
      ...[RADIUS.min, RADIUS.start, RADIUS.max].flatMap((radius) => [
        { form: "ring" as const, radius },
        { form: "halbkreis" as const, radius },
      ]),
      { form: "intelligent" },
    ];
    for (const road of roads) {
      const slots = polarSlots(FRAME, road);
      expect(slots.length, road.form).toBeGreaterThanOrEqual(road.form === "halbkreis" ? 2 : 4);
      for (let i = 0; i < slots.length; i++) {
        const a = plotShape(slots[i].x, slots[i].z, slots[i].angle);
        for (let j = i + 1; j < slots.length; j++) {
          const b = plotShape(slots[j].x, slots[j].z, slots[j].angle);
          expect(overlaps(a, b, 0.5), `${road.form} ${slots[i].key}/${slots[j].key}`).toBe(false);
        }
        // Front zur Mitte
        const front = { x: Math.sin(slots[i].angle), z: Math.cos(slots[i].angle) };
        const toC = Math.atan2(FRAME.x - slots[i].x, FRAME.z - slots[i].z);
        expect(angDiff(Math.atan2(front.x, front.z), toC)).toBeLessThan(1e-6);
        // Achse (Richtung nach aussen) bleibt frei
        const axis = [
          { x: FRAME.x, z: FRAME.z },
          { x: FRAME.x + Math.cos(FRAME.h) * 80, z: FRAME.z + Math.sin(FRAME.h) * 80 },
        ];
        const d = Math.min(
          ...[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([sx, sz]) => {
            const p = toWorld(
              slots[i].x,
              slots[i].z,
              slots[i].angle,
              sx * PLOT.hw,
              sz > 0 ? PLOT.front : -PLOT.back,
            );
            return distPointPolyline(p.x, p.z, axis);
          }),
        );
        expect(d, `${road.form} ${slots[i].key}`).toBeGreaterThan(CORRIDOR_HW);
      }
    }
  });

  it("Ring und Halbkreis: Kernweg auf dem Radius, Häuser ausserhalb mit Abstand", () => {
    for (const radius of [RADIUS.min, RADIUS.max]) {
      for (const form of ["ring", "halbkreis"] as const) {
        const core = coreRoads(FRAME, { form, radius });
        expect(core.length).toBe(form === "ring" ? 2 : 3);
        for (const p of core[0])
          expect(Math.hypot(p.x - FRAME.x, p.z - FRAME.z)).toBeCloseTo(radius, 6);
        const geo = roadsForQuarter(FRAME, { form, radius });
        expect(geo.coreEnd).toBe(radius);
        for (const s of geo.slots) {
          const plot = plotShape(s.x, s.z, s.angle);
          for (const c of core)
            for (const p of c)
              expect(overlaps(plot, { kind: "circle", x: p.x, z: p.z, r: 0.85 }, 0.3)).toBe(false);
        }
      }
    }
  });

  it("Intelligent: jede Variante beginnt am Tor, führt erst gerade hinaus und endet am Platz oder Weg", () => {
    const gate = { x: FRAME.x + 9, z: FRAME.z + 4 };
    const front = { x: -9 / Math.hypot(9, 4), z: -4 / Math.hypot(9, 4) };
    for (let curve = 0; curve < KURVEN.length; curve++) {
      const list = smartPaths(FRAME, gate, front, curve, []);
      expect(list.length).toBeGreaterThan(0);
      for (const v of list) {
        expect(v.pts[0]).toEqual(gate);
        const second = v.pts[2];
        // Zweiter Meter in Richtung der Front
        const dir = Math.atan2(second.z - gate.z, second.x - gate.x);
        expect(angDiff(dir, Math.atan2(front.z, front.x))).toBeLessThan(0.05);
        const end = v.pts[v.pts.length - 1];
        expect(Math.hypot(end.x - FRAME.x, end.z - FRAME.z)).toBeLessThan(3.0);
      }
    }
    const bend = { x: FRAME.x + 6, z: FRAME.z + 6 };
    for (const v of smartPaths(FRAME, gate, front, 1, [], bend))
      expect(v.pts.some((p) => Math.hypot(p.x - bend.x, p.z - bend.z) < 0.01)).toBe(true);
  });
});

describe("Generator v3: Wegformen ergeben keine «komische» Welt", () => {
  const FORMS: QuarterRoad[] = [
    { form: "ring", radius: RADIUS.min },
    { form: "ring", radius: RADIUS.max },
    { form: "halbkreis", radius: RADIUS.start },
    { form: "intelligent", curve: 0 },
    { form: "intelligent", curve: 3 },
  ];

  it("über viele Seeds, Formen und Dorfgrössen: keine Verletzung, Häuser schauen zur Mitte", () => {
    const problems: string[] = [];
    let polarHouses = 0;
    SEEDS.forEach((seed, i) => {
      const road = FORMS[i % FORMS.length];
      const q = FACH_ORDER[i % FACH_ORDER.length];
      const n = [1, 3, 6, 10, 16][i % 5];
      const extra = [0, 4, 10][i % 3];
      const hs = oneQuarter(q, n, extra, seed);
      const roads: Partial<Record<FachbereichId, QuarterRoad>> = { [q]: road };
      // Zweites Quartier mit eigener Form (verschiedene Formen nebeneinander)
      const other = FACH_ORDER[(i + 3) % FACH_ORDER.length];
      roads[other] = FORMS[(i + 2) % FORMS.length];
      const { world: w } = withForms(seed, hs, roads);
      for (const v of violations(w)) problems.push(`${seed} ${road.form} n=${n}: ${v}`);
      expect(w.settlement.unplaced.length, `${seed} ${road.form} n=${n}`).toBeLessThanOrEqual(1);
      const lane = w.settlement.lanes.find((l) => l.quarterId === q && l.primary);
      if (!lane?.road) {
        // Form passt nicht: dann ist sie gemeldet und das Quartier hat die Gasse
        expect(w.settlement.droppedForms).toContain(q);
        return;
      }
      for (const h of Object.values(w.settlement.houses)) {
        if (h.quarterId !== q || h.slot === "frei" || !h.slot.startsWith("k")) continue;
        polarHouses++;
        const toC = Math.atan2(lane.frame!.x - h.x, lane.frame!.z - h.z);
        expect(angDiff(h.angle, toC)).toBeLessThan(1e-6);
      }
    });
    expect(problems.slice(0, 20)).toEqual([]);
    expect(polarHouses).toBeGreaterThan(SEEDS.length);
  }, 180_000);

  it("Fixierung hält: gespeicherte Welt mit Wegform ergibt beim Laden dieselben Lagen", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const q = FACH_ORDER[seed.charCodeAt(0) % FACH_ORDER.length];
      const hs = oneQuarter(q, 7, 5, seed);
      const { doc, world: w } = withForms(seed, hs, {
        [q]: { form: "ring" as Wegform, radius: 6 },
      });
      const pinned = { ...doc, ...pinsFromSettlement(w.settlement) };
      const again = generateWorld({ version: 3, seed, houses: hs, doc: pinned });
      expect(again.settlement.droppedPins).toEqual([]);
      expect(JSON.stringify(again.layout.houses)).toBe(JSON.stringify(w.layout.houses));
    }
  }, 60_000);

  it("alle vier Formen sind wählbar (Schema) und Gasse entspricht der Welt ohne Form", () => {
    expect(WEGFORMEN).toEqual(["intelligent", "ring", "halbkreis", "gasse"]);
    for (const seed of SEEDS.slice(0, 6)) {
      const hs = village(10, DISTS.gemischt, seed);
      const a = generateWorld({ version: 3, seed, houses: hs });
      const roads = Object.fromEntries(FACH_ORDER.map((q) => [q, { form: "gasse" as const }]));
      const b = generateWorld({ version: 3, seed, houses: hs, doc: { v: 1, quarterRoads: roads } });
      expect(JSON.stringify(b.layout)).toBe(JSON.stringify(a.layout));
    }
  }, 60_000);
});

describe("Generator v3: Eckpunkte", () => {
  it("zufällige Eckpunkte ergeben nie Verletzungen; ungültige werden gemeldet und weggelassen", () => {
    const problems: string[] = [];
    let used = 0;
    for (const seed of SEEDS.slice(0, 24)) {
      const r = seededRandom(`eck-${seed}`);
      const q = FACH_ORDER[Math.floor(r() * 9)];
      const form = WEGFORMEN[Math.floor(r() * 4)];
      const hs = oneQuarter(q, 6, 6, seed);
      const { doc, world: base } = withForms(seed, hs, { [q]: { form } });
      const bends: Record<string, { x: number; z: number }> = {};
      for (const [id, pts] of Object.entries(base.settlement.spurs)) {
        // Eckpunkt seitlich der Wegmitte (mal klein, mal gross)
        const m = pts[Math.floor(pts.length / 2)];
        const k = r() < 0.5 ? 0.8 : 3.5;
        bends[id] = { x: m.x + (r() - 0.5) * 2 * k, z: m.z + (r() - 0.5) * 2 * k };
      }
      const w = generateWorld({ version: 3, seed, houses: hs, doc: { ...doc, roadBends: bends } });
      for (const v of violations(w)) problems.push(`${seed} ${form}: ${v}`);
      for (const [id, b] of Object.entries(bends)) {
        if (w.settlement.droppedBends.includes(id) || !w.settlement.spurs[id]) continue;
        // Gültiger Eckpunkt liegt auf dem Weg
        expect(distPointPolyline(b.x, b.z, w.settlement.spurs[id])).toBeLessThan(0.01);
        used++;
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
    expect(used).toBeGreaterThan(10);
  }, 120_000);
});

describe("Generator v3: Bäume bleiben am Seed-Platz", () => {
  it("ein neues Haus verschiebt keinen Baum; was es verdeckt, kommt am selben Ort zurück", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const all = village(14, DISTS.gemischt, seed);
      const small = generateWorld({ version: 3, seed, houses: all.slice(0, 4) });
      const big = generateWorld({ version: 3, seed, houses: all });
      const pos = new Map(small.vegetation.trees.map((t) => [t.i, `${t.x},${t.z}`]));
      for (const t of big.vegetation.trees) {
        if (pos.has(t.i!)) expect(`${t.x},${t.z}`).toBe(pos.get(t.i!));
      }
      // Zurück zum kleinen Dorf: dieselben Bäume wie vorher
      const back = generateWorld({ version: 3, seed, houses: all.slice(0, 4) });
      expect(JSON.stringify(back.vegetation)).toBe(JSON.stringify(small.vegetation));
    }
  }, 60_000);

  it("Nummern hängen nur von der Karte ab (Handy und Desktop gleich)", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const hs = village(6, DISTS.gemischt, seed);
      const desk = generateWorld({ version: 3, seed, houses: hs });
      const phone = generateWorld({ version: 3, seed, houses: hs, lowDetail: true });
      const byI = new Map(desk.vegetation.trees.map((t) => [t.i, t]));
      expect(phone.vegetation.trees.length).toBeLessThan(desk.vegetation.trees.length);
      for (const t of phone.vegetation.trees) {
        const d = byI.get(t.i);
        if (d) expect([t.x, t.z]).toEqual([d.x, d.z]);
      }
      const c1 = vegetationCandidates(new Space(desk.map), seed);
      const c2 = vegetationCandidates(new Space(phone.map), seed);
      expect(c1.trees.length).toBe(c2.trees.length);
    }
  }, 60_000);

  it("versetzte Bäume: gültige stehen am neuen Ort, ungültige werden gemeldet", () => {
    let valid = 0;
    for (const seed of SEEDS.slice(0, 8)) {
      const hs = village(5, DISTS.gemischt, seed);
      const w = generateWorld({ version: 3, seed, houses: hs });
      // Mitten in ein Haus: ungültig, der Baum bleibt an seinem Seed-Platz
      const house = Object.values(w.settlement.houses)[0];
      const other = w.vegetation.trees.find((x) => x.kind !== "obst")!;
      const bad = generateWorld({
        version: 3,
        seed,
        houses: hs,
        doc: { v: 1, treeMoves: { [String(other.i)]: { x: house.x, z: house.z } } },
      });
      expect(bad.invalidTreeMoves).toEqual([other.i]);
      const back = bad.vegetation.trees.find((x) => x.i === other.i)!;
      expect([back.x, back.z]).toEqual([other.x, other.z]);
      expect(violations(bad)).toEqual([]);
      // Wenig verschoben in der Wiese: gültig, steht genau dort
      for (const t of w.vegetation.trees.filter((x) => Math.hypot(x.x, x.z) > 45).slice(0, 6)) {
        const to = { x: t.x + 0.5, z: t.z - 0.25 };
        const m = generateWorld({
          version: 3,
          seed,
          houses: hs,
          doc: { v: 1, treeMoves: { [String(t.i)]: to } },
        });
        if (m.invalidTreeMoves.length) continue;
        const moved = m.vegetation.trees.find((x) => x.i === t.i)!;
        expect([moved.x, moved.z]).toEqual([to.x, to.z]);
        expect(violations(m)).toEqual([]);
        valid++;
        break;
      }
    }
    expect(valid).toBeGreaterThan(4);
  }, 60_000);
});

describe("Wegformen: Quartierplatz", () => {
  it("Ring: Randstein zur Aussenseite bleibt zu, solange dort keine Gasse beginnt", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const hs = oneQuarter("grundlagen", 3, 2, seed);
      const { world } = withForms(seed, hs, { grundlagen: { form: "ring", radius: 9 } });
      const node = world.settlement.nodes.find((n) => n.quarterId === "grundlagen")!;
      const poly = world.layout.polys.find((p) => p.quarterId === "grundlagen" && !p.main)!;
      const out = node.entry + Math.PI;
      expect(poly.used.some((a) => angDiff(a, out) < 0.05), seed).toBe(false);
    }
  }, 60_000);
});

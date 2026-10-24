/**
 * Gemeinsame Hilfen der Welt-Tests: Testdörfer und die Prüfung aller Invarianten einer fertigen Welt
 * («nichts Komisches»). Nur von Tests verwendet.
 */
import { FACH_ORDER } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { seededRandom } from "../random";
import { ARTIFACT_KINDS } from "../types";
import type { generateWorld } from "./generate";
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
import { checkDeko } from "./rules";
import { SEED_OBJEKT, seedObjektShape } from "./seed-objects";
import { frontZone, plotShape, PLOT, SPUR_WIDTH } from "./settlement";
import { treeRadius } from "./vegetation";

export type Dist = (i: number, r: () => number) => number;
export const DISTS: Record<string, Dist> = {
  gemischt: (i) => (i * 5) % 8,
  zufall: (_, r) => Math.floor(r() * 9),
  einQuartier: () => 7,
  alleNeun: (i) => i % 9,
};

export function village(n: number, dist: Dist, seed: string, items = 4): LayoutHouse[] {
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
export function violations(w: ReturnType<typeof generateWorld>): string[] {
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
      // Der eigene Stichweg beginnt am Tor (im Grundstück); jeder andere Weg bleibt draussen
      if (p.id === `stich-${plots[i].id}`) continue;
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
  // Stichwege (v2): je Haus höchstens einer, konstante Breite, vom Tor bis an Gasse oder Quartierplatz,
  // nicht durch andere Stichwege
  const spurs = layout.paths.filter((p) => p.kind === "stich");
  for (const p of spurs) {
    const id = p.id.slice("stich-".length);
    const h = settlement.houses[id];
    if (!h) {
      out.push(`Stichweg ${p.id} ohne Haus`);
      continue;
    }
    if (p.width !== SPUR_WIDTH) out.push(`Stichweg ${p.id} mit Breite ${p.width}`);
    const gate = toWorld(h.x, h.z, h.angle, 0, PLOT.front);
    if (Math.hypot(p.points[0].x - gate.x, p.points[0].z - gate.z) > 0.2)
      out.push(`Stichweg ${p.id} beginnt nicht am Tor`);
    const end = p.points[p.points.length - 1];
    const onSpine = layout.paths.some(
      (q) => q.kind !== "stich" && distPointPolyline(end.x, end.z, q.points) < q.width / 2 + 0.05,
    );
    const onNode = settlement.nodes.some((n) => Math.hypot(n.x - end.x, n.z - end.z) < 3.05);
    // v3 «Intelligent»: ein Weg darf in einen anderen Stichweg münden
    const into = settlement.v3
      ? spurs.find((q) => q !== p && distPointPolyline(end.x, end.z, q.points) < q.width / 2 + 0.05)
      : undefined;
    if (!onSpine && !onNode && !into) out.push(`Stichweg ${p.id} endet nicht am Rückgrat`);
    for (const q of spurs) {
      if (q === p) continue;
      // Die letzten Meter vor einer Mündung (in die eine oder andere Richtung) dürfen sich nähern
      const qEnd = q.points[q.points.length - 1];
      const near = (pt: { x: number; z: number }, e: { x: number; z: number }, m: number) =>
        Math.hypot(pt.x - e.x, pt.z - e.z) < m;
      const inner = p.points
        .slice(0, -1)
        .filter((pt) => !(into === q && near(pt, end, 3.2)) && !near(pt, qEnd, 3.2));
      const other = q.points.slice(0, -1);
      if (other.length && inner.some((pt) => distPointPolyline(pt.x, pt.z, other) < SPUR_WIDTH))
        out.push(`Stichwege ${p.id}/${q.id} berühren sich`);
    }
  }
  if (new Set(spurs.map((p) => p.id)).size !== spurs.length) out.push("Haus mit zwei Stichwegen");
  // Eigene Deko: jede gesetzte ist gültig
  for (const d of w.deko) {
    const c = checkDeko(w.editSpace, d);
    if (c) out.push(`Deko ${d.id} ungültig gespeichert: ${c.grund}`);
  }
  return out;
}

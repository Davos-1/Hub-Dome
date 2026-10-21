import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { HouseLayout } from "@/lib/layout";
import type { ArtifactKind } from "@/lib/types";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import { seededRandom } from "./colors";
import { box, cyl, mergeParts, type Part } from "./geo";
import { darken } from "./models/common";
import { bedParts, objectParts } from "./object-models";
import { benchParts } from "./plaza-geometry";

/** Halbe Breite der Toröffnung in der Hecke. */
export const GATE = 0.95;
const POST_H = 0.72;
const POST_COLOR = "#b8b2a7";

export type HedgePiece = {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
  color: string;
};

/** Ort eines Schilds (lokal zum Haus): Holzschild am Tor oder Baustellenschild. */
export type BoardPlacement = {
  kind: "holz" | "baustelle";
  houseId: string;
  pos: [number, number, number];
  size: [number, number];
};

function treeParts(x: number, z: number): Part[] {
  return [
    { geo: cyl(0.12, 0.17, 1.5, 8), color: "#6b4423", pos: [x, 0.75, z] },
    {
      geo: new THREE.IcosahedronGeometry(0.95, 1),
      color: "#5c9b4f",
      pos: [x, 2.0, z],
      rot: [0.3, 0.5, 0],
      scale: [1, 0.9, 1],
    },
    {
      geo: new THREE.IcosahedronGeometry(0.6, 1),
      color: "#6aa95a",
      pos: [x + 0.35, 2.55, z - 0.2],
    },
  ];
}

/** Lokale Bauteile des Grundstücks eines Hauses (Rasen, Pfosten, Trittplatten, Beete, Bank, Baum, Schildpfosten). */
export function gardenOf(h: HouseInfo, l: HouseLayout) {
  const pl = l.plot!;
  const rnd = seededRandom(`${h.id}g`);
  const parts: Part[] = [];
  const glow: Part[] = [];
  const hedges: HedgePiece[] = [];
  const boards: BoardPlacement[] = [];
  const fp = l.footprint;
  const lantern = h.newCount > 0;

  // Rasen
  const lawn = new THREE.PlaneGeometry(pl.hw * 2, pl.front + pl.back);
  lawn.rotateX(-Math.PI / 2);
  const lawnPart: Part = { geo: lawn, color: "#9fcf83", pos: [0, 0.006, (pl.front - pl.back) / 2] };

  // Formhecke: schmal, kniehoch, Segmente mit leicht wechselnder Höhe und hellerer Schnittkante
  const edges: [number, number, number, number][] = [
    [-pl.hw, -pl.back, pl.hw, -pl.back],
    [-pl.hw, -pl.back, -pl.hw, pl.front],
    [pl.hw, -pl.back, pl.hw, pl.front],
    [-pl.hw, pl.front, -GATE, pl.front],
    [GATE, pl.front, pl.hw, pl.front],
  ];
  for (const [x0, z0, x1, z1] of edges) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const LL = L + 0.3;
    const n = Math.max(1, Math.round(LL / 1.1));
    const seg = LL / n;
    const ux = (x1 - x0) / L;
    const uz = (z1 - z0) / L;
    for (let i = 0; i < n; i++) {
      const o = -0.15 + seg * (i + 0.5);
      const cx = x0 + ux * o;
      const cz = z0 + uz * o;
      const hh = 0.5 + rnd() * 0.06;
      hedges.push({
        pos: [cx, hh / 2, cz],
        rot: [0, ang, 0],
        scale: [0.3, hh, seg + 0.01],
        color: i % 2 ? "#3f7d42" : "#43834a",
      });
      hedges.push({
        pos: [cx, hh + 0.012, cz],
        rot: [0, ang, 0],
        scale: [0.24, 0.03, seg - 0.02],
        color: "#5f9d57",
      });
    }
  }

  // Steinpfosten am Tor, bei neuen Objekten mit Laternen
  for (const s of [-1, 1]) {
    const px = s * (GATE + 0.05);
    parts.push({
      geo: box(0.26, POST_H, 0.26),
      color: POST_COLOR,
      pos: [px, POST_H / 2, pl.front],
    });
    parts.push({
      geo: box(0.32, 0.06, 0.32),
      color: darken(POST_COLOR, 0.85),
      pos: [px, POST_H + 0.03, pl.front],
    });
    if (lantern) {
      parts.push({
        geo: box(0.18, 0.04, 0.18),
        color: "#3f3f46",
        pos: [px, POST_H + 0.08, pl.front],
      });
      parts.push({
        geo: box(0.18, 0.04, 0.18),
        color: "#3f3f46",
        pos: [px, POST_H + 0.34, pl.front],
      });
      glow.push({
        geo: box(0.14, 0.22, 0.14),
        color: "#ffd479",
        pos: [px, POST_H + 0.21, pl.front],
      });
    }
  }

  // Gartenweg: Trittplatten vom Tor zur Tür
  const z0 = fp * 1.05 + 0.55;
  for (let z = pl.front - 0.35; z > z0 - 0.01; z -= 0.78) {
    parts.push({
      geo: box(1.05, 0.05, 0.56),
      color: rnd() > 0.5 ? "#d8d1c3" : "#cdc6b7",
      pos: [(rnd() - 0.5) * 0.08, 0.03, z],
      rot: [0, (rnd() - 0.5) * 0.12, 0],
    });
  }

  parts.push(...bedParts(pl.slots));

  // Garten wächst: ab Stufe 2 eine Bank, ab Stufe 3 ein Baum hinter dem Haus
  const side = -(l.tier === 3 ? pl.hw - 0.95 : (fp * 1.05 + pl.hw) / 2);
  if (l.tier >= 2) parts.push(...benchParts(side, l.tier === 3 ? 0.4 : -fp * 0.3, Math.PI / 2));
  if (l.tier === 3) parts.push(...treeParts(side, -(pl.back - 1.0)));

  // Schilder: Holzschild am Tor (Haus mit Objekten) oder Baustellenschild (leeres Haus)
  if (h.items.length > 0) {
    const sx = -(GATE + 0.75);
    const sz = pl.front + 0.4;
    for (const s of [-0.62, 0.62]) {
      parts.push({ geo: box(0.1, 1.55, 0.1), color: "#5e3c22", pos: [sx + s, 0.78, sz] });
    }
    boards.push({ kind: "holz", houseId: h.id, pos: [sx, 1.12, sz + 0.06], size: [1.6, 0.8] });
  } else {
    const sx = 1.7;
    const sz = pl.front - 1.2;
    for (const s of [-0.62, 0.62]) {
      parts.push({ geo: box(0.08, 1.4, 0.08), color: "#3f3f46", pos: [sx + s, 0.7, sz] });
    }
    boards.push({
      kind: "baustelle",
      houseId: h.id,
      pos: [sx, 1.05, sz + 0.05],
      size: [1.5, 0.94],
    });
  }
  return { lawn: lawnPart, parts, glow, hedges, boards };
}

export function placed(geo: THREE.BufferGeometry, l: Pick<HouseLayout, "x" | "z" | "angle">) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(l.x, 0, l.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, l.angle, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  geo.applyMatrix4(m);
  return geo;
}

export type VillageGardens = {
  /** Rasenflächen (auch in der Kartenansicht sichtbar). */
  lawns: THREE.BufferGeometry | null;
  body: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
  /** Matrizen und Farben der Heckenteile (Welt), für einen InstancedMesh. */
  hedges: { matrix: THREE.Matrix4; color: string }[];
  boards: (BoardPlacement & { world: THREE.Matrix4 })[];
  /** Objekte pro Kategorie, in Weltkoordinaten zusammengeführt. */
  objects: Partial<Record<ArtifactKind, THREE.BufferGeometry>>;
};

/** Baut Gärten und Objekte des ganzen Dorfs als wenige zusammengeführte Geometrien (Weltkoordinaten). */
export function buildVillageGardens(model: VillageModel): VillageGardens {
  const lawns: THREE.BufferGeometry[] = [];
  const bodies: THREE.BufferGeometry[] = [];
  const glows: THREE.BufferGeometry[] = [];
  const hedges: VillageGardens["hedges"] = [];
  const boards: VillageGardens["boards"] = [];
  const objectGeos: Partial<Record<ArtifactKind, THREE.BufferGeometry[]>> = {};

  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  for (const h of model.houses) {
    const l = model.layout.houses[h.id];
    if (!l || !l.plot) continue;
    const g = gardenOf(h, l);
    const house = new THREE.Matrix4().compose(
      v.set(l.x, 0, l.z),
      q.setFromEuler(e.set(0, l.angle, 0)),
      s.set(1, 1, 1),
    );
    const worldHouse = house.clone();

    const lawn = mergeParts([g.lawn]);
    g.lawn.geo.dispose();
    lawns.push(placed(lawn, l));
    const body = mergeParts(g.parts);
    g.parts.forEach((p) => p.geo.dispose());
    bodies.push(placed(body, l));
    if (g.glow.length) {
      const glow = mergeParts(g.glow);
      g.glow.forEach((p) => p.geo.dispose());
      glows.push(placed(glow, l));
    }
    for (const piece of g.hedges) {
      tmp.compose(v.set(...piece.pos), q.setFromEuler(e.set(...piece.rot)), s.set(...piece.scale));
      hedges.push({
        matrix: new THREE.Matrix4().multiplyMatrices(worldHouse, tmp),
        color: piece.color,
      });
    }
    for (const b of g.boards) boards.push({ ...b, world: worldHouse });

    // Objekte nach Kategorie
    const perKind: Partial<Record<ArtifactKind, Part[]>> = {};
    const info = new Map(h.items.map((o) => [o.id, o]));
    for (const slot of l.plot.slots) {
      const o = info.get(slot.id);
      (perKind[slot.kind] ??= []).push(
        ...objectParts(slot.kind, slot.x, slot.z, o?.isNew ?? false),
      );
    }
    for (const [kind, parts] of Object.entries(perKind) as [ArtifactKind, Part[]][]) {
      const geo = mergeParts(parts);
      parts.forEach((p) => p.geo.dispose());
      (objectGeos[kind] ??= []).push(placed(geo, l));
    }
  }

  const merge = (list: THREE.BufferGeometry[]) => {
    if (list.length === 0) return null;
    const m = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    m.computeBoundingSphere();
    return m;
  };
  const objects: VillageGardens["objects"] = {};
  for (const [kind, list] of Object.entries(objectGeos) as [
    ArtifactKind,
    THREE.BufferGeometry[],
  ][]) {
    const m = merge(list);
    if (m) objects[kind] = m;
  }
  return { lawns: merge(lawns), body: merge(bodies), glow: merge(glows), hedges, boards, objects };
}

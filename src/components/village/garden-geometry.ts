import * as THREE from "three";
import type { HouseLayout } from "@/lib/layout";
import { seededRandom } from "@/lib/random";
import type { ArtifactKind } from "@/lib/types";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import {
  box,
  composeInto,
  cyl,
  mergeAll,
  mergeParts,
  yawMatrix,
  type Part,
  type Vec3,
} from "./geo";
import { darken } from "./models/common";
import { bedParts, objectParts } from "./object-models";
import { benchParts } from "./plaza-geometry";

/** Halbe Breite der Toröffnung in der Hecke. */
const GATE = 0.95;
const POST_H = 0.72;
const POST_COLOR = "#b8b2a7";

type HedgePiece = {
  pos: Vec3;
  rot: Vec3;
  scale: Vec3;
  color: string;
};

/** Ort eines Schilds (lokal zum Haus): Holzschild am Tor oder Baustellenschild. */
type BoardPlacement = {
  kind: "holz" | "baustelle";
  houseId: string;
  pos: Vec3;
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

type Plot = NonNullable<HouseLayout["plot"]>;
type Random = () => number;

/** Rasenfläche des Grundstücks. */
function lawnPart(pl: Plot): Part {
  const lawn = new THREE.PlaneGeometry(pl.hw * 2, pl.front + pl.back);
  lawn.rotateX(-Math.PI / 2);
  return { geo: lawn, color: "#9fcf83", pos: [0, 0.006, (pl.front - pl.back) / 2] };
}

/** Formhecke: schmal, kniehoch, Segmente mit leicht wechselnder Höhe und hellerer Schnittkante. */
function hedgePieces(pl: Plot, rnd: Random): HedgePiece[] {
  const hedges: HedgePiece[] = [];
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
  return hedges;
}

/** Steinpfosten am Tor, bei neuen Objekten mit Laternen (Leuchtteile in `glow`). */
function gatePosts(pl: Plot, lantern: boolean): { parts: Part[]; glow: Part[] } {
  const parts: Part[] = [];
  const glow: Part[] = [];
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
      for (const y of [POST_H + 0.08, POST_H + 0.34]) {
        parts.push({ geo: box(0.18, 0.04, 0.18), color: "#3f3f46", pos: [px, y, pl.front] });
      }
      glow.push({
        geo: box(0.14, 0.22, 0.14),
        color: "#ffd479",
        pos: [px, POST_H + 0.21, pl.front],
      });
    }
  }
  return { parts, glow };
}

/** Gartenweg: Trittplatten vom Tor zur Tür. */
function stepStones(fp: number, pl: Plot, rnd: Random): Part[] {
  const parts: Part[] = [];
  const z0 = fp * 1.05 + 0.55;
  for (let z = pl.front - 0.35; z > z0 - 0.01; z -= 0.78) {
    parts.push({
      geo: box(1.05, 0.05, 0.56),
      color: rnd() > 0.5 ? "#d8d1c3" : "#cdc6b7",
      pos: [(rnd() - 0.5) * 0.08, 0.03, z],
      rot: [0, (rnd() - 0.5) * 0.12, 0],
    });
  }
  return parts;
}

/** Garten wächst: ab Stufe 2 eine Bank, ab Stufe 3 ein Baum hinter dem Haus. */
function gardenGrowth(l: HouseLayout, pl: Plot): Part[] {
  const fp = l.footprint;
  const side = -(l.tier === 3 ? pl.hw - 0.95 : (fp * 1.05 + pl.hw) / 2);
  const parts: Part[] = [];
  if (l.tier >= 2) parts.push(...benchParts(side, l.tier === 3 ? 0.4 : -fp * 0.3, Math.PI / 2));
  if (l.tier === 3) parts.push(...treeParts(side, -(pl.back - 1.0)));
  return parts;
}

/** Schilder: Holzschild am Tor (Haus mit Objekten) oder Baustellenschild (leeres Haus), samt Pfosten. */
function signBoard(h: HouseInfo, pl: Plot): { posts: Part[]; board: BoardPlacement } {
  const posts: Part[] = [];
  if (h.items.length > 0) {
    const sx = -(GATE + 0.75);
    const sz = pl.front + 0.4;
    for (const s of [-0.62, 0.62]) {
      posts.push({ geo: box(0.1, 1.55, 0.1), color: "#5e3c22", pos: [sx + s, 0.78, sz] });
    }
    const board: BoardPlacement = {
      kind: "holz",
      houseId: h.id,
      pos: [sx, 1.12, sz + 0.06],
      size: [1.6, 0.8],
    };
    return { posts, board };
  }
  const sx = 1.7;
  const sz = pl.front - 1.2;
  for (const s of [-0.62, 0.62]) {
    posts.push({ geo: box(0.08, 1.4, 0.08), color: "#3f3f46", pos: [sx + s, 0.7, sz] });
  }
  const board: BoardPlacement = {
    kind: "baustelle",
    houseId: h.id,
    pos: [sx, 1.05, sz + 0.05],
    size: [1.5, 0.94],
  };
  return { posts, board };
}

/**
 * Lokale Bauteile des Grundstücks eines Hauses (Rasen, Pfosten, Trittplatten, Beete, Bank, Baum, Schildpfosten).
 * Die Zufallszahlen werden in fester Reihenfolge gezogen (erst Hecke, dann Trittplatten): die Gestalt bleibt stabil.
 */
function gardenOf(h: HouseInfo, l: HouseLayout) {
  const pl = l.plot!;
  const rnd = seededRandom(`${h.id}g`);
  const hedges = hedgePieces(pl, rnd);
  const gate = gatePosts(pl, h.newCount > 0);
  const sign = signBoard(h, pl);
  const parts: Part[] = [
    ...gate.parts,
    ...stepStones(l.footprint, pl, rnd),
    ...bedParts(pl.slots),
    ...gardenGrowth(l, pl),
    ...sign.posts,
  ];
  return { lawn: lawnPart(pl), parts, glow: gate.glow, hedges, boards: [sign.board] };
}

/** Platziert eine Geometrie im Dorf wie das Haus `l` (Drehung um Y, Verschiebung auf den Standort). */
export function placed(geo: THREE.BufferGeometry, l: Pick<HouseLayout, "x" | "z" | "angle">) {
  return geo.applyMatrix4(yawMatrix(l.x, l.z, l.angle));
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
  /** Gibt alle Geometrien frei. */
  dispose: () => void;
};

/** Baut Gärten und Objekte des ganzen Dorfs als wenige zusammengeführte Geometrien (Weltkoordinaten). */
export function buildVillageGardens(model: VillageModel): VillageGardens {
  const lawns: THREE.BufferGeometry[] = [];
  const bodies: THREE.BufferGeometry[] = [];
  const glows: THREE.BufferGeometry[] = [];
  const hedges: VillageGardens["hedges"] = [];
  const boards: VillageGardens["boards"] = [];
  const objectGeos: Partial<Record<ArtifactKind, THREE.BufferGeometry[]>> = {};
  const local = new THREE.Matrix4();

  for (const h of model.houses) {
    const l = model.layout.houses[h.id];
    if (!l || !l.plot) continue;
    const g = gardenOf(h, l);
    const world = yawMatrix(l.x, l.z, l.angle);
    const place = (parts: Part[]) => mergeParts(parts).applyMatrix4(world);

    lawns.push(place([g.lawn]));
    bodies.push(place(g.parts));
    if (g.glow.length) glows.push(place(g.glow));
    for (const piece of g.hedges) {
      composeInto(local, piece.pos, piece.rot, piece.scale);
      hedges.push({
        matrix: new THREE.Matrix4().multiplyMatrices(world, local),
        color: piece.color,
      });
    }
    for (const b of g.boards) boards.push({ ...b, world });

    // Objekte nach Kategorie
    const perKind: Partial<Record<ArtifactKind, Part[]>> = {};
    const info = new Map(h.items.map((o) => [o.id, o]));
    for (const slot of l.plot.slots) {
      const o = info.get(slot.id);
      (perKind[slot.kind] ??= []).push(
        ...objectParts(slot.kind, slot.x, slot.z, o?.isNew ?? false, o?.isCopy ?? false),
      );
    }
    for (const [kind, parts] of Object.entries(perKind) as [ArtifactKind, Part[]][]) {
      (objectGeos[kind] ??= []).push(place(parts));
    }
  }

  const objects: VillageGardens["objects"] = {};
  for (const [kind, list] of Object.entries(objectGeos) as [
    ArtifactKind,
    THREE.BufferGeometry[],
  ][]) {
    const merged = mergeAll(list);
    if (merged) objects[kind] = merged;
  }
  const lawnGeo = mergeAll(lawns);
  const body = mergeAll(bodies);
  const glow = mergeAll(glows);
  return {
    lawns: lawnGeo,
    body,
    glow,
    hedges,
    boards,
    objects,
    dispose: () => {
      lawnGeo?.dispose();
      body?.dispose();
      glow?.dispose();
      Object.values(objects).forEach((g) => g.dispose());
    },
  };
}

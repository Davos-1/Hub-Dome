/**
 * Automatisches Grün und Licht: Laternen an Plätzen und Wegen, Bäume, Büsche, Steine und Blumeninseln.
 * Alles kommt **nach** Häusern und eigener Deko und weicht ihnen aus. Untereinander halten Elemente einen
 * Mindestabstand je Art (Poisson-Verteilung), damit nichts ineinander steckt.
 */

import { DIRECTIONS } from "./axes";
import { circle, polar, polylineLength, TAU, type Pt } from "./geom";
import { heightAt, waterEdgeDist } from "./map";
import { range, rng } from "./seed";
import type { ClaimKind, Space } from "./space";

export type TreeKind = "laub" | "nadel" | "obst" | "bluete";
export type Tree = {
  x: number;
  z: number;
  y: number;
  s: number;
  rot: number;
  kind: TreeKind;
  color: string;
};
export type Small = { x: number; z: number; y: number; s: number; rot: number; color: string };
export type Vegetation = { trees: Tree[]; bushes: Small[]; rocks: Small[]; flowers: Small[] };
export type LampSpot = { x: number; z: number };

/** Kronenradius eines Baums (für Abstände). */
export const treeRadius = (kind: TreeKind, s: number) => (kind === "nadel" ? 0.95 : 1.15) * s;

/** Raster für schnelle Abstandsprüfungen unter Pflanzen. */
class Grid {
  private cells = new Map<string, { x: number; z: number; r: number }[]>();
  constructor(private size = 4) {}
  private key(i: number, j: number) {
    return `${i},${j}`;
  }
  add(x: number, z: number, r: number) {
    const k = this.key(Math.floor(x / this.size), Math.floor(z / this.size));
    const list = this.cells.get(k) ?? [];
    list.push({ x, z, r });
    this.cells.set(k, list);
  }
  free(x: number, z: number, r: number, gap: number) {
    const i0 = Math.floor(x / this.size);
    const j0 = Math.floor(z / this.size);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        for (const o of this.cells.get(this.key(i, j)) ?? []) {
          if (Math.hypot(o.x - x, o.z - z) < o.r + r + gap) return false;
        }
      }
    }
    return true;
  }
}

/** Was Pflanzen meiden (alles Gebaute); hohe Bäume zusätzlich die Bereiche vor Hausfronten. */
const LOW: ReadonlySet<ClaimKind> = new Set([
  "platz",
  "knoten",
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
]);

const LAMP_BLOCKERS: ReadonlySet<ClaimKind> = new Set([
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
]);

function blocked(
  space: Space,
  x: number,
  z: number,
  r: number,
  pathGap: number,
  tall: boolean,
): boolean {
  const s = circle(x, z, r);
  if (Math.hypot(x, z) + r > space.map.rFlat + 60) return true;
  if (waterEdgeDist(space.map, x, z) < r + 1.0) return true;
  return !!space.conflict(s, {
    margin: 0.4,
    pathClearance: pathGap,
    kinds: tall ? undefined : LOW,
    skipWater: true,
    skipBounds: true,
    asKind: "deko",
  });
}

/**
 * Laternen: an den Ausgängen des Dorfplatzes je zwei, am Quartierplatz zwei, entlang der Wege alle 7–12 m
 * (Seite und Lücken per Seed). Laternen werden als Deko ins Register eingetragen (Pflanzen meiden sie).
 */
export function placeLamps(
  space: Space,
  seed: string,
  paths: { points: Pt[]; width: number; id: string }[],
  plaza: { a: number; n: number; rot: number },
  exits: number[],
  nodes: { x: number; z: number; entry: number }[],
): LampSpot[] {
  const r = rng(seed, "laternen");
  const lamps: LampSpot[] = [];
  const grid = new Grid(4);
  const tryAdd = (x: number, z: number) => {
    if (!grid.free(x, z, 0.3, 3.2)) return;
    const s = circle(x, z, 0.25);
    if (
      space.conflict(s, { margin: 0.25, pathClearance: 0.15, kinds: LAMP_BLOCKERS, asKind: "deko" })
    )
      return;
    grid.add(x, z, 0.3);
    lamps.push({ x, z });
    space.addClaim({
      id: `laterne-${lamps.length}`,
      kind: "deko",
      shape: s,
      label: "zu nah an einer Laterne",
    });
  };
  // Dorfplatz: an jeder belegten Ausfahrt zwei, sonst je eine Laterne zwischen den Ausgängen
  for (const ang of exits) {
    const c = polar(ang, plaza.a - 0.75);
    const t = { x: -Math.sin(ang), z: Math.cos(ang) };
    for (const sg of [-1, 1]) tryAdd(c.x + t.x * sg * 2.35, c.z + t.z * sg * 2.35);
  }
  // Quartierplätze: zwei Laternen beidseits des Eingangs
  for (const n of nodes) {
    const c = polar(n.entry, 3.0 - 0.45);
    const t = { x: -Math.sin(n.entry), z: Math.cos(n.entry) };
    for (const sg of [-1, 1]) tryAdd(n.x + c.x + t.x * sg * 2.1, n.z + c.z + t.z * sg * 2.1);
  }
  for (const p of paths) {
    const total = polylineLength(p.points);
    for (let sd = 3 + r() * 4; sd < total - 2; sd += 7 + r() * 5) {
      if (r() < 0.15) continue;
      const a = along(p.points, sd);
      const sg = r() < 0.5 ? 1 : -1;
      const w = p.width / 2 + 0.55;
      tryAdd(a.x + a.nx * w * sg, a.z + a.nz * w * sg);
    }
  }
  return lamps;
}

/** Punkt und linke Normale bei Bogenlänge s. */
function along(pts: Pt[], s: number) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dz = pts[i + 1].z - pts[i].z;
    const l = Math.hypot(dx, dz);
    if (acc + l >= s) {
      const t = (s - acc) / l;
      return { x: pts[i].x + dx * t, z: pts[i].z + dz * t, nx: -dz / l, nz: dx / l };
    }
    acc += l;
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: b.x, z: b.z, nx: -(b.z - a.z) / l, nz: (b.x - a.x) / l };
}

/**
 * Pflanzen nach Stimmung und Siedlung: Bäume rund um den Dorfplatz, Wäldchen in den Lücken, Waldrand
 * um die Siedlung (weicht zurück, wenn sie wächst), Wald auf den Hügeln, Büsche, Steine und Blumeninseln.
 * `density` < 1 für Mobile.
 */
export function placeVegetation(
  space: Space,
  seed: string,
  settlementR: number,
  plaza: { a: number; n: number; rot: number },
  exits: number[],
  density: number,
  forest: boolean,
): Vegetation {
  const map = space.map;
  const pal = map.palette;
  const r = rng(seed, "natur");
  const grid = new Grid(4);
  const out: Vegetation = { trees: [], bushes: [], rocks: [], flowers: [] };
  const color = (list: string[]) => list[Math.floor(r() * list.length) % list.length];
  const treeKind = (): TreeKind => {
    if (r() < pal.conifer) return "nadel";
    if (map.stimmung === "fruehling" && r() < 0.35) return "bluete";
    return "laub";
  };
  const treeColor = (k: TreeKind) =>
    k === "nadel"
      ? color(pal.needles)
      : k === "bluete" || k === "obst"
        ? color(pal.blossom)
        : color(pal.leaves);
  const addTree = (x: number, z: number, s: number, kind: TreeKind, pathGap = 1.6) => {
    const rad = treeRadius(kind, s);
    if (!grid.free(x, z, rad, 0.15)) return false;
    if (blocked(space, x, z, rad, pathGap, true)) return false;
    grid.add(x, z, rad);
    out.trees.push({
      x,
      z,
      y: heightAt(map, x, z),
      s,
      rot: r() * TAU,
      kind,
      color: treeColor(kind),
    });
    return true;
  };

  // 1. Laubbäume rund um den Dorfplatz (zwischen den Ausgängen)
  for (let k = 0; k < DIRECTIONS; k++) {
    const mid = plaza.rot + ((k + 0.5) * TAU) / DIRECTIONS;
    const near = exits.some(
      (e) => Math.abs(Math.atan2(Math.sin(e - mid), Math.cos(e - mid))) < 0.2,
    );
    if (near) continue;
    const p = polar(mid, plaza.a / Math.cos(Math.PI / plaza.n) + 2.6);
    addTree(p.x, p.z, 1.0 + r() * 0.2, map.stimmung === "alpin" ? "nadel" : "laub");
  }

  // 2. Obstgarten (Merkmal der Karte): Reihen von Obstbäumen
  if (map.orchard) {
    const o = map.orchard;
    const c = Math.cos(o.angle);
    const sn = Math.sin(o.angle);
    for (let i = -1; i <= 1; i++) {
      for (let j = -2; j <= 2; j++) {
        const lx = j * (o.w / 5);
        const lz = i * (o.d / 3);
        const x = o.x + lx * c + lz * sn;
        const z = o.z - lx * sn + lz * c;
        // Der Obstgarten ist selbst ein Merkmal: nur gegen andere Bäume und Wasser prüfen
        const sc = 0.85 + r() * 0.15;
        const rad = treeRadius("obst", sc);
        if (!grid.free(x, z, rad, 0.15) || waterEdgeDist(map, x, z) < rad + 1) continue;
        grid.add(x, z, rad);
        out.trees.push({
          x,
          z,
          y: 0,
          s: sc,
          rot: r() * TAU,
          kind: "obst",
          color: color(pal.blossom),
        });
      }
    }
  }

  // 3. Wäldchen in der Wiese und Waldrand um die Siedlung
  const edge = Math.max(settlementR + 9, 34);
  const groves = 3 + Math.floor(r() * 3);
  for (let g = 0; g < groves; g++) {
    const c = polar(r() * TAU, range(r, edge - 4, map.rFlat - 4));
    const n = Math.round((8 + r() * 10) * density);
    for (let i = 0, made = 0; i < n * 3 && made < n; i++) {
      const p = polar(r() * TAU, Math.sqrt(r()) * 9);
      if (addTree(c.x + p.x, c.z + p.z, 0.8 + r() * 0.5, treeKind())) made++;
    }
  }
  // Streu-Bäume innerhalb und am Rand der Siedlung
  const scatter = Math.round(60 * density);
  for (let i = 0, made = 0; i < scatter * 6 && made < scatter; i++) {
    const p = polar(r() * TAU, range(r, plaza.a + 4, map.rFlat + 4));
    if (addTree(p.x, p.z, 0.75 + r() * 0.55, treeKind())) made++;
  }
  // Waldrand und Hügelwald
  if (forest) {
    const belt = Math.round(260 * density);
    for (let i = 0, made = 0; i < belt * 5 && made < belt; i++) {
      const p = polar(r() * TAU, range(r, edge + 4, map.rFlat + 48));
      if (
        addTree(
          p.x,
          p.z,
          (0.9 + r() * 0.6) * 1.2,
          r() < Math.max(0.35, pal.conifer) ? "nadel" : treeKind(),
        )
      )
        made++;
    }
  }

  // 4. Büsche, Steine, Blumeninseln
  const smalls = (
    count: number,
    rad: number,
    list: Small[],
    colors: string[],
    rMin: number,
    rMax: number,
    pathGap: number,
  ) => {
    for (let i = 0, made = 0; i < count * 6 && made < count; i++) {
      const p = polar(r() * TAU, range(r, rMin, rMax));
      const s = 0.7 + r() * 0.6;
      if (!grid.free(p.x, p.z, rad * s, 0.15)) continue;
      if (blocked(space, p.x, p.z, rad * s, pathGap, false)) continue;
      grid.add(p.x, p.z, rad * s);
      list.push({
        x: p.x,
        z: p.z,
        y: heightAt(map, p.x, p.z),
        s,
        rot: r() * TAU,
        color: color(colors),
      });
      made++;
    }
  };
  smalls(Math.round(55 * density), 0.55, out.bushes, pal.bushes, plaza.a + 3, map.rFlat + 10, 0.9);
  smalls(
    Math.round((map.stimmung === "alpin" ? 40 : 22) * density),
    0.4,
    out.rocks,
    pal.rocks,
    plaza.a + 5,
    map.rFlat + 20,
    0.6,
  );
  smalls(Math.round(34 * density), 0.7, out.flowers, pal.flowers, plaza.a + 3, map.rFlat - 4, 0.5);
  return out;
}

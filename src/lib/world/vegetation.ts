/**
 * Automatisches Grün und Licht: Laternen an Plätzen und Wegen, Bäume, Büsche, Steine und Blumeninseln.
 * Alles kommt **nach** Häusern und eigener Deko und weicht ihnen aus. Untereinander halten Elemente einen
 * Mindestabstand je Art (Poisson-Verteilung), damit nichts ineinander steckt.
 */

import { DIRECTIONS } from "./axes";
import { circle, polar, polylineLength, TAU, type Pt } from "./geom";
import { heightAt, riversOf, waterEdgeDist } from "./map";
import { range, rng } from "./seed";
import { Space, type ClaimKind } from "./space";

/** Baumarten; `weide` (Trauerweide am Ufer) nur in Generator v2. */
export type TreeKind = "laub" | "nadel" | "obst" | "bluete" | "weide";
export type Tree = {
  x: number;
  z: number;
  y: number;
  s: number;
  rot: number;
  kind: TreeKind;
  color: string;
  /** v3: feste Nummer des Baums (Bau-Modus: versetzen). */
  i?: number;
};
export type Small = { x: number; z: number; y: number; s: number; rot: number; color: string };
export type Vegetation = { trees: Tree[]; bushes: Small[]; rocks: Small[]; flowers: Small[] };
export type LampSpot = { x: number; z: number };

/** Kronenradius eines Baums (für Abstände). */
export const treeRadius = (kind: TreeKind, s: number) =>
  (kind === "nadel" ? 0.95 : kind === "weide" ? 1.6 : 1.15) * s;

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

  // 2b. Nur v2: Trauerweiden an Fluss und Bächen (eigener Zufallsstrom, v1 bleibt unberührt)
  if (map.version === 2) {
    const wr = rng(seed, "weiden");
    for (const river of riversOf(map)) {
      const pts = river.points;
      let side = wr() < 0.5 ? 1 : -1;
      for (let i = 4 + Math.floor(wr() * 6); i < pts.length - 4; i += 6 + Math.floor(wr() * 4)) {
        const p = pts[i];
        if (Math.hypot(p.x, p.z) > map.rFlat + 30) continue;
        const a = pts[i - 2];
        const b = pts[i + 2];
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const sc = (0.85 + wr() * 0.3) * density ** 0.2;
        const off = river.width / 2 + treeRadius("weide", sc) + 1.15;
        side = wr() < 0.7 ? -side : side;
        const x = p.x + (-(b.z - a.z) / l) * off * side;
        const z = p.z + ((b.x - a.x) / l) * off * side;
        const rad = treeRadius("weide", sc);
        if (!grid.free(x, z, rad, 0.15) || blocked(space, x, z, rad, 1.6, true)) continue;
        grid.add(x, z, rad);
        out.trees.push({
          x,
          z,
          y: heightAt(map, x, z),
          s: sc,
          rot: wr() * TAU,
          kind: "weide",
          color: pal.leaves[Math.floor(wr() * pal.leaves.length) % pal.leaves.length],
        });
      }
    }
  }
  // Waldanteil der Welt (nur v2, sonst 1)
  const forestK = map.params?.forest ?? 1;

  // 3. Wäldchen in der Wiese und Waldrand um die Siedlung
  const edge = Math.max(settlementR + 9, 34);
  const groves = 3 + Math.floor(r() * 3);
  for (let g = 0; g < groves; g++) {
    const c = polar(r() * TAU, range(r, edge - 4, map.rFlat - 4));
    const n = Math.round((8 + r() * 10) * density * forestK);
    for (let i = 0, made = 0; i < n * 3 && made < n; i++) {
      const p = polar(r() * TAU, Math.sqrt(r()) * 9);
      if (addTree(c.x + p.x, c.z + p.z, 0.8 + r() * 0.5, treeKind())) made++;
    }
  }
  // Streu-Bäume innerhalb und am Rand der Siedlung
  const scatter = Math.round(60 * density * forestK);
  for (let i = 0, made = 0; i < scatter * 6 && made < scatter; i++) {
    const p = polar(r() * TAU, range(r, plaza.a + 4, map.rFlat + 4));
    if (addTree(p.x, p.z, 0.75 + r() * 0.55, treeKind())) made++;
  }
  // Waldrand und Hügelwald
  if (forest) {
    const belt = Math.round(260 * density * forestK);
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
    Math.round((map.stimmung === "alpin" ? 40 : 22) * density * (0.6 + (map.params?.rocks ?? 0.4))),
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

// ---------- v3: feste Lagen aus dem Seed, Sichtbarkeit nach Siedlung (Phase 4h) ----------

/** v3: Baum mit fester Nummer (für versetzte Bäume im Welt-Dokument). */
export type TreeCand = Tree & {
  i: number;
  /** Waldrand: nur sichtbar, wenn so weit weg von der Mitte, dass die Siedlung Platz hat. */
  belt?: number;
  /** Obstgarten: gehört zum Merkmal, wird nicht von der Siedlung verdrängt. */
  orchard?: boolean;
  /** Ausdünnung auf dem Handy: bleibt sichtbar, wenn `keep < density`. */
  keep: number;
};
type SmallCand = Small & { keep: number; rad: number; pathGap: number };
export type VegetationCands = {
  trees: TreeCand[];
  bushes: SmallCand[];
  rocks: SmallCand[];
  flowers: SmallCand[];
};
/** Versetzter Baum (Nummer → neue Lage). */
export type TreeMoves = Record<string, { x: number; z: number }>;

/** Stabile Zahl 0…1 aus einer Nummer (Ausdünnung unabhängig von der Reihenfolge). */
function keepOf(seed: string, kind: string, i: number) {
  return rng(seed, `behalten-${kind}-${i}`)();
}

/**
 * v3: Alle möglichen Pflanzen einer Karte. Lage, Art, Grösse und Farbe hängen nur vom Seed und der Karte ab
 * (Wasser, Merkmale, Wanderweg, Dorfplatz), nie von Häusern oder Wegen: Was die Siedlung verdeckt, kommt am
 * selben Ort zurück, sobald wieder Platz ist.
 */
export function vegetationCandidates(space: Space, seed: string): VegetationCands {
  const map = space.map;
  const pal = map.palette;
  const plaza = map.plaza;
  const r = rng(seed, "natur-v3");
  const grid = new Grid(4);
  const out: VegetationCands = { trees: [], bushes: [], rocks: [], flowers: [] };
  const color = (list: string[]) => list[Math.floor(r() * list.length) % list.length];
  const plazaR = plaza.a / Math.cos(Math.PI / plaza.n) + 0.6;
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
  // Nur die Karte zählt: Wasser, Merkmale, Wanderweg, Dorfplatz, Rand
  const mapBlocked = (x: number, z: number, rad: number, pathGap: number) =>
    Math.hypot(x, z) - rad < plazaR ||
    Math.hypot(x, z) + rad > map.rFlat + 60 ||
    waterEdgeDist(map, x, z) < rad + 1.0 ||
    !!space.conflict(circle(x, z, rad), {
      margin: 0.4,
      pathClearance: pathGap,
      skipWater: true,
      skipBounds: true,
      asKind: "deko",
    });
  const addTree = (
    x: number,
    z: number,
    s: number,
    kind: TreeKind,
    extra: Partial<TreeCand> = {},
  ) => {
    const rad = treeRadius(kind, s);
    const rot = r() * TAU;
    const c = treeColor(kind);
    if (!grid.free(x, z, rad, 0.15)) return false;
    if (!extra.orchard && mapBlocked(x, z, rad, 1.6)) return false;
    grid.add(x, z, rad);
    const i = out.trees.length;
    out.trees.push({
      x,
      z,
      y: extra.orchard ? 0 : heightAt(map, x, z),
      s,
      rot,
      kind,
      color: c,
      i,
      keep: keepOf(seed, "baum", i),
      ...extra,
    });
    return true;
  };

  // 1. Bäume rund um den Dorfplatz (zwischen den Ausgängen)
  for (let k = 0; k < DIRECTIONS; k++) {
    const mid = plaza.rot + ((k + 0.5) * TAU) / DIRECTIONS;
    const p = polar(mid, plaza.a / Math.cos(Math.PI / plaza.n) + 2.6);
    addTree(p.x, p.z, 1.0 + r() * 0.2, map.stimmung === "alpin" ? "nadel" : "laub");
  }
  // 2. Obstgarten
  if (map.orchard) {
    const o = map.orchard;
    const c = Math.cos(o.angle);
    const sn = Math.sin(o.angle);
    for (let i = -1; i <= 1; i++)
      for (let j = -2; j <= 2; j++) {
        const lx = j * (o.w / 5);
        const lz = i * (o.d / 3);
        const x = o.x + lx * c + lz * sn;
        const z = o.z - lx * sn + lz * c;
        const sc = 0.85 + r() * 0.15;
        if (waterEdgeDist(map, x, z) < treeRadius("obst", sc) + 1) continue;
        addTree(x, z, sc, "obst", { orchard: true });
      }
  }
  // 3. Trauerweiden an Fluss und Bächen
  for (const river of riversOf(map)) {
    const pts = river.points;
    let side = r() < 0.5 ? 1 : -1;
    for (let i = 4 + Math.floor(r() * 6); i < pts.length - 4; i += 6 + Math.floor(r() * 4)) {
      const p = pts[i];
      const sc = 0.85 + r() * 0.3;
      side = r() < 0.7 ? -side : side;
      if (Math.hypot(p.x, p.z) > map.rFlat + 30) continue;
      const a = pts[i - 2];
      const b = pts[i + 2];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const off = river.width / 2 + treeRadius("weide", sc) + 1.15;
      addTree(
        p.x + (-(b.z - a.z) / l) * off * side,
        p.z + ((b.x - a.x) / l) * off * side,
        sc,
        "weide",
      );
    }
  }
  const forestK = map.params?.forest ?? 1;
  // 4. Wäldchen, Streu-Bäume, Waldrand (fester Bereich; sichtbar je nach Grösse der Siedlung)
  const groves = 3 + Math.floor(r() * 3);
  for (let g = 0; g < groves; g++) {
    const c = polar(r() * TAU, range(r, 30, map.rFlat - 4));
    const n = Math.round((8 + r() * 10) * forestK);
    for (let i = 0, made = 0; i < n * 3 && made < n; i++) {
      const p = polar(r() * TAU, Math.sqrt(r()) * 9);
      const s = 0.8 + r() * 0.5;
      if (addTree(c.x + p.x, c.z + p.z, s, treeKind())) made++;
    }
  }
  const scatter = Math.round(60 * forestK);
  for (let i = 0, made = 0; i < scatter * 6 && made < scatter; i++) {
    const p = polar(r() * TAU, range(r, plaza.a + 4, map.rFlat + 4));
    const s = 0.75 + r() * 0.55;
    if (addTree(p.x, p.z, s, treeKind())) made++;
  }
  const belt = Math.round(300 * forestK);
  for (let i = 0, made = 0; i < belt * 5 && made < belt; i++) {
    const rho = range(r, 38, map.rFlat + 48);
    const p = polar(r() * TAU, rho);
    const s = (0.9 + r() * 0.6) * 1.2;
    const kind = r() < Math.max(0.35, pal.conifer) ? "nadel" : treeKind();
    if (addTree(p.x, p.z, s, kind, { belt: rho })) made++;
  }
  // 5. Büsche, Steine, Blumeninseln
  const smalls = (
    kind: string,
    count: number,
    rad: number,
    list: SmallCand[],
    colors: string[],
    rMin: number,
    rMax: number,
    pathGap: number,
  ) => {
    for (let i = 0, made = 0; i < count * 6 && made < count; i++) {
      const p = polar(r() * TAU, range(r, rMin, rMax));
      const s = 0.7 + r() * 0.6;
      const rot = r() * TAU;
      const c = color(colors);
      if (!grid.free(p.x, p.z, rad * s, 0.15) || mapBlocked(p.x, p.z, rad * s, pathGap)) continue;
      grid.add(p.x, p.z, rad * s);
      list.push({
        x: p.x,
        z: p.z,
        y: heightAt(map, p.x, p.z),
        s,
        rot,
        color: c,
        keep: keepOf(seed, kind, list.length),
        rad: rad * s,
        pathGap,
      });
      made++;
    }
  };
  smalls("busch", 55, 0.55, out.bushes, pal.bushes, plaza.a + 3, map.rFlat + 10, 0.9);
  smalls(
    "stein",
    Math.round((map.stimmung === "alpin" ? 40 : 22) * (0.6 + (map.params?.rocks ?? 0.4))),
    0.4,
    out.rocks,
    pal.rocks,
    plaza.a + 5,
    map.rFlat + 20,
    0.6,
  );
  smalls("blume", 34, 0.7, out.flowers, pal.flowers, plaza.a + 3, map.rFlat - 4, 0.5);
  return out;
}

/**
 * v3: Welche Pflanzen sind sichtbar? Verdeckt ist, was auf Häusern, Gärten, Wegen, Plätzen, Laternen oder vor
 * einer Hausfront stünde, Waldrand innerhalb der Siedlung und auf dem Handy die ausgedünnten. Versetzte Bäume
 * stehen an ihrer neuen Lage und verdrängen, was dort war. Die Lage selbst ändert sich nie.
 */
export function vegetationVisible(
  cands: VegetationCands,
  space: Space,
  opts: { settlementR: number; density: number; forest: boolean; moves?: TreeMoves },
): {
  trees: boolean[];
  bushes: boolean[];
  rocks: boolean[];
  flowers: boolean[];
  invalid: number[];
} {
  const moves = opts.moves ?? {};
  const edge = Math.max(opts.settlementR + 9, 34);
  const moved = new Grid(4);
  const invalid: number[] = [];
  for (const [k, m] of Object.entries(moves)) {
    const t = cands.trees[Number(k)];
    if (!t) {
      invalid.push(Number(k));
      continue;
    }
    const rad = treeRadius(t.kind, t.s);
    if (blocked(space, m.x, m.z, rad, 1.6, true) || !moved.free(m.x, m.z, rad, 0.15)) {
      invalid.push(t.i);
      continue;
    }
    moved.add(m.x, m.z, rad);
  }
  const bad = new Set(invalid);
  const trees = cands.trees.map((t) => {
    // Gültig versetzt: steht am neuen Ort. Passt der neue Ort nicht (mehr), gilt der Seed-Platz wie für alle
    if (moves[t.i] && !bad.has(t.i)) return true;
    if (t.keep >= opts.density) return false;
    const rad = treeRadius(t.kind, t.s);
    if (!moved.free(t.x, t.z, rad, 0.15)) return false;
    if (t.belt !== undefined && (!opts.forest || t.belt < edge + 4)) return false;
    if (t.orchard) return true;
    return !blocked(space, t.x, t.z, rad, 1.6, true);
  });
  const smalls = (list: SmallCand[]) =>
    list.map(
      (s) =>
        s.keep < opts.density &&
        moved.free(s.x, s.z, s.rad, 0.15) &&
        !blocked(space, s.x, s.z, s.rad, s.pathGap, false),
    );
  return {
    trees,
    bushes: smalls(cands.bushes),
    rocks: smalls(cands.rocks),
    flowers: smalls(cands.flowers),
    invalid,
  };
}

/** v3: Passt ein Baum an diese Stelle (Bau-Modus, Vorschau beim Ziehen)? Gleiche Regel wie beim Erzeugen. */
export function treeFits(space: Space, t: Pick<Tree, "kind" | "s">, x: number, z: number): boolean {
  return !blocked(space, x, z, treeRadius(t.kind, t.s), 1.6, true);
}

/** v3: Sichtbare Pflanzen samt versetzten Bäumen (Nummer `i` bleibt für den Bau-Modus erhalten). */
export function placeVegetationV3(
  space: Space,
  seed: string,
  opts: { settlementR: number; density: number; forest: boolean; moves?: TreeMoves },
): Vegetation & { invalidMoves: number[] } {
  const cands = vegetationCandidates(new Space(space.map), seed);
  const vis = vegetationVisible(cands, space, opts);
  const map = space.map;
  const strip = <T extends Small>(s: T): Small => ({
    x: s.x,
    z: s.z,
    y: s.y,
    s: s.s,
    rot: s.rot,
    color: s.color,
  });
  const bad = new Set(vis.invalid);
  return {
    trees: cands.trees
      .filter((t) => vis.trees[t.i])
      .map((t) => {
        const m = bad.has(t.i) ? undefined : opts.moves?.[t.i];
        const p = m ?? t;
        return {
          x: p.x,
          z: p.z,
          y: t.orchard && !m ? 0 : heightAt(map, p.x, p.z),
          s: t.s,
          rot: t.rot,
          kind: t.kind,
          color: t.color,
          i: t.i,
        };
      }),
    bushes: cands.bushes.filter((_, i) => vis.bushes[i]).map(strip),
    rocks: cands.rocks.filter((_, i) => vis.rocks[i]).map(strip),
    flowers: cands.flowers.filter((_, i) => vis.flowers[i]).map(strip),
    invalidMoves: vis.invalid,
  };
}

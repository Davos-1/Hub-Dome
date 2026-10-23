"use client";

import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { Pasture } from "@/lib/world/map";
import type { VillagePath } from "@/lib/paths";
import { box, cyl, sphere, type Part } from "../geo";
import { Herd, useMerged } from "./herd";

const heading = (dx: number, dz: number) => Math.atan2(dx, dz);

// ---------- Modelle (Blick nach +z) ----------

function sheepParts(): Part[] {
  const wool = "#f4efe4";
  const dark = "#3b3b3f";
  return [
    { geo: sphere(0.34, 10), color: wool, pos: [0, 0.5, 0], scale: [1.05, 0.95, 1.4] },
    { geo: sphere(0.22, 8), color: wool, pos: [0.13, 0.62, -0.28] },
    { geo: sphere(0.22, 8), color: wool, pos: [-0.13, 0.62, -0.28] },
    { geo: sphere(0.17, 8), color: dark, pos: [0, 0.62, 0.52], scale: [0.9, 1, 1.15] },
    { geo: sphere(0.06, 6), color: dark, pos: [0.15, 0.7, 0.42], scale: [1, 0.5, 1.4] },
    { geo: sphere(0.06, 6), color: dark, pos: [-0.15, 0.7, 0.42], scale: [1, 0.5, 1.4] },
    ...[
      [0.14, 0.3],
      [-0.14, 0.3],
      [0.14, -0.3],
      [-0.14, -0.3],
    ].map(([x, z]): Part => ({ geo: cyl(0.04, 0.04, 0.3, 6), color: dark, pos: [x, 0.15, z] })),
  ];
}

function chickenParts(): Part[] {
  return [
    { geo: sphere(0.14, 8), color: "#f6f0e2", pos: [0, 0.2, 0], scale: [0.9, 0.95, 1.2] },
    { geo: sphere(0.08, 8), color: "#f6f0e2", pos: [0, 0.34, 0.15] },
    { geo: sphere(0.03, 6), color: "#dc2626", pos: [0, 0.43, 0.15], scale: [0.5, 1, 1.3] },
    {
      geo: new THREE.ConeGeometry(0.03, 0.08, 6),
      color: "#f59e0b",
      pos: [0, 0.33, 0.24],
      rot: [Math.PI / 2, 0, 0],
    },
    {
      geo: new THREE.ConeGeometry(0.1, 0.18, 6),
      color: "#b45309",
      pos: [0, 0.3, -0.18],
      rot: [-1.0, 0, 0],
    },
    { geo: cyl(0.015, 0.015, 0.1, 4), color: "#f59e0b", pos: [0.04, 0.05, 0] },
    { geo: cyl(0.015, 0.015, 0.1, 4), color: "#f59e0b", pos: [-0.04, 0.05, 0] },
  ];
}

function duckParts(): Part[] {
  return [
    { geo: sphere(0.2, 10), color: "#8b6b3e", pos: [0, 0.14, 0], scale: [0.85, 0.7, 1.3] },
    { geo: sphere(0.11, 8), color: "#2f7d4f", pos: [0, 0.32, 0.17] },
    {
      geo: new THREE.ConeGeometry(0.045, 0.12, 6),
      color: "#f4c430",
      pos: [0, 0.3, 0.3],
      rot: [Math.PI / 2, 0, 0],
    },
    {
      geo: new THREE.ConeGeometry(0.08, 0.14, 6),
      color: "#6f5430",
      pos: [0, 0.2, -0.26],
      rot: [-1.3, 0, 0],
    },
  ];
}

function birdParts(): Part[] {
  const c = "#2b2f3a";
  return [
    { geo: sphere(0.09, 6), color: c, scale: [0.8, 0.8, 1.6] },
    { geo: box(0.55, 0.015, 0.14), color: c, pos: [0.3, 0.03, 0], rot: [0, 0, 0.25] },
    { geo: box(0.55, 0.015, 0.14), color: c, pos: [-0.3, 0.03, 0], rot: [0, 0, -0.25] },
  ];
}

function butterflyParts(color: string): Part[] {
  return [
    { geo: box(0.1, 0.01, 0.12), color, pos: [0.06, 0, 0], rot: [0, 0.3, 0.2] },
    { geo: box(0.1, 0.01, 0.12), color, pos: [-0.06, 0, 0], rot: [0, -0.3, -0.2] },
    { geo: box(0.015, 0.015, 0.1), color: "#27272a" },
  ];
}

function personParts(shirt: string, hair: string): Part[] {
  return [
    { geo: new THREE.CapsuleGeometry(0.17, 0.4, 4, 8), color: shirt, pos: [0, 0.48, 0] },
    { geo: sphere(0.17, 10), color: "#f3c9a4", pos: [0, 1.0, 0] },
    {
      geo: new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      color: hair,
      pos: [0, 1.03, -0.01],
    },
    { geo: cyl(0.06, 0.06, 0.34, 6), color: "#374151", pos: [-0.07, 0.15, 0] },
    { geo: cyl(0.06, 0.06, 0.34, 6), color: "#374151", pos: [0.07, 0.15, 0] },
  ];
}

// ---------- Tiere ----------

/** Schafe auf der Weide: langsames Umherwandern innerhalb der Koppel. */
export function Sheep({
  pasture,
  count,
  frozen,
}: {
  pasture: Pasture;
  count: number;
  frozen: boolean;
}) {
  const geometry = useMerged(sheepParts);
  const { x: px, z: pz, w, d, angle } = pasture;
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const hw = w / 2 - 1.2;
      const hd = d / 2 - 1.2;
      const f = 0.16 + (i % 3) * 0.04;
      const pos = (tt: number) => ({
        u: hw * Math.sin(tt * f + i * 2.1) * Math.cos(tt * 0.05 + i),
        v: hd * Math.sin(tt * (f * 0.8) + i * 1.3 + 1),
      });
      const a = pos(t);
      const b = pos(t + 0.3);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      o.position.set(px + a.u * c + a.v * s, 0, pz - a.u * s + a.v * c);
      const du = b.u - a.u;
      const dv = b.v - a.v;
      o.rotation.y = heading(du * c + dv * s, -du * s + dv * c);
      // Grasen: Kopf nickt, Körper wippt leicht
      o.position.y = 0.02 * Math.abs(Math.sin(t * 2.2 + i));
      o.rotation.x = 0.06 * Math.sin(t * 1.1 + i * 2);
    },
    [px, pz, w, d, angle],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} />;
}

/** Hühner scharren hinter einem Haus. */
export function Chickens({
  center,
  count,
  frozen,
}: {
  /** Hühnerhof (Mitte, Radius des Zauns): die Hühner bleiben sicher innerhalb. */
  center: { x: number; z: number; r: number };
  count: number;
  frozen: boolean;
}) {
  const geometry = useMerged(chickenParts);
  const reach = Math.max(0.3, center.r - 0.55);
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const f = 0.7 + (i % 2) * 0.25;
      // Höchstens 0.75 + 0.25 = 1.0 × reach vom Mittelpunkt entfernt
      const p = (tt: number) => ({
        x:
          center.x +
          reach * (0.75 * Math.sin(tt * f * 0.6 + i * 1.7) + 0.25 * Math.sin(tt * 2.3 + i)) * 0.7,
        z:
          center.z +
          reach * (0.75 * Math.cos(tt * f * 0.5 + i * 2.3) + 0.25 * Math.cos(tt * 2.9 + i)) * 0.7,
      });
      const a = p(t);
      const b = p(t + 0.2);
      o.position.set(a.x, 0.02 * Math.abs(Math.sin(t * 9 + i * 3)), a.z);
      o.rotation.y = heading(b.x - a.x, b.z - a.z);
      o.rotation.x = 0.25 * Math.max(0, Math.sin(t * 1.3 + i * 2)); // pickt am Boden
    },
    [center.x, center.z, reach],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} />;
}

/** Enten ziehen ihre Kreise auf dem Teich. */
export function Ducks({
  water,
  count,
  frozen,
}: {
  /** Teich oder See (Mitte und Radius); die Enten bleiben innerhalb. */
  water: { x: number; z: number; r: number };
  count: number;
  frozen: boolean;
}) {
  const geometry = useMerged(duckParts);
  const { x, z, r } = water;
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const rho = Math.min(r - 0.9, 0.9 + i * 0.7);
      const w = (0.22 + i * 0.05) * (i % 2 ? -1 : 1);
      const a = t * w + i * 2.4;
      o.position.set(
        x + Math.cos(a) * rho,
        0.06 + 0.015 * Math.sin(t * 2 + i),
        z + Math.sin(a) * rho,
      );
      o.rotation.y = heading(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w));
    },
    [x, z, r],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} />;
}

/**
 * Enten auf einem Fluss oder Bach (v2): paddeln auf einem Abschnitt nahe am Dorf langsam hin und her,
 * immer in Fliessrichtung ausgerichtet und auf ihrer Seite des Wassers.
 */
export function RiverDucks({
  river,
  count,
  frozen,
}: {
  river: { points: { x: number; z: number }[]; width: number };
  count: number;
  frozen: boolean;
}) {
  const geometry = useMerged(duckParts);
  const track = useMemo(() => {
    // Abschnitt nahe am Dorf (25–80 m von der Mitte), sonst der ganze Lauf
    const near = river.points.filter((p) => {
      const d = Math.hypot(p.x, p.z);
      return d > 25 && d < 80;
    });
    const pts = near.length > 12 ? near : river.points;
    const mid = Math.floor(pts.length / 2);
    return pts.slice(Math.max(0, mid - 14), Math.min(pts.length, mid + 14));
  }, [river.points]);
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const n = track.length - 1;
      // Hin und her mit weichem Wenden, jede Ente mit eigenem Takt
      const u = 0.5 - 0.5 * Math.cos(t * (0.05 + i * 0.012) + i * 1.7);
      const f = u * (n - 1);
      const k = Math.min(n - 1, Math.floor(f));
      const a = track[k];
      const b = track[k + 1];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const side = ((i % 3) - 1) * river.width * 0.22;
      const px = a.x + (b.x - a.x) * (f - k) + (-(b.z - a.z) / l) * side;
      const pz = a.z + (b.z - a.z) * (f - k) + ((b.x - a.x) / l) * side;
      o.position.set(px, 0.06 + 0.015 * Math.sin(t * 2 + i), pz);
      const dir = Math.sin(t * (0.05 + i * 0.012) + i * 1.7) >= 0 ? 1 : -1;
      o.rotation.y = heading(((b.x - a.x) / l) * dir, ((b.z - a.z) / l) * dir);
    },
    [track, river.width],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} />;
}

/** Vögel kreisen hoch über dem Dorf und schlagen mit den Flügeln. */
export function Birds({
  extent,
  count,
  frozen,
}: {
  extent: number;
  count: number;
  frozen: boolean;
}) {
  const geometry = useMerged(birdParts);
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const rad = extent * (0.35 + (i % 4) * 0.22) + 6;
      const w = (0.09 + (i % 3) * 0.025) * (i % 2 ? 1 : -1);
      const a = t * w + i * 1.9;
      o.position.set(
        Math.cos(a) * rad,
        13 + (i % 5) * 2.4 + Math.sin(t * 0.5 + i) * 0.8,
        Math.sin(a) * rad,
      );
      o.rotation.y = heading(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w));
      o.rotation.z = -0.25 * Math.sign(w);
      o.scale.set(1.2, 0.6 + 0.6 * Math.abs(Math.sin(t * 7 + i)), 1.2);
    },
    [extent],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} shadows={false} />;
}

/** Schmetterlinge über den Blumeninseln (bleiben nahe an ihrer Insel, also ausserhalb der Gärten). */
export function Butterflies({
  spots,
  count,
  frozen,
}: {
  spots: { x: number; z: number }[];
  count: number;
  frozen: boolean;
}) {
  const colors = ["#f59e0b", "#60a5fa", "#f472b6", "#fde047"];
  // Eine Herde pro Farbe, damit jede Farbe ihre eigene Geometrie hat.
  const n = spots.length ? count : 0;
  const per = Math.ceil(n / colors.length);
  return (
    <>
      {colors.map((c, k) => (
        <ButterflyGroup
          key={c}
          color={c}
          index={k}
          count={Math.min(per, Math.max(0, n - k * per))}
          spots={spots}
          frozen={frozen}
        />
      ))}
    </>
  );
}

function ButterflyGroup({
  color,
  index,
  count,
  spots,
  frozen,
}: {
  color: string;
  index: number;
  count: number;
  spots: { x: number; z: number }[];
  frozen: boolean;
}) {
  const geometry = useMerged(() => butterflyParts(color));
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const k = index * 7 + i;
      const spot = spots[(k * 5) % spots.length];
      const px = (tt: number) =>
        spot.x + 0.8 * Math.sin(tt * 0.7 + k) + 0.3 * Math.sin(tt * 2.1 + k);
      const pz = (tt: number) => spot.z + 0.9 * Math.cos(tt * 0.6 + k * 1.3);
      o.position.set(px(t), 0.8 + 0.35 * Math.sin(t * 1.7 + k), pz(t));
      o.rotation.y = heading(px(t + 0.2) - px(t), pz(t + 0.2) - pz(t));
      o.scale.set(0.5 + 0.5 * Math.abs(Math.sin(t * 14 + k)), 1, 1);
    },
    [index, spots],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} shadows={false} />;
}

// ---------- Dorfbewohner ----------

const SHIRTS = [
  ["#ef4444", "#4a3426"],
  ["#3b82f6", "#1f2937"],
  ["#10b981", "#8a5a2b"],
  ["#f59e0b", "#2b2b2b"],
] as const;

function cumulative(points: { x: number; z: number }[]) {
  const acc = [0];
  for (let i = 1; i < points.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  }
  return acc;
}

/** Position bei Bogenlänge s (0…L) auf dem Linienzug samt Laufrichtung. */
function at(points: { x: number; z: number }[], acc: number[], s: number) {
  const L = acc[acc.length - 1];
  const ss = Math.max(0, Math.min(L, s));
  let i = 1;
  while (i < acc.length - 1 && acc[i] < ss) i++;
  const seg = acc[i] - acc[i - 1] || 1;
  const k = (ss - acc[i - 1]) / seg;
  const a = points[i - 1];
  const b = points[i];
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: b.x - a.x, dz: b.z - a.z };
}

function WalkerGroup({
  colorIndex,
  walkers,
  paths,
  frozen,
}: {
  colorIndex: number;
  walkers: number[];
  paths: VillagePath[];
  frozen: boolean;
}) {
  const [shirt, hair] = SHIRTS[colorIndex];
  const geometry = useMerged(() => personParts(shirt, hair));
  const lengths = useMemo(() => paths.map((p) => cumulative(p.points)), [paths]);

  const step = useCallback(
    (n: number, t: number, o: THREE.Object3D) => {
      const w = walkers[n];
      const path = paths[w % paths.length];
      const acc = lengths[w % paths.length];
      const L = acc[acc.length - 1];
      const speed = 0.8 + ((w * 7) % 5) * 0.08;
      const pause = 2.5 + (w % 3);
      const travel = L / speed;
      const cycle = 2 * (travel + pause);
      const ph = (t + w * 6.7) % cycle;
      // hin, Pause an der Tür, zurück, Pause am Platz
      let s: number;
      let dir = 1;
      let walking = true;
      if (ph < travel) s = ph * speed;
      else if (ph < travel + pause) {
        s = L;
        walking = false;
      } else if (ph < 2 * travel + pause) {
        s = L - (ph - travel - pause) * speed;
        dir = -1;
      } else {
        s = 0;
        walking = false;
      }
      const p = at(path.points, acc, s);
      o.position.set(p.x, walking ? 0.05 * Math.abs(Math.sin(t * 7 + w)) : 0, p.z);
      o.rotation.y = heading(p.dx * dir, p.dz * dir);
      o.rotation.z = walking ? 0.05 * Math.sin(t * 7 + w) : 0;
    },
    [walkers, paths, lengths],
  );
  return <Herd geometry={geometry} count={walkers.length} step={step} frozen={frozen} />;
}

/** Dorfbewohner laufen zwischen Dorfplatz und Haustüren auf den Wegen. */
export function Villagers({
  paths,
  count,
  frozen,
}: {
  paths: VillagePath[];
  count: number;
  frozen: boolean;
}) {
  const groups = useMemo(() => {
    const g: number[][] = SHIRTS.map(() => []);
    for (let i = 0; i < count; i++) g[i % SHIRTS.length].push(i);
    return g;
  }, [count]);
  if (paths.length === 0) return null;
  return (
    <>
      {groups.map((walkers, c) => (
        <WalkerGroup key={c} colorIndex={c} walkers={walkers} paths={paths} frozen={frozen} />
      ))}
    </>
  );
}

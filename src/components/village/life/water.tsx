"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment } from "../world-env";
import { seededRandom } from "../colors";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { box, cyl, mergeParts, rbox, type Part } from "../geo";
import { T0 } from "./herd";

const dummy = new THREE.Object3D();
const col = new THREE.Color();

/** Wellen-Textur (Streifen und Glanzlichter), kachelbar in x-Richtung. */
function useWaterTexture(repeatX: number) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4aa6c9";
    ctx.fillRect(0, 0, 256, 128);
    const rnd = seededRandom("wasser");
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 256;
      const y = rnd() * 128;
      const l = 14 + rnd() * 34;
      ctx.strokeStyle = rnd() > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(20,90,140,0.25)";
      ctx.lineWidth = 1.5 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + l / 2, y - 4, x + l, y);
      ctx.stroke();
      // nahtlos: Strich am anderen Rand wiederholen
      ctx.beginPath();
      ctx.moveTo(x - 256, y);
      ctx.quadraticCurveTo(x - 256 + l / 2, y - 4, x - 256 + l, y);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useLayoutEffect(() => {
    texture.repeat.set(repeatX, 1);
  }, [texture, repeatX]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Water({
  geometry,
  texture,
  frozen,
  speed,
}: {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  frozen: boolean;
  speed: number;
}) {
  useFrame(({ clock }) => {
    if (!frozen) texture.offset.set(-((T0 + clock.elapsedTime) * speed) % 1, 0);
  });
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={texture}
        color="#9fd8ee"
        roughness={0.25}
        metalness={0.05}
        transparent
        opacity={0.95}
        vertexColors={!!geometry.getAttribute("color")}
      />
    </mesh>
  );
}

/**
 * Band entlang einer Kurve mit mehreren Spalten quer dazu (Versatz in Metern, links → rechts) und
 * Farben mit Deckkraft je Spalte (u = Länge/Meter, v quer 1 → 0).
 */
function ribbonUV(
  curve: THREE.Vector3[],
  offsets: number[],
  y: number,
  uPerMeter: number,
  colors?: [number, number, number, number][],
) {
  const pos: number[] = [];
  const uv: number[] = [];
  const cols: number[] = [];
  const idx: number[] = [];
  const k = offsets.length;
  const span = offsets[k - 1] - offsets[0] || 1;
  let len = 0;
  curve.forEach((p, i) => {
    const a = curve[Math.max(0, i - 1)];
    const b = curve[Math.min(curve.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l;
    const nz = dx / l;
    if (i > 0) len += Math.hypot(p.x - curve[i - 1].x, p.z - curve[i - 1].z);
    offsets.forEach((o, j) => {
      pos.push(p.x - nx * o, y, p.z - nz * o);
      uv.push(len * uPerMeter, 1 - (o - offsets[0]) / span);
      if (colors) cols.push(...colors[j]);
    });
    if (i > 0) {
      for (let j = 0; j < k - 1; j++) {
        const c = i * k + j;
        const pv = c - k;
        idx.push(pv, c, pv + 1, pv + 1, c, c + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (colors) g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 4));
  g.setIndex(idx);
  // Normalen nach oben (flaches Band, keine Winkelabhängigkeit)
  const n = new Float32Array((pos.length / 3) * 3);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  return { geometry: g, length: len };
}

let REED: THREE.BufferGeometry | null = null;
/** Geteilte Geometrie der Schilfbüschel (klein, bleibt für die Lebensdauer der Seite). */
const reedGeometry = () => (REED ??= mergeParts(reedParts()));

/** Schilfbüschel: vier schlanke Halme, einer mit Kolben (Höhe ~1, Fuss bei y = 0). */
function reedParts(): Part[] {
  const blade = (x: number, z: number, h: number, tx: number, tz: number): Part => ({
    geo: cyl(0.008, 0.035, h, 4),
    color: "#ffffff",
    pos: [x + tx * h * 0.5, h / 2, z + tz * h * 0.5],
    rot: [tz * 0.9, 0, -tx * 0.9],
  });
  return [
    blade(0, 0, 1.0, 0.04, 0.02),
    blade(0.07, 0.03, 0.8, 0.2, 0.08),
    blade(-0.06, 0.04, 0.75, -0.18, 0.1),
    blade(0.02, -0.07, 0.65, 0.05, -0.22),
    { geo: cyl(0.04, 0.04, 0.16, 6), color: "#7a5230", pos: [0.035, 0.98, 0.018] },
  ];
}

/** Instanzen entlang von Punkten (Schilf, Steine). */
function Scatter({
  count,
  place,
  children,
  castShadow = false,
  geometry,
}: {
  count: number;
  place: (i: number, o: THREE.Object3D, c: THREE.Color) => void;
  children: React.ReactNode;
  castShadow?: boolean;
  /** Fertige Geometrie (sonst als Kind angeben). */
  geometry?: THREE.BufferGeometry;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      place(i, dummy, col);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, place]);
  if (count <= 0) return null;
  return (
    <instancedMesh
      ref={ref}
      key={count}
      args={[geometry, undefined, count]}
      castShadow={castShadow}
    >
      {children}
    </instancedMesh>
  );
}

/** Holzbrücke mit Geländer, Achse entlang +z: Bretter, Längsträger und Handlauf folgen einem flachen Bogen. */
function bridgeParts(span: number): Part[] {
  const tones = ["#8a5a2b", "#83542a", "#90612f"];
  const dark = "#6b4423";
  const parts: Part[] = [];
  const rise = 0.3;
  // Höhe und Neigung des Bogens bei t ∈ [−0.5, 0.5]
  const arch = (t: number) => 0.3 + rise * Math.cos(Math.PI * t);
  const slope = (t: number) => Math.atan((-rise * Math.PI * Math.sin(Math.PI * t)) / span);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    parts.push({
      geo: rbox(1.9, 0.08, span / n - 0.03, 0.015),
      color: tones[(i * 7) % 3],
      pos: [0, arch(t), t * span],
      rot: [-slope(t), 0, 0],
    });
  }
  const seg = 8;
  for (const s of [-1, 1]) {
    for (let i = 0; i < seg; i++) {
      const t = (i + 0.5) / seg - 0.5;
      // Längsträger unter den Brettern und Handlauf, je Abschnitt geneigt
      parts.push({
        geo: box(0.16, 0.16, span / seg + 0.04),
        color: dark,
        pos: [s * 0.82, arch(t) - 0.12, t * span],
        rot: [-slope(t), 0, 0],
      });
      parts.push({
        geo: box(0.06, 0.06, span / seg + 0.03),
        color: tones[0],
        pos: [s * 0.9, arch(t) + 0.72, t * span],
        rot: [-slope(t), 0, 0],
      });
    }
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6 - 0.5) * 0.96;
      parts.push({
        geo: cyl(0.045, 0.05, 0.74, 6),
        color: dark,
        pos: [s * 0.9, arch(t) + 0.37, t * span],
      });
    }
    // Widerlager aus Stein an beiden Enden
    for (const e of [-1, 1])
      parts.push({
        geo: rbox(0.95, 0.36, 0.9, 0.08),
        color: "#9ca3af",
        pos: [s * 0.45, 0.13, e * (span / 2 + 0.25)],
      });
  }
  return parts;
}

/** Fluss mit animierter Wasseroberfläche, Ufer, Schilf, Steinen und Holzbrücke. */
export function River({
  river,
  frozen,
  density,
}: {
  river: NonNullable<Environment["river"]>;
  frozen: boolean;
  density: number;
}) {
  const curve = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(
      river.points.map((p) => new THREE.Vector3(p.x, 0, p.z)),
      false,
      "catmullrom",
      0.5,
    );
    return c.getSpacedPoints(160);
  }, [river.points]);

  const water = useMemo(() => {
    const h = river.width / 2;
    // Flaches Wasser am Rand heller, in der Mitte tiefer
    const edge: [number, number, number, number] = [1.3, 1.25, 1.12, 1];
    const mid: [number, number, number, number] = [0.86, 0.92, 0.98, 1];
    return ribbonUV(curve, [-h, -h * 0.45, h * 0.45, h], 0.05, 1 / 5, [edge, mid, mid, edge]);
  }, [curve, river.width]);
  const bank = useMemo(() => {
    const h = river.width / 2;
    // Nasser Sand am Wasser, trockener Sand, dann sanft in die Wiese auslaufend (Deckkraft 0)
    const wet: [number, number, number, number] = [0.62, 0.55, 0.42, 1];
    const sand: [number, number, number, number] = [0.79, 0.73, 0.56, 1];
    const fade: [number, number, number, number] = [0.79, 0.73, 0.56, 0];
    return ribbonUV(curve, [-h - 1.6, -h - 0.7, -h + 0.1, h - 0.1, h + 0.7, h + 1.6], 0.025, 1, [
      fade,
      sand,
      wet,
      wet,
      sand,
      fade,
    ]);
  }, [curve, river.width]);
  const texture = useWaterTexture(Math.max(1, Math.round(water.length / 5 / 1)));
  useEffect(() => () => water.geometry.dispose(), [water]);
  useEffect(() => () => bank.geometry.dispose(), [bank]);

  const reeds = Math.round(70 * density);
  const stones = Math.round(34 * density);
  const rnd = useMemo(
    () => seededRandom(`fluss${river.points.length}${Math.round(river.points[3].x)}`),
    [river.points],
  );
  const bankPts = useMemo(() => {
    const out: { x: number; z: number; s: number; r: number; c: number }[] = [];
    for (let k = 0; k < 200; k++) {
      const i = 4 + Math.floor(rnd() * (curve.length - 8));
      const p = curve[i];
      const q = curve[i + 1];
      const l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      const side = rnd() > 0.5 ? 1 : -1;
      const off = river.width / 2 + 0.25 + rnd() * 0.8;
      out.push({
        x: p.x + (-(q.z - p.z) / l) * off * side,
        z: p.z + ((q.x - p.x) / l) * off * side,
        s: 0.7 + rnd() * 0.8,
        r: rnd() * 6,
        c: rnd(),
      });
    }
    return out;
  }, [curve, river.width, rnd]);

  const placeReed = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const b = bankPts[i];
      o.position.set(b.x, 0, b.z);
      o.rotation.set(0, b.r, 0);
      o.scale.set(b.s, b.s, b.s);
      c.set(b.c > 0.5 ? "#6b8f3c" : "#86a84f");
    },
    [bankPts],
  );
  const placeStone = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const b = bankPts[100 + i];
      o.position.set(b.x, 0.1, b.z);
      o.rotation.y = b.r;
      o.scale.set(0.35 * b.s, 0.22 * b.s, 0.3 * b.s);
      c.set(b.c > 0.5 ? "#9ca3af" : "#a8a29e");
    },
    [bankPts],
  );

  return (
    <group>
      <mesh geometry={bank.geometry} receiveShadow>
        <meshStandardMaterial vertexColors transparent depthWrite={false} roughness={1} />
      </mesh>
      <Water geometry={water.geometry} texture={texture} frozen={frozen} speed={0.06} />
      <Scatter count={reeds} place={placeReed} geometry={reedGeometry()}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </Scatter>
      <Scatter count={stones} place={placeStone} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} />
      </Scatter>
    </group>
  );
}

/** Holzbrücken über den Fluss (Wanderweg und Gassen); Achse in Gehrichtung. */
export function Bridges({ bridges }: { bridges: Environment["bridges"] }) {
  const geometry = useMemo(() => {
    if (bridges.length === 0) return null;
    const m = new THREE.Matrix4();
    const geos = bridges.map((b) => {
      const g = mergeParts(bridgeParts(b.span));
      g.applyMatrix4(m.makeRotationY(b.angle).setPosition(b.x, 0, b.z));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [bridges]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

/** See mit unregelmässigem Ufer, Uferstreifen, Schilf und Steinen. */
export function Lake({
  lake,
  frozen,
  density,
}: {
  lake: NonNullable<Environment["lake"]>;
  frozen: boolean;
  density: number;
}) {
  const texture = useWaterTexture(6);
  const { surface, rim } = useMemo(() => {
    const shape = new THREE.Shape(
      lake.outline.map((p) => new THREE.Vector2(p.x - lake.x, -(p.z - lake.z))),
    );
    const surface = new THREE.ShapeGeometry(shape, 2);
    surface.rotateX(-Math.PI / 2);
    // UV in Metern für die Wellen-Textur
    const pos = surface.attributes.position;
    const uv = surface.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 8, pos.getZ(i) / 8);
    const outer = lake.outline.map((p) => {
      const dx = p.x - lake.x;
      const dz = p.z - lake.z;
      const l = Math.hypot(dx, dz) || 1;
      return new THREE.Vector2(dx + (dx / l) * 1.6, -(dz + (dz / l) * 1.6));
    });
    const ring = new THREE.Shape(outer);
    ring.holes.push(
      new THREE.Path(
        lake.outline.map((p) => new THREE.Vector2(p.x - lake.x, -(p.z - lake.z))).reverse(),
      ),
    );
    const rim = new THREE.ShapeGeometry(ring, 2);
    rim.rotateX(-Math.PI / 2);
    return { surface, rim };
  }, [lake]);
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => rim.dispose(), [rim]);
  const reeds = Math.round(60 * density);
  const placeReed = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const k = Math.floor((i * 7.31) % lake.outline.length);
      const p = lake.outline[k];
      const dx = p.x - lake.x;
      const dz = p.z - lake.z;
      const l = Math.hypot(dx, dz) || 1;
      const off = 0.2 + ((i * 13) % 7) * 0.12;
      o.position.set(p.x + (dx / l) * off, 0, p.z + (dz / l) * off);
      o.rotation.set(0, i, 0);
      o.scale.setScalar(0.8 + ((i * 3) % 5) * 0.15);
      c.set(i % 2 ? "#6b8f3c" : "#7aa04a");
    },
    [lake],
  );
  return (
    <group>
      <mesh geometry={rim} position={[lake.x, 0.02, lake.z]} receiveShadow>
        <meshStandardMaterial color="#c9b98f" roughness={1} />
      </mesh>
      <group position={[lake.x, 0.05, lake.z]}>
        <Water geometry={surface} texture={texture} frozen={frozen} speed={0.01} />
      </group>
      <Scatter count={reeds} place={placeReed} geometry={reedGeometry()}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </Scatter>
    </group>
  );
}

/** Teich mit Wasseroberfläche, Uferstreifen, Steinen, Seerosen und Schilf. */
export function Pond({
  pond,
  frozen,
  density,
}: {
  pond: NonNullable<Environment["pond"]>;
  frozen: boolean;
  density: number;
}) {
  const { x, z, r } = pond;
  const texture = useWaterTexture(3);
  const rim = useMemo(() => {
    const g = new THREE.RingGeometry(r * 0.96, r + 0.9, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [r]);
  const surface = useMemo(() => {
    const g = new THREE.CircleGeometry(r, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [r]);
  useEffect(() => () => rim.dispose(), [rim]);
  useEffect(() => () => surface.dispose(), [surface]);

  const stones = Math.round(14 * density);
  const lilies = Math.round(7 * density);
  const reeds = Math.round(24 * density);

  const placeStone = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const a = (i / stones) * Math.PI * 2 + Math.sin(i * 3.1) * 0.2;
      o.position.set(x + Math.cos(a) * (r + 0.55), 0.1, z + Math.sin(a) * (r + 0.55));
      o.rotation.y = a * 3;
      const s = 0.3 + ((i * 7) % 5) * 0.06;
      o.scale.set(s, s * 0.65, s * 0.9);
      c.set(i % 2 ? "#9ca3af" : "#aaa49a");
    },
    [x, z, r, stones],
  );
  const placeLily = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const a = i * 2.4;
      const rho = 0.6 + ((i * 5) % 7) * 0.33;
      o.position.set(x + Math.cos(a) * rho, 0.075, z + Math.sin(a) * rho);
      o.rotation.y = i;
      o.scale.set(0.34, 0.02, 0.34);
      c.set(i % 3 === 0 ? "#f9a8d4" : "#4f9a58");
    },
    [x, z],
  );
  const placeReed = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const a = -0.4 + (i / reeds) * 1.9 + Math.sin(i * 5) * 0.05;
      o.position.set(
        x + Math.cos(a + 2.5) * (r + 0.2 + (i % 3) * 0.2),
        0,
        z + Math.sin(a + 2.5) * (r + 0.2 + (i % 3) * 0.2),
      );
      o.rotation.set(0, i, 0);
      o.scale.setScalar(0.8 + ((i * 3) % 5) * 0.15);
      c.set(i % 2 ? "#6b8f3c" : "#7aa04a");
    },
    [x, z, r, reeds],
  );

  return (
    <group>
      <mesh geometry={rim} position={[x, 0.02, z]} receiveShadow>
        <meshStandardMaterial color="#c9b98f" roughness={1} />
      </mesh>
      <group position={[x, 0.05, z]}>
        <Water geometry={surface} texture={texture} frozen={frozen} speed={0.015} />
      </group>
      <Scatter count={stones} place={placeStone} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} />
      </Scatter>
      <Scatter count={lilies} place={placeLily}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial roughness={0.8} />
      </Scatter>
      <Scatter count={reeds} place={placeReed} geometry={reedGeometry()}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </Scatter>
    </group>
  );
}

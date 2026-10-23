"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment } from "@/lib/environment";
import { seededRandom } from "../colors";
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
      />
    </mesh>
  );
}

/** Band mit UV entlang einer Kurve (u = Länge/Meter, v quer). */
function ribbonUV(curve: THREE.Vector3[], width: number, y: number, uPerMeter: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
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
    pos.push(
      p.x + nx * width * 0.5,
      y,
      p.z + nz * width * 0.5,
      p.x - nx * width * 0.5,
      y,
      p.z - nz * width * 0.5,
    );
    uv.push(len * uPerMeter, 1, len * uPerMeter, 0);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normalen nach oben erzwingen (Winkelabhängigkeit vermeiden)
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return { geometry: g, length: len };
}

/** Instanzen entlang von Punkten (Schilf, Steine). */
function Scatter({
  count,
  place,
  children,
  castShadow = false,
}: {
  count: number;
  place: (i: number, o: THREE.Object3D, c: THREE.Color) => void;
  children: React.ReactNode;
  castShadow?: boolean;
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
      args={[undefined, undefined, count]}
      castShadow={castShadow}
    >
      {children}
    </instancedMesh>
  );
}

/** Holzbrücke mit Geländer, Achse entlang +z. */
function bridgeParts(span: number): Part[] {
  const wood = "#8a5a2b";
  const dark = "#6b4423";
  const parts: Part[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const y = 0.28 + (0.4 - Math.abs(t) * 0.8) * 0.55; // leicht gewölbt
    parts.push({
      geo: rbox(1.9, 0.1, span / n + 0.02, 0.015),
      color: i % 2 ? wood : dark,
      pos: [0, y, t * span],
      rot: [-t * 0.55, 0, 0],
    });
  }
  for (const s of [-1, 1]) {
    parts.push({ geo: rbox(0.2, 0.18, span + 0.2, 0.03), color: dark, pos: [s * 0.86, 0.18, 0] });
    for (let i = 0; i < 6; i++) {
      const t = i / 5 - 0.5;
      const y = 0.28 + (0.4 - Math.abs(t) * 0.8) * 0.55;
      parts.push({
        geo: cyl(0.045, 0.045, 0.7, 6),
        color: dark,
        pos: [s * 0.9, y + 0.38, t * span * 0.92],
      });
    }
    parts.push({ geo: box(0.06, 0.06, span * 0.95), color: wood, pos: [s * 0.9, 0.96, 0] });
    parts.push({
      geo: rbox(0.9, 0.5, 0.9, 0.08),
      color: "#9ca3af",
      pos: [s * 0.2, 0.25, (span / 2) * 1.0 + 0.3],
    });
    parts.push({
      geo: rbox(0.9, 0.5, 0.9, 0.08),
      color: "#9ca3af",
      pos: [s * 0.2, 0.25, -(span / 2) * 1.0 - 0.3],
    });
  }
  return parts;
}

/** Fluss mit animierter Wasseroberfläche, Ufer, Schilf, Steinen und Holzbrücke. */
export function River({
  env,
  frozen,
  density,
}: {
  env: Environment;
  frozen: boolean;
  density: number;
}) {
  const { river } = env;

  const curve = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(
      river.points.map((p) => new THREE.Vector3(p.x, 0, p.z)),
      false,
      "catmullrom",
      0.5,
    );
    return c.getSpacedPoints(160);
  }, [river.points]);

  const water = useMemo(() => ribbonUV(curve, river.width, 0.05, 1 / 5), [curve, river.width]);
  const bank = useMemo(() => ribbonUV(curve, river.width + 1.7, 0.025, 1), [curve, river.width]);
  const texture = useWaterTexture(Math.max(1, Math.round(water.length / 5 / 1)));
  useEffect(() => () => water.geometry.dispose(), [water]);
  useEffect(() => () => bank.geometry.dispose(), [bank]);

  const bridge = useMemo(() => mergeParts(bridgeParts(river.width + 3.2)), [river.width]);
  useEffect(() => () => bridge.dispose(), [bridge]);

  const reeds = Math.round(70 * density);
  const stones = Math.round(34 * density);
  const bankPts = useMemo(() => {
    // Generator im selben Memo: jede Neuberechnung liefert dieselben Uferpunkte
    const rnd = seededRandom(`fluss${river.points.length}${Math.round(river.points[3].x)}`);
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
  }, [curve, river.width, river.points]);

  const placeReed = useMemo(
    () => (i: number, o: THREE.Object3D, c: THREE.Color) => {
      const b = bankPts[i];
      o.position.set(b.x, 0.4 * b.s, b.z);
      o.rotation.set(0.1 * Math.sin(b.r), b.r, 0.15 * Math.cos(b.r));
      o.scale.set(1, b.s, 1);
      c.set(b.c > 0.5 ? "#6b8f3c" : "#7aa04a");
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

  const b = river.bridge;
  return (
    <group>
      <mesh geometry={bank.geometry} receiveShadow>
        <meshStandardMaterial color="#c9b98f" roughness={1} />
      </mesh>
      <Water geometry={water.geometry} texture={texture} frozen={frozen} speed={0.06} />
      <Scatter count={reeds} place={placeReed}>
        <coneGeometry args={[0.09, 0.9, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </Scatter>
      <Scatter count={stones} place={placeStone} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} />
      </Scatter>
      <group position={[b.x, 0, b.z]} rotation={[0, b.angle + Math.PI / 2, 0]}>
        <mesh geometry={bridge} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/** Teich mit Wasseroberfläche, Uferstreifen, Steinen, Seerosen und Schilf. */
export function Pond({
  env,
  frozen,
  density,
}: {
  env: Environment;
  frozen: boolean;
  density: number;
}) {
  const { x, z, r } = env.pond;
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
        0.4,
        z + Math.sin(a + 2.5) * (r + 0.2 + (i % 3) * 0.2),
      );
      o.rotation.set(0.1 * Math.sin(i), i, 0.12 * Math.cos(i));
      o.scale.set(1, 0.8 + ((i * 3) % 5) * 0.15, 1);
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
      <Scatter count={reeds} place={placeReed}>
        <coneGeometry args={[0.09, 0.9, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </Scatter>
    </group>
  );
}

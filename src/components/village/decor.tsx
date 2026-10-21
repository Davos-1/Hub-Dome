"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { VillageLayout } from "@/lib/layout";
import { isReserved, type Environment } from "@/lib/environment";
import { distanceToPolyline } from "@/lib/paths";
import { seededRandom } from "./colors";
import { cyl, mergeParts, sphere, type Part } from "./geo";
import { buildPathGeometry } from "./paths-geometry";

const dummy = new THREE.Object3D();
const color = new THREE.Color();

/** Himmel als Farbverlauf (Bildschirmraum). Keine externen Dateien. */
export function SkyBackground() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#6fb1ec");
    g.addColorStop(0.55, "#b9dcf7");
    g.addColorStop(1, "#e8f3fb");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive object={texture} attach="background" />;
}

/** Boden: Wiese mit hellerem Rand, Dorfplatz mit Steinring und Laternen. */
export function Ground({ extent, plaza }: { extent: number; plaza: number }) {
  const lamps = useMemo(() => {
    const parts: Part[] = [];
    const glowParts: Part[] = [];
    const r = plaza - 1.1;
    const count = Math.max(6, Math.round((2 * Math.PI * r) / 5.5));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.PI / count;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      parts.push({ geo: cyl(0.05, 0.07, 1.5, 8), color: "#3f3f46", pos: [x, 0.75, z] });
      parts.push({ geo: cyl(0.12, 0.12, 0.06, 10), color: "#3f3f46", pos: [x, 1.52, z] });
      glowParts.push({ geo: sphere(0.15, 10), color: "#ffd479", pos: [x, 1.7, z] });
    }
    return { body: mergeParts(parts), glow: mergeParts(glowParts) };
  }, [plaza]);
  useEffect(
    () => () => {
      lamps.body.dispose();
      lamps.glow.dispose();
    },
    [lamps],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <circleGeometry args={[extent + 40, 64]} />
        <meshStandardMaterial color="#9ccc82" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[extent + 8, 64]} />
        <meshStandardMaterial color="#86bf6c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <circleGeometry args={[plaza + 0.1, 48]} />
        <meshStandardMaterial color="#c9bfa2" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} receiveShadow>
        <ringGeometry args={[plaza - 0.3, plaza + 0.1, 48]} />
        <meshStandardMaterial color="#a8a29e" />
      </mesh>
      <mesh geometry={lamps.body} castShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh geometry={lamps.glow}>
        <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

/** Wege von der Dorfplatz-Kante zu den Haustüren: organische Kurven, ein einziger Draw Call. */
export function Paths({ layout }: { layout: VillageLayout }) {
  const geometry = useMemo(() => buildPathGeometry(layout.paths), [layout.paths]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

type Spot = { x: number; z: number; s: number; r: number; c: number };

/** Verteilt Dekoration deterministisch und hält Häuser sowie Wege frei. */
function scatter(
  layout: VillageLayout,
  seed: string,
  count: number,
  minR: number,
  maxR: number,
  houseClear: number,
  pathClear: number,
  env: Environment,
): Spot[] {
  const rnd = seededRandom(seed);
  const houses = Object.values(layout.houses);
  const out: Spot[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const r = minR + rnd() * (maxR - minR);
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const blocked =
      isReserved(env, x, z, 1) ||
      houses.some((h) => Math.hypot(h.x - x, h.z - z) < h.footprint * 2 + houseClear) ||
      layout.paths.some((p) => distanceToPolyline(x, z, p.points) < pathClear);
    if (!blocked) out.push({ x, z, s: 0.75 + rnd() * 0.6, r: rnd() * Math.PI * 2, c: rnd() });
  }
  return out;
}

/** Instanzen mit individueller Farbe, Position und Skalierung. */
function useInstances(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  spots: Spot[],
  place: (s: Spot) => { y: number; sx: number; sy: number },
  colors: string[],
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const p = place(s);
      dummy.position.set(s.x, p.y, s.z);
      dummy.rotation.set(0, s.r, 0);
      dummy.scale.set(p.sx, p.sy, p.sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(colors[Math.floor(s.c * colors.length) % colors.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [ref, spots, place, colors]);
}

const GREENS = ["#4f9a58", "#3f8a4e", "#5ba861", "#468f55"];
const BUSH_GREENS = ["#5aa65e", "#6cb56a", "#4d9a55"];
const FLOWERS = ["#f472b6", "#fbbf24", "#ffffff", "#fb7185", "#a78bfa"];
const ROCKS = ["#9ca3af", "#a8a29e", "#b6b0a6"];

const placeTree = (s: Spot) => ({ y: 0, sx: s.s, sy: s.s });
const placeCrownLow = (s: Spot) => ({ y: 0.9 * s.s, sx: s.s, sy: s.s });
const placeCrownHigh = (s: Spot) => ({ y: 1.75 * s.s, sx: s.s, sy: s.s });
const placeBush = (s: Spot) => ({ y: 0.22 * s.s, sx: s.s * 0.6, sy: s.s * 0.5 });
const placeFlower = () => ({ y: 0.08, sx: 0.9, sy: 0.9 });
const placeRock = (s: Spot) => ({ y: 0.1 * s.s, sx: s.s * 0.35, sy: s.s * 0.25 });

/**
 * Natur als Instanzen: Bäume (Stamm + zwei Kronen), Büsche, Blumen und Steine.
 * Positionen sind aus der Dorf-ID abgeleitet, also stabil. `density` skaliert für Mobile.
 */
export function Nature({
  layout,
  env,
  seed,
  density,
}: {
  layout: VillageLayout;
  env: Environment;
  seed: string;
  density: number;
}) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crownLow = useRef<THREE.InstancedMesh>(null);
  const crownHigh = useRef<THREE.InstancedMesh>(null);
  const bushes = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(
    () => scatter(layout, seed + "t", Math.round(46 * density), 8, layout.extent + 14, 5, 3.2, env),
    [layout, env, seed, density],
  );
  const bushList = useMemo(
    () => scatter(layout, seed + "b", Math.round(40 * density), 5, layout.extent + 8, 3, 2.2, env),
    [layout, env, seed, density],
  );
  const flowerList = useMemo(
    () =>
      scatter(layout, seed + "f", Math.round(120 * density), 6, layout.extent + 6, 2.4, 1.6, env),
    [layout, env, seed, density],
  );
  const rockList = useMemo(
    () => scatter(layout, seed + "r", Math.round(18 * density), 6, layout.extent + 10, 3, 2, env),
    [layout, env, seed, density],
  );

  useInstances(trunks, trees, placeTree, ["#6b4423", "#7a4f2a"]);
  useInstances(crownLow, trees, placeCrownLow, GREENS);
  useInstances(crownHigh, trees, placeCrownHigh, GREENS);
  useInstances(bushes, bushList, placeBush, BUSH_GREENS);
  useInstances(flowers, flowerList, placeFlower, FLOWERS);
  useInstances(rocks, rockList, placeRock, ROCKS);

  const white = <meshStandardMaterial color="#ffffff" roughness={0.85} />;
  return (
    <group>
      {trees.length > 0 && (
        <>
          <instancedMesh
            ref={trunks}
            args={[undefined, undefined, trees.length]}
            key={`t${trees.length}`}
            castShadow
          >
            <cylinderGeometry args={[0.12, 0.2, 1.1, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </instancedMesh>
          <instancedMesh
            ref={crownLow}
            args={[undefined, undefined, trees.length]}
            key={`cl${trees.length}`}
            castShadow
          >
            <coneGeometry args={[0.95, 1.5, 9]} />
            {white}
          </instancedMesh>
          <instancedMesh
            ref={crownHigh}
            args={[undefined, undefined, trees.length]}
            key={`ch${trees.length}`}
            castShadow
          >
            <coneGeometry args={[0.68, 1.3, 9]} />
            {white}
          </instancedMesh>
        </>
      )}
      {bushList.length > 0 && (
        <instancedMesh
          ref={bushes}
          args={[undefined, undefined, bushList.length]}
          key={`b${bushList.length}`}
          castShadow
        >
          <icosahedronGeometry args={[0.8, 1]} />
          {white}
        </instancedMesh>
      )}
      {flowerList.length > 0 && (
        <instancedMesh
          ref={flowers}
          args={[undefined, undefined, flowerList.length]}
          key={`f${flowerList.length}`}
        >
          <sphereGeometry args={[0.1, 6, 5]} />
          {white}
        </instancedMesh>
      )}
      {rockList.length > 0 && (
        <instancedMesh
          ref={rocks}
          args={[undefined, undefined, rockList.length]}
          key={`r${rockList.length}`}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          {white}
        </instancedMesh>
      )}
    </group>
  );
}

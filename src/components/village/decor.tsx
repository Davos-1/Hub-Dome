"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { computeLamps } from "@/lib/lamps";
import { isInPlot, QUARTER_COLORS, type VillageLayout } from "@/lib/layout";
import { isReserved, type Environment } from "@/lib/environment";
import { distanceToPolyline } from "@/lib/paths";
import { smooth, terrainHeight } from "@/lib/terrain";
import { seededRandom } from "./colors";
import { mainPlazaDeco, plazaSurface } from "./plaza-geometry";
import { mergeParts } from "./geo";
import { buildPathGeometry, gravelTexture } from "./paths-geometry";

const dummy = new THREE.Object3D();
const color = new THREE.Color();

/** Höhe des Geländes an (x, z), ausserhalb von Fluss, Teich, Weide und Windmühle wieder flach gedrückt. */
export function makeHeightFn(extent: number, env: Environment) {
  return (x: number, z: number) => {
    let h = terrainHeight(x, z, extent);
    if (h <= 0) return 0;
    for (const c of env.reserved) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < c.r + 5) h *= smooth((d - c.r) / 5);
      if (h <= 0) return 0;
    }
    return h;
  };
}

/** Boden: Gitter mit sanften Hügeln ausserhalb des Dorfs und Farbverlauf (innen satt, aussen heller). */
export function Ground({
  extent,
  height,
}: {
  extent: number;
  height: (x: number, z: number) => number;
}) {
  const geometry = useMemo(() => {
    const size = 2 * (extent + 140);
    const g = new THREE.PlaneGeometry(size, size, 180, 180);
    g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position;
    const cols: number[] = [];
    const cIn = new THREE.Color("#86bf6c");
    const cOut = new THREE.Color("#9ccc82");
    const cHi = new THREE.Color("#b4cf86");
    const c = new THREE.Color();
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i);
      const y = height(x, z);
      const r = Math.hypot(x, z);
      pa.setY(i, y - 0.03);
      c.copy(cIn)
        .lerp(cOut, smooth((r - extent - 4) / 8))
        .lerp(cHi, Math.min(1, y / 5) * 0.6);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }, [extent, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}

/** Plätze als Vielecke (Haupt- und Nebenplätze) samt Ausstattung des Hauptplatzes. */
export function Plazas({ layout }: { layout: VillageLayout }) {
  const surfaces = useMemo(
    () =>
      layout.polys.map((p) => {
        const q = p.main ? null : layout.quarters.find((x) => x.id === p.quarterId);
        const col = q ? QUARTER_COLORS[q.index % QUARTER_COLORS.length] : null;
        return {
          key: p.main ? "main" : (p.quarterId ?? "q"),
          x: p.x,
          z: p.z,
          geometry: plazaSurface(p, col ? col.plaza : "#c9bfa2", col ? col.edge : "#a8a29e"),
        };
      }),
    [layout],
  );
  useEffect(() => () => surfaces.forEach((s) => s.geometry.dispose()), [surfaces]);
  return (
    <group>
      {surfaces.map((s) => (
        <mesh key={s.key} geometry={s.geometry} position={[s.x, 0, s.z]} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

/** Terrasse, Bänke, Pflanzkübel und Brunnen am Hauptplatz; Laubbäume im Ring darum. */
export function PlazaDeco({ layout }: { layout: VillageLayout }) {
  const deco = useMemo(() => mainPlazaDeco(layout), [layout]);
  const geometry = useMemo(() => (deco.parts.length ? mergeParts(deco.parts) : null), [deco]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    <group>
      {geometry && (
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      )}
      <RoundTrees spots={deco.trees} />
    </group>
  );
}

const ROUND_TREE_GREENS = ["#5c9b4f", "#4f8f47", "#68a658"];

/** Laubbäume (Stamm plus zwei Kronen) als Instanzen. */
function RoundTrees({ spots }: { spots: { x: number; z: number; s: number }[] }) {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown1 = useRef<THREE.InstancedMesh>(null);
  const crown2 = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const set = (
      mesh: THREE.InstancedMesh | null,
      y: number,
      sx: number,
      sy: number,
      colors: string[] | null,
      base: string,
      tilt: boolean,
    ) => {
      if (!mesh) return;
      spots.forEach((s, i) => {
        dummy.position.set(s.x, y * s.s, s.z);
        dummy.rotation.set(tilt ? 0.3 : 0, i, 0);
        dummy.scale.set(s.s * sx, s.s * sy, s.s * sx);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.set(colors ? colors[i % colors.length] : base));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    set(trunk.current, 1.0, 1, 1, null, "#6b4423", false);
    set(crown1.current, 2.7, 1, 0.9, ROUND_TREE_GREENS, "", true);
    set(crown2.current, 3.5, 1, 1, [...ROUND_TREE_GREENS].reverse(), "", false);
  }, [spots]);
  if (spots.length === 0) return null;
  const mat = <meshStandardMaterial color="#ffffff" roughness={0.85} />;
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 2.0, 8]} />
        {mat}
      </instancedMesh>
      <instancedMesh ref={crown1} args={[undefined, undefined, spots.length]} castShadow>
        <icosahedronGeometry args={[1.25, 1]} />
        {mat}
      </instancedMesh>
      <instancedMesh ref={crown2} args={[undefined, undefined, spots.length]} castShadow>
        <icosahedronGeometry args={[0.8, 1]} />
        {mat}
      </instancedMesh>
    </>
  );
}

/** Wege als ein Mesh: Kies-Textur, Quartierfarben, weicher Übergang ins Gras. */
export function Paths({ layout }: { layout: VillageLayout }) {
  const geometry = useMemo(() => buildPathGeometry(layout.paths), [layout.paths]);
  const texture = useMemo(() => gravelTexture(), []);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors map={texture} roughness={0.97} />
    </mesh>
  );
}

/** Strassenlaternen als Instanzen; am Abend leuchten fünf echte Punktlichter am Hauptplatz. */
export function Lamps({
  layout,
  glow,
  evening,
  lowDetail,
}: {
  layout: VillageLayout;
  glow: number;
  evening: boolean;
  lowDetail: boolean;
}) {
  const spots = useMemo(() => computeLamps(layout), [layout]);
  const refs = [
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
  ];
  const parts: { y: number; geo: React.ReactNode; color: string }[] = [
    { y: 0.14, geo: <cylinderGeometry args={[0.13, 0.16, 0.28, 10]} />, color: "#34343a" },
    { y: 1.43, geo: <cylinderGeometry args={[0.045, 0.06, 2.3, 8]} />, color: "#3f3f46" },
    { y: 2.6, geo: <boxGeometry args={[0.26, 0.05, 0.26]} />, color: "#2f2f35" },
    { y: 2.72, geo: <coneGeometry args={[0.22, 0.2, 4]} />, color: "#2f2f35" },
    { y: 2.45, geo: <boxGeometry args={[0.18, 0.24, 0.18]} />, color: "#ffe9b8" },
  ];
  useLayoutEffect(() => {
    refs.forEach((r, k) => {
      const mesh = r.current;
      if (!mesh) return;
      spots.forEach((s, i) => {
        dummy.position.set(s.x, parts[k].y, s.z);
        dummy.rotation.set(0, Math.PI / 4, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  const lights = useMemo(() => {
    const main = layout.polys.find((p) => p.main);
    if (!main) return [];
    return spots
      .filter((s) => Math.hypot(s.x, s.z) < main.a)
      .filter((_, i) => i % 2 === 0)
      .slice(0, 5);
  }, [spots, layout.polys]);

  if (spots.length === 0) return null;
  return (
    <group>
      {parts.map((p, k) => (
        <instancedMesh
          key={k}
          ref={refs[k]}
          args={[undefined, undefined, spots.length]}
          castShadow={k < 4}
        >
          {p.geo}
          {k < 4 ? (
            <meshStandardMaterial color={p.color} roughness={0.6} />
          ) : (
            <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={glow} />
          )}
        </instancedMesh>
      ))}
      {!lowDetail &&
        evening &&
        lights.map((l, i) => (
          <pointLight
            key={i}
            position={[l.x, 2.4, l.z]}
            color="#ffc173"
            intensity={6}
            distance={10}
            decay={1.6}
          />
        ))}
    </group>
  );
}

type Spot = { x: number; z: number; y: number; s: number; r: number; c: number };

/** Verteilt Dekoration deterministisch und hält Plätze, Häuser, Gärten, Wege, Quartiere und Fluss frei. */
function scatter(
  layout: VillageLayout,
  env: Environment,
  height: (x: number, z: number) => number,
  seed: string,
  count: number,
  minR: number,
  maxR: number,
  houseClear: number,
  pathClear: number,
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
      Math.hypot(x, z) < layout.plazaRadius + 1.5 ||
      isReserved(env, x, z, 1) ||
      houses.some((h) => Math.hypot(h.x - x, h.z - z) < h.footprint * 2 + houseClear) ||
      layout.paths.some((p) => distanceToPolyline(x, z, p.points) < pathClear) ||
      isInPlot(layout, x, z, 0.8) ||
      layout.quarters.some((q) => Math.hypot(q.x - x, q.z - z) < q.rp + 1.5);
    if (!blocked) {
      out.push({ x, z, y: height(x, z), s: 0.75 + rnd() * 0.6, r: rnd() * Math.PI * 2, c: rnd() });
    }
  }
  return out;
}

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
      dummy.position.set(s.x, p.y + s.y - 0.05, s.z);
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
const ROCKS = ["#9ca3af", "#a8a29e", "#b6b0a6"];
const TRUNKS = ["#6b4423", "#7a4f2a"];

const placeTree = (s: Spot) => ({ y: 0, sx: s.s, sy: s.s });
const placeCrownLow = (s: Spot) => ({ y: 0.9 * s.s, sx: s.s, sy: s.s });
const placeCrownHigh = (s: Spot) => ({ y: 1.75 * s.s, sx: s.s, sy: s.s });
const placeBush = (s: Spot) => ({ y: 0.22 * s.s, sx: s.s * 0.6, sy: s.s * 0.5 });
const placeRock = (s: Spot) => ({ y: 0.1 * s.s, sx: s.s * 0.35, sy: s.s * 0.25 });

/**
 * Natur als Instanzen: Nadelbäume (Stamm plus zwei Kronen), Büsche, Steine und der Waldgürtel am Rand
 * (alles auf Geländehöhe). Positionen sind aus der Dorf-ID abgeleitet, also stabil. `density` skaliert
 * für Mobile; auf `lowDetail` entfällt der Waldgürtel.
 */
export function Nature({
  layout,
  env,
  height,
  seed,
  density,
  forest,
}: {
  layout: VillageLayout;
  env: Environment;
  height: (x: number, z: number) => number;
  seed: string;
  density: number;
  forest: boolean;
}) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crownLow = useRef<THREE.InstancedMesh>(null);
  const crownHigh = useRef<THREE.InstancedMesh>(null);
  const bushes = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);

  const e = layout.extent;
  const trees = useMemo(() => {
    const near = scatter(
      layout,
      env,
      height,
      seed + "t",
      Math.round(46 * density),
      8,
      e + 14,
      5,
      3.2,
    );
    if (!forest) return near;
    const belt = scatter(layout, env, height, seed + "w", 230, e + 9, e + 46, 5, 3.2).map((s) => ({
      ...s,
      s: s.s * 1.25,
    }));
    return near.concat(belt);
  }, [layout, env, height, seed, density, forest, e]);
  const bushList = useMemo(
    () => scatter(layout, env, height, seed + "b", Math.round(40 * density), 5, e + 8, 3, 2.2),
    [layout, env, height, seed, density, e],
  );
  const rockList = useMemo(
    () => scatter(layout, env, height, seed + "r", Math.round(18 * density), 6, e + 10, 3, 2),
    [layout, env, height, seed, density, e],
  );

  useInstances(trunks, trees, placeTree, TRUNKS);
  useInstances(crownLow, trees, placeCrownLow, GREENS);
  useInstances(crownHigh, trees, placeCrownHigh, GREENS);
  useInstances(bushes, bushList, placeBush, BUSH_GREENS);
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
            {white}
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

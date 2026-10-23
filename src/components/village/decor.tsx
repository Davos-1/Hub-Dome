"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { QUARTER_COLORS, type VillageLayout } from "@/lib/layout";
import { smooth } from "@/lib/terrain";
import type { World } from "@/lib/world/generate";
import { heightAt } from "@/lib/world/map";
import { groundRadius } from "@/lib/world/panorama";
import type { Small, Tree } from "@/lib/world/vegetation";
import { cyl, mergeParts, type Part } from "./geo";
import { willowParts } from "./seed-object-models";
import { plazaDecoParts, plazaSurface } from "./plaza-geometry";

const dummy = new THREE.Object3D();
const color = new THREE.Color();

/**
 * Boden: runde Scheibe über die ganze Karte mit Hügeln ausserhalb der flachen Zone; ihr Rand liegt unter den
 * Vorbergen des Panoramas (keine Kante am Horizont). Polares Gitter: innen fein, aussen gröber. Farben nach
 * Stimmung: innen satt, aussen heller, auf Kuppen gelblicher.
 */
export function Ground({ world, lowDetail = false }: { world: World; lowDetail?: boolean }) {
  const geometry = useMemo(() => {
    const m = world.map;
    const R = groundRadius(m);
    const seg = lowDetail ? 160 : 288;
    // Ringabstände: bis zur flachen Zone 1.6 m, danach wachsend bis ~6 m
    const radii: number[] = [0];
    for (let r = 1.6; r < R;) {
      radii.push(r);
      r += r < m.rFlat ? (lowDetail ? 2.6 : 1.6) : Math.min(6, 1.6 + (r - m.rFlat) * 0.06);
    }
    radii.push(R);
    const pos: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const cIn = new THREE.Color(m.palette.grassIn);
    const cOut = new THREE.Color(m.palette.grassOut);
    const cHi = new THREE.Color(m.palette.grassHill);
    const c = new THREE.Color();
    const inner = world.layout.extent;
    const push = (x: number, z: number) => {
      const y = heightAt(m, x, z);
      const r = Math.hypot(x, z);
      pos.push(x, y - 0.03, z);
      c.copy(cIn)
        .lerp(cOut, smooth((r - inner - 4) / 14))
        .lerp(cHi, Math.min(1, y / 5) * 0.6);
      cols.push(c.r, c.g, c.b);
    };
    push(0, 0);
    for (let i = 1; i < radii.length; i++)
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        push(Math.cos(a) * radii[i], Math.sin(a) * radii[i]);
      }
    for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
    for (let i = 1; i < radii.length - 1; i++)
      for (let j = 0; j < seg; j++) {
        const a = 1 + (i - 1) * seg + j;
        const b = 1 + (i - 1) * seg + ((j + 1) % seg);
        idx.push(a, b, a + seg, b, b + seg, a + seg);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [world, lowDetail]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}

/** Plätze als Vielecke (Dorfplatz und Quartierplätze). */
export function Plazas({ layout, paving }: { layout: VillageLayout; paving: string }) {
  const surfaces = useMemo(
    () =>
      layout.polys.map((p) => {
        const q = p.main ? null : layout.quarters.find((x) => x.id === p.quarterId);
        const col = q ? QUARTER_COLORS[q.index % QUARTER_COLORS.length] : null;
        return {
          key: p.main ? "main" : (p.quarterId ?? "q"),
          x: p.x,
          z: p.z,
          geometry: plazaSurface(p, col ? col.plaza : paving, col ? col.edge : "#a8a29e"),
        };
      }),
    [layout, paving],
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

/** Terrasse, Brunnen, Bänke und Pflanzkübel am Dorfplatz (eine Geometrie). */
export function PlazaDeco({ world }: { world: World }) {
  const geometry = useMemo(() => {
    const parts = plazaDecoParts(world);
    return parts.length ? mergeParts(parts) : null;
  }, [world]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

/** Strassenlaternen als Instanzen; am Abend und in der Nacht leuchten echte Punktlichter am Dorfplatz. */
export function Lamps({
  world,
  glow,
  lit,
  lowDetail,
}: {
  world: World;
  glow: number;
  /** Abend oder Nacht: Punktlichter an. */
  lit: boolean;
  lowDetail: boolean;
}) {
  const spots = world.lamps;
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
    const a = world.map.plaza.a;
    return spots
      .filter((s) => Math.hypot(s.x, s.z) < a + 1)
      .filter((_, i) => i % 2 === 0)
      .slice(0, 5);
  }, [spots, world.map.plaza.a]);

  if (spots.length === 0) return null;
  return (
    <group>
      {lit && <LightPools spots={spots} />}
      {parts.map((p, k) => (
        <instancedMesh
          key={`${k}-${spots.length}`}
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
        lit &&
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

/** Warmer Lichtkreis am Boden (Verlauf, additiv), damit Wege nachts ohne viele Punktlichter lesbar sind. */
function LightPools({ spots }: { spots: World["lamps"] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,200,130,0.55)");
    g.addColorStop(0.45, "rgba(255,180,110,0.22)");
    g.addColorStop(1, "rgba(255,170,100,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0.07, s.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh
      ref={ref}
      key={spots.length}
      args={[undefined, undefined, spots.length]}
      renderOrder={1}
    >
      <planeGeometry args={[6.4, 6.4]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function useInstances<
  T extends { x: number; z: number; y: number; s: number; rot: number; color: string },
>(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  spots: T[],
  place: (s: T) => { y: number; sx: number; sy: number; tilt?: number },
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const p = place(s);
      dummy.position.set(s.x, p.y + s.y - 0.05, s.z);
      dummy.rotation.set(p.tilt ?? 0, s.rot, 0);
      dummy.scale.set(p.sx, p.sy, p.sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(s.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [ref, spots, place]);
}

const TRUNK = "#6b4423";
const placeTrunk = (s: Tree) => ({ y: 0, sx: s.s, sy: s.s });
const placeNeedleLow = (s: Tree) => ({ y: 0.9 * s.s, sx: s.s, sy: s.s });
const placeNeedleHigh = (s: Tree) => ({ y: 1.75 * s.s, sx: s.s, sy: s.s });
const placeLeafLow = (s: Tree) => ({ y: 1.55 * s.s, sx: s.s, sy: s.s * 0.9, tilt: 0.3 });
const placeLeafHigh = (s: Tree) => ({ y: 2.15 * s.s, sx: s.s * 0.65, sy: s.s * 0.65 });
const placeBush = (s: Small) => ({ y: 0.22 * s.s, sx: s.s * 0.6, sy: s.s * 0.5 });
const placeRock = (s: Small) => ({ y: 0.1 * s.s, sx: s.s * 0.38, sy: s.s * 0.26 });
const placeFlower = (s: Small) => ({ y: 0.05, sx: s.s * 0.7, sy: 0.8 + s.s * 0.3 });
const placeWillow = (s: Tree) => ({ y: 0.05, sx: s.s, sy: s.s });
const WHITE = new THREE.Color("#ffffff");

/**
 * Blumenbüschel (Radius 1, Höhe absolut): Blätter und Stiele grün, Blüten weiss (die Instanzfarbe färbt
 * sie ein). Feste Anordnung nach dem goldenen Winkel, damit jedes Büschel gleich dicht wirkt.
 */
function flowerGeometries() {
  const leaves: Part[] = [];
  const blooms: Part[] = [];
  const GOLD = 2.39996;
  for (let i = 0; i < 7; i++) {
    const r = 0.25 + 0.6 * Math.sqrt((i + 0.5) / 7);
    leaves.push({
      geo: new THREE.IcosahedronGeometry(0.3, 0),
      color: i % 2 ? "#ffffff" : "#d8e8cc",
      pos: [Math.cos(i * GOLD) * r, 0.06, Math.sin(i * GOLD) * r],
      scale: [1, 0.35, 0.8],
      rot: [0, i * 1.3, 0],
    });
  }
  for (let i = 0; i < 12; i++) {
    const r = 0.12 + 0.72 * Math.sqrt((i + 0.5) / 12);
    const x = Math.cos(i * GOLD + 0.7) * r;
    const z = Math.sin(i * GOLD + 0.7) * r;
    const h = 0.2 + ((i * 7) % 5) * 0.035;
    leaves.push({ geo: cyl(0.014, 0.018, h, 3), color: "#ffffff", pos: [x, h / 2, z] });
    blooms.push({
      geo: new THREE.OctahedronGeometry(0.075, 0),
      color: i % 3 === 0 ? "#d9d9d9" : "#ffffff",
      pos: [x, h + 0.03, z],
      scale: [1.15, 0.6, 1.15],
      rot: [0, i, 0],
    });
    // gelbe Mitte nur bei jeder zweiten Blüte (wird mit der Blütenfarbe gemischt, bleibt hell)
    if (i % 2 === 0)
      blooms.push({
        geo: new THREE.OctahedronGeometry(0.03, 0),
        color: "#fff6c8",
        pos: [x, h + 0.07, z],
      });
  }
  return { leaves: mergeParts(leaves), blooms: mergeParts(blooms) };
}

/**
 * Natur aus der Welt (Nadel-, Laub-, Blüten- und Obstbäume, Büsche, Steine, Blumeninseln) als Instanzen.
 * Positionen stammen aus dem Generator und überlappen nichts.
 */
export function Nature({ world }: { world: World }) {
  const { trees, bushes, rocks, flowers } = world.vegetation;
  const needles = useMemo(() => trees.filter((t) => t.kind === "nadel"), [trees]);
  const leafy = useMemo(
    () => trees.filter((t) => t.kind !== "nadel" && t.kind !== "weide"),
    [trees],
  );
  const trunks = useMemo(
    () => trees.filter((t) => t.kind !== "weide").map((t) => ({ ...t, color: TRUNK })),
    [trees],
  );
  // Trauerweiden (v2): eigenes Modell mit Stamm; die Instanzfarbe tönt das Laub nur leicht
  const willows = useMemo(
    () =>
      trees
        .filter((t) => t.kind === "weide")
        .map((t) => ({ ...t, color: "#" + color.set(t.color).lerp(WHITE, 0.6).getHexString() })),
    [trees],
  );
  const willowRef = useRef<THREE.InstancedMesh>(null);
  const willowGeo = useMemo(() => {
    const parts = willowParts();
    const g = mergeParts(parts);
    parts.forEach((p) => p.geo.dispose());
    return g;
  }, []);
  useEffect(() => () => willowGeo.dispose(), [willowGeo]);
  useInstances(willowRef, willows, placeWillow);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const needleLow = useRef<THREE.InstancedMesh>(null);
  const needleHigh = useRef<THREE.InstancedMesh>(null);
  const leafLow = useRef<THREE.InstancedMesh>(null);
  const leafHigh = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const flowerLeafRef = useRef<THREE.InstancedMesh>(null);
  const flowerGeo = useMemo(() => flowerGeometries(), []);
  useEffect(
    () => () => {
      flowerGeo.leaves.dispose();
      flowerGeo.blooms.dispose();
    },
    [flowerGeo],
  );
  const leafColor = world.map.palette.bushes[0];
  const flowerLeaves = useMemo(
    () => flowers.map((f) => ({ ...f, color: leafColor })),
    [flowers, leafColor],
  );

  useInstances(trunkRef, trunks, placeTrunk);
  useInstances(needleLow, needles, placeNeedleLow);
  useInstances(needleHigh, needles, placeNeedleHigh);
  useInstances(leafLow, leafy, placeLeafLow);
  useInstances(leafHigh, leafy, placeLeafHigh);
  useInstances(bushRef, bushes, placeBush);
  useInstances(rockRef, rocks, placeRock);
  useInstances(flowerRef, flowers, placeFlower);
  useInstances(flowerLeafRef, flowerLeaves, placeFlower);

  const mat = <meshStandardMaterial color="#ffffff" roughness={0.85} />;
  const inst = (
    ref: React.RefObject<THREE.InstancedMesh | null>,
    n: number,
    key: string,
    geo: React.ReactNode,
    shadow = true,
  ) =>
    n > 0 && (
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, n]}
        key={`${key}${n}`}
        castShadow={shadow}
      >
        {geo}
        {mat}
      </instancedMesh>
    );
  return (
    <group>
      {inst(trunkRef, trunks.length, "t", <cylinderGeometry args={[0.12, 0.2, 1.1, 8]} />)}
      {inst(needleLow, needles.length, "nl", <coneGeometry args={[0.95, 1.5, 9]} />)}
      {inst(needleHigh, needles.length, "nh", <coneGeometry args={[0.68, 1.3, 9]} />)}
      {inst(leafLow, leafy.length, "ll", <icosahedronGeometry args={[1.05, 1]} />)}
      {inst(leafHigh, leafy.length, "lh", <icosahedronGeometry args={[1.0, 1]} />)}
      {inst(bushRef, bushes.length, "b", <icosahedronGeometry args={[0.8, 1]} />)}
      {inst(rockRef, rocks.length, "r", <dodecahedronGeometry args={[1, 0]} />)}
      {willows.length > 0 && (
        <instancedMesh
          ref={willowRef}
          args={[willowGeo, undefined, willows.length]}
          key={`w${willows.length}`}
          castShadow
        >
          <meshStandardMaterial vertexColors roughness={0.85} />
        </instancedMesh>
      )}
      {flowers.length > 0 && (
        <>
          <instancedMesh
            ref={flowerLeafRef}
            args={[flowerGeo.leaves, undefined, flowers.length]}
            key={`fl${flowers.length}`}
          >
            <meshStandardMaterial vertexColors roughness={0.9} />
          </instancedMesh>
          <instancedMesh
            ref={flowerRef}
            args={[flowerGeo.blooms, undefined, flowers.length]}
            key={`fb${flowers.length}`}
          >
            <meshStandardMaterial vertexColors roughness={0.7} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}

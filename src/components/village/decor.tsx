"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ZENTRALE_FOOTPRINT, type VillageLayout } from "@/lib/layout";
import { seededRandom } from "./colors";

const dummy = new THREE.Object3D();

/** Boden und Dorfplatz. */
export function Ground({ extent }: { extent: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[extent + 14, 48]} />
        <meshStandardMaterial color="#8bc17a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[ZENTRALE_FOOTPRINT + 3.2, 40]} />
        <meshStandardMaterial color="#d9cfae" />
      </mesh>
    </group>
  );
}

/** Wege von der Zentrale zu jedem Haus – eine einzige InstancedMesh. */
export function Paths({ layout }: { layout: VillageLayout }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const paths = layout.paths;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    paths.forEach((p, i) => {
      const len = Math.hypot(p.x, p.z);
      dummy.position.set(p.x / 2, 0.02, p.z / 2);
      dummy.rotation.set(0, Math.atan2(p.x, p.z), 0);
      dummy.scale.set(1.4, 1, len);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [paths]);

  if (paths.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, paths.length]} key={paths.length}>
      <boxGeometry args={[1, 0.03, 1]} />
      <meshStandardMaterial color="#d9cfae" />
    </instancedMesh>
  );
}

function distToSegment(px: number, pz: number, bx: number, bz: number) {
  // Strecke von (0,0) nach (bx,bz)
  const l2 = bx * bx + bz * bz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + pz * bz) / l2));
  return Math.hypot(px - t * bx, pz - t * bz);
}

/** Bäume als Instanzen (Stamm + Krone). Positionen sind aus der Dorf-ID abgeleitet, also stabil. */
export function Trees({
  layout,
  seed,
  count,
}: {
  layout: VillageLayout;
  seed: string;
  count: number;
}) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => {
    const rnd = seededRandom(seed);
    const houses = Object.values(layout.houses);
    const out: { x: number; z: number; s: number }[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 40) {
      const r = 7 + rnd() * (layout.extent + 8);
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const blocked =
        houses.some((h) => Math.hypot(h.x - x, h.z - z) < h.footprint * 2 + 5) ||
        layout.paths.some((p) => distToSegment(x, z, p.x, p.z) < 3);
      if (!blocked) out.push({ x, z, s: 0.8 + rnd() * 0.7 });
    }
    return out;
  }, [layout, seed, count]);

  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return;
    trees.forEach((t, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(t.x, 0.5 * t.s, t.z);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.updateMatrix();
      trunks.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, 1.6 * t.s, t.z);
      dummy.updateMatrix();
      crowns.current!.setMatrixAt(i, dummy.matrix);
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  if (trees.length === 0) return null;
  return (
    <group>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, trees.length]}
        key={`t${trees.length}`}
      >
        <cylinderGeometry args={[0.12, 0.18, 1, 6]} />
        <meshStandardMaterial color="#6b4423" />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, trees.length]}
        key={`c${trees.length}`}
      >
        <coneGeometry args={[0.7, 1.7, 7]} />
        <meshStandardMaterial color="#3f8f4f" />
      </instancedMesh>
    </group>
  );
}

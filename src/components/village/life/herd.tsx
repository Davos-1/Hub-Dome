"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeParts, type Part } from "../geo";

const dummy = new THREE.Object3D();
/** Startzeit, damit eingefrorene Szenen (reduzierte Bewegung) eine verteilte Anordnung zeigen. */
export const T0 = 12;

export type Step = (i: number, t: number, out: THREE.Object3D) => void;

/** Geometrie aus Bauteilen; wird beim Entfernen der Komponente freigegeben. */
export function useMerged(build: () => Part[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => mergeParts(build()), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * Viele gleiche Figuren (Schafe, Hühner, Vögel …) als eine InstancedMesh. `step` berechnet Position und
 * Ausrichtung jeder Instanz **aus der Zeit** (kein Zustand) – so bleibt die Szene deterministisch und
 * läuft bei eingefrorener Zeit einfach still.
 */
export function Herd({
  geometry,
  count,
  step,
  frozen,
  shadows = true,
}: {
  geometry: THREE.BufferGeometry;
  count: number;
  step: Step;
  frozen: boolean;
  shadows?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const update = useCallback(
    (t: number) => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        step(i, t, dummy);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    [count, step],
  );

  useLayoutEffect(() => update(T0), [update]);
  useFrame(({ clock }) => {
    if (!frozen) update(T0 + clock.elapsedTime);
  });

  if (count <= 0) return null;
  return (
    <instancedMesh
      ref={ref}
      key={count}
      args={[geometry, undefined, count]}
      castShadow={shadows}
      frustumCulled={false}
    >
      <meshStandardMaterial vertexColors roughness={0.9} />
    </instancedMesh>
  );
}

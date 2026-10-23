"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "../colors";
import { T0 } from "./herd";

type Spot = { x: number; z: number };

/**
 * Glühwürmchen am Abend und in der Nacht: kleine Lichtpunkte, die über Blumeninseln und am Wasser
 * schweben. Bahnen hängen nur von der Zeit ab; bei reduzierter Bewegung stehen sie still.
 */
export function Fireflies({
  spots,
  count,
  frozen,
}: {
  spots: Spot[];
  count: number;
  frozen: boolean;
}) {
  const flies = useMemo(() => {
    const r = seededRandom("gluehwuermchen");
    return Array.from({ length: spots.length ? count : 0 }, (_, i) => {
      const s = spots[Math.floor(r() * spots.length)];
      return {
        x: s.x + (r() - 0.5) * 3,
        z: s.z + (r() - 0.5) * 3,
        y: 0.5 + r() * 0.9,
        rad: 0.4 + r() * 0.8,
        speed: 0.25 + r() * 0.35,
        phase: r() * Math.PI * 2,
        i,
      };
    });
  }, [spots, count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flies.length * 3), 3));
    return g;
  }, [flies.length]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useRef<THREE.PointsMaterial>(null);

  const update = (t: number) => {
    const a = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (const f of flies) {
      const k = t * f.speed + f.phase;
      a.setXYZ(
        f.i,
        f.x + Math.cos(k) * f.rad,
        f.y + Math.sin(k * 1.7) * 0.25,
        f.z + Math.sin(k * 0.8) * f.rad,
      );
    }
    a.needsUpdate = true;
    // sanftes Pulsieren der Helligkeit
    if (material.current) material.current.opacity = 0.75 + 0.25 * Math.sin(t * 2.1);
  };
  useEffect(() => update(T0));
  useFrame(({ clock }) => {
    if (!frozen) update(T0 + clock.elapsedTime);
  });

  if (flies.length === 0) return null;
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        color="#fff3a0"
        size={0.16}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

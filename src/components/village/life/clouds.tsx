"use client";

import { useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sphere, type Part } from "../geo";
import { Herd, useMerged } from "./herd";

function cloudParts(): Part[] {
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 3],
    [3, -0.4, 0.4, 2.4],
    [-3, -0.3, -0.3, 2.5],
    [1.4, 0.9, -0.4, 2.2],
    [-1.3, 0.8, 0.5, 2.1],
  ];
  return puffs.map(([x, y, z, r]) => ({
    geo: sphere(r, 10),
    color: "#ffffff",
    pos: [x, y, z],
    scale: [1, 0.62, 0.9],
  }));
}

/**
 * Wolken ziehen langsam über das Dorf und treten am anderen Rand wieder ein. Eine Wolke, die von der
 * Kamera aus gesehen vor dem Dorf stünde, schrumpft weg (nichts verdeckt Häuser oder Beschriftungen).
 */
export function Clouds({
  extent,
  count,
  frozen,
}: {
  extent: number;
  count: number;
  frozen: boolean;
}) {
  const geometry = useMerged(cloudParts);
  const camera = useThree((s) => s.camera);
  const span = extent * 2 + 90;
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const speed = 0.35 + (i % 3) * 0.12;
      const x0 = (((i * 37) % 100) / 100) * span - span / 2;
      let x = x0 + t * speed;
      x = ((((x + span / 2) % span) + span) % span) - span / 2;
      const z = (((i * 53) % 100) / 100 - 0.5) * span * 0.8;
      const y = 30 + (i % 4) * 4;
      o.position.set(x, y, z);
      // Wo träfe der Blick durch die Wolke auf den Boden? Liegt das im Dorf, wird die Wolke kleiner.
      const c = camera.position;
      let k = 1;
      if (c.y > y + 1) {
        const f = c.y / (c.y - y);
        const gx = c.x + (x - c.x) * f;
        const gz = c.z + (z - c.z) * f;
        const d = Math.hypot(gx, gz);
        k = Math.min(1, Math.max(0, (d - (extent + 6)) / 24));
      }
      const s = (0.8 + (i % 3) * 0.3) * k;
      o.scale.set(s, s, s);
    },
    [span, extent, camera],
  );
  return (
    <Herd
      geometry={geometry}
      count={count}
      step={step}
      frozen={frozen}
      shadows={false}
      followCamera
    />
  );
}

"use client";

import { useCallback } from "react";
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

/** Wolken ziehen langsam über das Dorf und treten am anderen Rand wieder ein. */
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
  const span = extent * 2 + 90;
  const step = useCallback(
    (i: number, t: number, o: THREE.Object3D) => {
      const speed = 0.35 + (i % 3) * 0.12;
      const x0 = (((i * 37) % 100) / 100) * span - span / 2;
      let x = x0 + t * speed;
      x = ((((x + span / 2) % span) + span) % span) - span / 2;
      const z = (((i * 53) % 100) / 100 - 0.5) * span * 0.8;
      o.position.set(x, 30 + (i % 4) * 4, z);
      const s = 0.8 + (i % 3) * 0.3;
      o.scale.set(s, s, s);
    },
    [span],
  );
  return <Herd geometry={geometry} count={count} step={step} frozen={frozen} shadows={false} />;
}

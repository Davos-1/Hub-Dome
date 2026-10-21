"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment } from "@/lib/environment";
import { box, cyl, mergeParts, rbox, sphere, type Part } from "../geo";
import { T0 } from "./herd";

const WOOD = "#8a5a2b";

/** Zaun, Heuballen und Futtertrog der Weide (lokale Koordinaten, Mitte im Ursprung). */
function pastureParts(w: number, d: number): Part[] {
  const parts: Part[] = [];
  const hw = w / 2;
  const hd = d / 2;
  const post = (x: number, z: number) =>
    parts.push({ geo: cyl(0.06, 0.07, 1.0, 6), color: WOOD, pos: [x, 0.5, z] });
  const rail = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    for (const y of [0.4, 0.78]) {
      parts.push({
        geo: box(len, 0.06, 0.05),
        color: "#a67c52",
        pos: [(x1 + x2) / 2, y, (z1 + z2) / 2],
        rot: [0, -Math.atan2(z2 - z1, x2 - x1), 0],
      });
    }
  };
  const gap = 1.6; // Tor an der Seite zur Zentrale (+z lokal)
  // Seiten: vorn mit Lücke
  const sides: [number, number, number, number][] = [
    [-hw, -hd, hw, -hd],
    [hw, -hd, hw, hd],
    [-hw, hd, -gap / 2, hd],
    [gap / 2, hd, hw, hd],
    [-hw, -hd, -hw, hd],
  ];
  for (const [x1, z1, x2, z2] of sides) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i <= n; i++) post(x1 + ((x2 - x1) * i) / n, z1 + ((z2 - z1) * i) / n);
    rail(x1, z1, x2, z2);
  }
  // Heuballen und Trog
  for (const [x, z] of [
    [-hw + 1.1, -hd + 1.0],
    [-hw + 2.3, -hd + 1.0],
    [-hw + 1.7, -hd + 1.0],
  ]) {
    parts.push({
      geo: cyl(0.45, 0.45, 0.9, 12),
      color: "#d9b44a",
      pos: [x, 0.45 + (x === -hw + 1.7 ? 0.7 : 0), z],
      rot: [0, 0, Math.PI / 2],
    });
  }
  parts.push({
    geo: rbox(1.4, 0.25, 0.4, 0.04),
    color: "#7a5230",
    pos: [hw - 1.6, 0.18, -hd + 0.9],
  });
  parts.push({
    geo: rbox(1.25, 0.08, 0.3, 0.02),
    color: "#7ec8e3",
    pos: [hw - 1.6, 0.3, -hd + 0.9],
  });
  // Grasfläche (helleres Grün)
  parts.push({ geo: rbox(w - 0.2, 0.02, d - 0.2, 0.01), color: "#93cf78", pos: [0, 0.01, 0] });
  return parts;
}

/** Weide mit Zaun, Heu und Trog; die Schafe laufen innerhalb. */
export function Pasture({ env }: { env: Environment }) {
  const { x, z, w, d, angle } = env.pasture;
  const geometry = useMemo(() => mergeParts(pastureParts(w, d)), [w, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
    </group>
  );
}

function windmillBody(): Part[] {
  const parts: Part[] = [];
  parts.push({ geo: cyl(1.55, 1.75, 0.5, 14), color: "#a8a29e", pos: [0, 0.25, 0] });
  parts.push({ geo: cyl(0.95, 1.5, 4.6, 14), color: "#f1ece0", pos: [0, 2.8, 0] });
  for (const y of [1.4, 3.2])
    parts.push({
      geo: cyl(1.5 - (y - 1.4) * 0.14, 1.52 - (y - 1.4) * 0.14, 0.12, 14),
      color: "#c9bfa5",
      pos: [0, y, 0],
    });
  parts.push({ geo: new THREE.ConeGeometry(1.2, 1.4, 14), color: "#8a4b36", pos: [0, 6.0, 0] });
  parts.push({ geo: rbox(0.8, 1.2, 0.12, 0.03), color: "#5b3a26", pos: [0, 1.1, 1.55] });
  parts.push({ geo: box(0.9, 0.9, 0.5), color: "#ffe2a0", pos: [0, 3.4, 1.15] });
  parts.push({
    geo: cyl(0.26, 0.26, 0.5, 10),
    color: "#4b5563",
    pos: [0, 5.3, 1.1],
    rot: [Math.PI / 2, 0, 0],
  });
  parts.push({ geo: sphere(0.3, 10), color: "#4b5563", pos: [0, 5.3, 1.45] });
  return parts;
}

/** Windmühle am Dorfrand; die Flügel drehen sich langsam. */
export function Windmill({ env, frozen }: { env: Environment; frozen: boolean }) {
  const { x, z, angle } = env.windmill;
  const body = useMemo(() => mergeParts(windmillBody()), []);
  const blades = useMemo(() => {
    const parts: Part[] = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      // Arm
      parts.push({
        geo: box(0.14, 3.8, 0.1),
        color: "#6b4a2e",
        pos: [-Math.sin(a) * 1.9, Math.cos(a) * 1.9, 0],
        rot: [0, 0, a],
      });
      // Segeltuch (seitlich versetzt)
      for (let j = 0; j < 3; j++) {
        const r = 1.0 + j * 0.85;
        parts.push({
          geo: box(0.55, 0.7, 0.04),
          color: "#f5efe0",
          pos: [-Math.sin(a) * r + Math.cos(a) * 0.38, Math.cos(a) * r + Math.sin(a) * 0.38, 0.02],
          rot: [0, 0, a],
        });
      }
    }
    return mergeParts(parts);
  }, []);
  useEffect(() => () => body.dispose(), [body]);
  useEffect(() => () => blades.dispose(), [blades]);
  const hub = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (hub.current && !frozen) hub.current.rotation.z = -(T0 + clock.elapsedTime) * 0.5;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      <group ref={hub} position={[0, 5.3, 1.65]}>
        <mesh geometry={blades} castShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

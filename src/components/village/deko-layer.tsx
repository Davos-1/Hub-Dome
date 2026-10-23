"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DekoItem } from "@/lib/world/doc";
import { dekoShape } from "@/lib/world/rules";
import { corners } from "@/lib/world/geom";
import { heightAt, type WorldMap } from "@/lib/world/map";
import { dekoParts } from "./deko-models";
import { mergeParts, type Part } from "./geo";

/** Bodenhöhe unter einem Element: tiefster Punkt der Grundfläche (so schwebt nichts am Hang). */
export function dekoGroundY(map: WorldMap, item: DekoItem): number {
  if (item.typ === "steg") return 0;
  const s = dekoShape(item);
  const pts =
    s.kind === "circle"
      ? [
          { x: s.x, z: s.z },
          { x: s.x + s.r, z: s.z },
          { x: s.x - s.r, z: s.z },
          { x: s.x, z: s.z + s.r },
          { x: s.x, z: s.z - s.r },
        ]
      : [{ x: s.x, z: s.z }, ...corners(s)];
  return Math.min(...pts.map((p) => heightAt(map, p.x, p.z)));
}

/** Alle Teile eines Elements in Weltkoordinaten (Drehung um y, dann verschieben). */
export function dekoWorldGeometry(map: WorldMap, items: DekoItem[]) {
  const body: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  for (const it of items) {
    const parts = dekoParts(it.typ, map.palette);
    m.makeRotationY((it.r * Math.PI) / 180).setPosition(it.x, dekoGroundY(map, it), it.z);
    const add = (list: Part[], out: THREE.BufferGeometry[]) => {
      if (!list.length) return;
      const g = mergeParts(list);
      list.forEach((p) => p.geo.dispose());
      g.applyMatrix4(m);
      out.push(g);
    };
    add(parts.body, body);
    add(parts.glow, glow);
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    if (!list.length) return null;
    const g = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    g.computeBoundingSphere();
    return g;
  };
  return { body: merge(body), glow: merge(glow) };
}

/**
 * Eigene Deko des Besitzers (Bänke, Bäume, Steg …) als zwei Meshes: Körper mit Vertex-Farben und
 * Leuchtteile (Laternen, Glut). Nur gültige Elemente kommen hier an (der Generator prüft sie).
 */
export function DekoLayer({
  map,
  items,
  glow,
}: {
  map: WorldMap;
  items: DekoItem[];
  glow: number;
}) {
  const geo = useMemo(() => dekoWorldGeometry(map, items), [map, items]);
  useEffect(
    () => () => {
      geo.body?.dispose();
      geo.glow?.dispose();
    },
    [geo],
  );
  return (
    <group>
      {geo.body && (
        <mesh geometry={geo.body} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      )}
      {geo.glow && (
        <mesh geometry={geo.glow}>
          <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={glow} />
        </mesh>
      )}
    </group>
  );
}

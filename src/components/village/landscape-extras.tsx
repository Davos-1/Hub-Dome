"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { heightAt, type Rock, type WorldMap } from "@/lib/world/map";
import type { SeedObjekt } from "@/lib/world/seed-objects";
import { mergeParts, type Part } from "./geo";
import { seedObjectParts } from "./seed-object-models";

/**
 * Felsen der Landschaft (Generator v2): je Fels eine Gruppe aus drei bis fünf kantigen Blöcken, auf dem
 * Gelände abgesetzt (der tiefste Punkt der Grundfläche, damit nichts schwebt). Alle Felsen in einer Geometrie.
 */
export function RockOutcrops({ rocks, map }: { rocks: Rock[]; map: WorldMap }) {
  const geometry = useMemo(() => {
    if (rocks.length === 0) return null;
    const parts: Part[] = [];
    const tones = map.palette.rocks;
    rocks.forEach((k, i) => {
      const r = seededRandom(`fels-${map.seed}-${i}`);
      // Tiefster Punkt unter dem Fels: Blöcke stecken etwas im Boden statt zu schweben
      let y = Infinity;
      for (let a = 0; a < 8; a++)
        y = Math.min(y, heightAt(map, k.x + Math.cos(a) * k.r, k.z + Math.sin(a) * k.r));
      y = Math.min(y, heightAt(map, k.x, k.z));
      const n = 3 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const big = j === 0;
        const s = big ? k.r * 0.62 : k.r * (0.22 + r() * 0.24);
        const a = r() * Math.PI * 2;
        const d = big ? 0 : k.r * (0.35 + r() * 0.4);
        const h = big ? k.h : s * (0.8 + r() * 0.6);
        parts.push({
          geo: new THREE.DodecahedronGeometry(1, 0),
          color: tones[(i + j) % tones.length],
          pos: [k.x + Math.cos(a) * d, y + h * 0.42 - 0.15, k.z + Math.sin(a) * d],
          rot: [r() * 0.5, r() * Math.PI * 2, r() * 0.5],
          scale: [s * (1 + r() * 0.3), h * 0.55, s * (0.9 + r() * 0.3)],
        });
      }
      // Moos auf dem grössten Block
      parts.push({
        geo: new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2.4),
        color: map.palette.bushes[i % map.palette.bushes.length],
        pos: [k.x, y + k.h * 0.42 + k.h * 0.36 - 0.15, k.z],
        scale: [k.r * 0.38, k.h * 0.14, k.r * 0.34],
      });
    });
    const g = mergeParts(parts);
    parts.forEach((p) => p.geo.dispose());
    return g;
  }, [rocks, map]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} flatShading />
    </mesh>
  );
}

/**
 * Seed-Objekte der Landschaft (v2): alle Modelle in zwei Geometrien (Körper und Leuchtteile). Sie stehen in der
 * flachen Zone (Boden bei y = 0); Fähre und Wehr bekommen Länge und Wasserbreite ihrer Stelle.
 */
export function SeedObjects({
  objects,
  map,
  glow,
}: {
  objects: SeedObjekt[];
  map: WorldMap;
  glow: number;
}) {
  const geos = useMemo(() => {
    if (objects.length === 0) return null;
    const body: THREE.BufferGeometry[] = [];
    const light: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    for (const o of objects) {
      const parts = seedObjectParts(o.typ, map.palette, { hd: o.hd, water: o.water });
      const place = (list: Part[], out: THREE.BufferGeometry[]) => {
        if (!list.length) return;
        const g = mergeParts(list);
        g.applyMatrix4(m.makeRotationY(o.angle).setPosition(o.x, 0, o.z));
        out.push(g);
      };
      place(parts.body, body);
      place(parts.glow, light);
      [...parts.body, ...parts.glow].forEach((p) => p.geo.dispose());
    }
    const merge = (list: THREE.BufferGeometry[]) => {
      if (!list.length) return null;
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      return g;
    };
    return { body: merge(body), glow: merge(light) };
  }, [objects, map.palette]);
  useEffect(
    () => () => {
      geos?.body?.dispose();
      geos?.glow?.dispose();
    },
    [geos],
  );
  if (!geos) return null;
  return (
    <group>
      {geos.body && (
        <mesh geometry={geos.body} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      )}
      {geos.glow && (
        <mesh geometry={geos.glow}>
          <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={glow} />
        </mesh>
      )}
    </group>
  );
}

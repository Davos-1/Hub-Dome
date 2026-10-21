import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ZENTRALE_FOOTPRINT } from "@/lib/layout";
import type { VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "./colors";
import { placed } from "./garden-geometry";
import { box, mergeParts, type Part } from "./geo";
import { darken } from "./models/common";

/** Kartenansicht: Grundrisse, Objekt-Quadrate und Grundstückskanten als eine Geometrie (Weltkoordinaten). */
export function buildMapGeometry(model: VillageModel): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  const push = (parts: Part[], l: { x: number; z: number; angle: number }) => {
    const g = mergeParts(parts);
    parts.forEach((p) => p.geo.dispose());
    geos.push(placed(g, l));
  };

  for (const h of model.houses) {
    const l = model.layout.houses[h.id];
    if (!l) continue;
    if (h.kind === "zentrale") {
      push(
        [
          {
            geo: box(ZENTRALE_FOOTPRINT * 2.6, 0.06, ZENTRALE_FOOTPRINT * 1.7),
            color: "#efe6d4",
            pos: [0, 0.05, 0],
          },
        ],
        l,
      );
      continue;
    }
    const fp = l.footprint;
    const pl = l.plot!;
    const parts: Part[] = [];
    const w = l.tier === 3 ? fp * 3.15 : fp * 2;
    parts.push({
      geo: box(w, 0.08, fp * 2.1),
      color: h.items.length ? darken(h.style.accent, 0.8) : "#e8c98f",
      pos: [l.tier === 3 ? fp * 0.575 : 0, 0.06, 0],
    });
    for (const s of pl.slots) {
      parts.push({ geo: box(0.6, 0.05, 0.6), color: KIND_COLORS[s.kind], pos: [s.x, 0.06, s.z] });
    }
    const frame: [number, number, number, number][] = [
      [pl.hw * 2, 0.15, 0, -pl.back],
      [pl.hw * 2, 0.15, 0, pl.front],
      [0.15, pl.front + pl.back, -pl.hw, (pl.front - pl.back) / 2],
      [0.15, pl.front + pl.back, pl.hw, (pl.front - pl.back) / 2],
    ];
    for (const [fw, fd, x, z] of frame) {
      parts.push({ geo: box(fw, 0.04, fd), color: "#3f7d42", pos: [x, 0.03, z] });
    }
    push(parts, l);
  }
  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

import * as THREE from "three";
import type { PlotSlot } from "@/lib/layout";
import type { ZentraleStyle } from "@/lib/styles";
import type { ArtifactKind } from "@/lib/types";
import { KIND_COLORS } from "./colors";
import { box, cyl, mergeAll, mergeParts, sphere, type Part } from "./geo";
import { darken, STONE, WHITE, WOOD } from "./models/common";
import { markerParts, objectParts } from "./object-models";

const WATER = "#5ea8d6";
const MARBLE = "#ece7dc";

/**
 * Ein Objekt der Zentrale in der Form, die zum Stil passt (lokal, Front = +z, Boden = 0).
 * Die Kategoriefarbe bleibt sichtbar: Segel, Fahne, Panel-Rahmen oder Sockelband.
 */
function styledParts(style: ZentraleStyle, kind: ArtifactKind, index: number): Part[] {
  const k = KIND_COLORS[kind];
  const out: Part[] = [];
  const add = (
    geo: THREE.BufferGeometry,
    color: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number],
  ) => out.push({ geo, color, pos, rot, scale });

  switch (style) {
    case "leuchtturm": {
      // Bötli mit Segel in der Kategoriefarbe
      add(
        new THREE.CapsuleGeometry(0.13, 0.5, 4, 8),
        "#f8f5ef",
        [0, 0.1, 0],
        [Math.PI / 2, 0, 0],
        [1.2, 1, 0.75],
      );
      add(box(0.2, 0.03, 0.5), WOOD, [0, 0.19, 0]);
      add(cyl(0.018, 0.018, 0.8, 5), WOOD, [0, 0.58, -0.05]);
      add(
        new THREE.ConeGeometry(0.26, 0.6, 3),
        k,
        [0, 0.62, 0.08],
        [0, Math.PI / 2, 0],
        [0.12, 1, 1],
      );
      break;
    }
    case "villa":
      if (index % 2 === 0) {
        // Golffähnchen auf einem runden Grün
        add(cyl(0.42, 0.44, 0.04, 18), "#6fb35a", [0, 0.02, 0]);
        add(cyl(0.05, 0.05, 0.045, 10), "#2b2b2b", [0, 0.025, 0]);
        add(cyl(0.012, 0.012, 0.95, 5), WHITE, [0, 0.5, 0]);
        add(box(0.3, 0.18, 0.012), k, [0.15, 0.88, 0]);
        add(sphere(0.035, 8), WHITE, [0.18, 0.06, 0.15]);
      } else {
        // Zierstatue auf Sockel mit Band in der Kategoriefarbe
        add(box(0.36, 0.32, 0.36), STONE, [0, 0.16, 0]);
        add(box(0.38, 0.06, 0.38), k, [0, 0.29, 0]);
        add(cyl(0.08, 0.13, 0.5, 10), MARBLE, [0, 0.57, 0]);
        add(sphere(0.09, 12), MARBLE, [0, 0.9, 0]);
        add(cyl(0.03, 0.03, 0.3, 6), MARBLE, [0.12, 0.72, 0], [0, 0, -0.7]);
      }
      break;
    case "marskuppel":
      // Solarpanel auf Stelze, Rahmen in der Kategoriefarbe
      add(cyl(0.035, 0.045, 0.45, 6), "#9ca3af", [0, 0.22, 0]);
      add(box(0.64, 0.03, 0.46), k, [0, 0.47, 0], [0.55, 0, 0]);
      add(box(0.58, 0.035, 0.4), "#1e3a8a", [0, 0.48, 0.008], [0.55, 0, 0]);
      for (const x of [-0.145, 0.145])
        add(box(0.012, 0.04, 0.4), "#93c5fd", [x, 0.49, 0.01], [0.55, 0, 0]);
      add(cyl(0.18, 0.2, 0.04, 10), "#b45f3c", [0, 0.02, 0]);
      break;
    case "rathaus":
      // Fahnenmast mit Fahne in der Kategoriefarbe
      add(cyl(0.16, 0.2, 0.14, 10), STONE, [0, 0.07, 0]);
      add(cyl(0.02, 0.025, 1.4, 6), "#d1d5db", [0, 0.8, 0]);
      add(sphere(0.04, 8), "#facc15", [0, 1.52, 0]);
      add(box(0.36, 0.24, 0.015), k, [0.19, 1.3, 0]);
      break;
    case "hochhaus":
      // Würfelskulptur auf Sockel
      add(box(0.4, 0.2, 0.4), "#4b5563", [0, 0.1, 0]);
      add(box(0.36, 0.36, 0.36), k, [0, 0.5, 0], [Math.PI / 4, 0, Math.atan(Math.SQRT1_2)]);
      add(box(0.42, 0.02, 0.42), darken(k, 0.7), [0, 0.21, 0]);
      break;
    default:
      // Schule: die üblichen Objektformen im Pausenhof
      return objectParts(kind, 0, 0, false, false);
  }
  return out;
}

/**
 * Alle Objekte der Zentrale als eine Geometrie (lokal zur Zentrale, Boden = Terrasse).
 * Beim Leuchtturm liegt unter den Booten ein Wasserring.
 */
export function zentraleRingGeometry(
  style: ZentraleStyle,
  ring: PlotSlot[],
  info: Map<string, { isNew: boolean; isCopy: boolean }>,
): THREE.BufferGeometry | null {
  if (ring.length === 0) return null;
  const geos: THREE.BufferGeometry[] = [];

  if (style === "leuchtturm") {
    const rows = new Map<number, number>();
    for (const s of ring) rows.set(s.row, Math.hypot(s.x, s.z));
    const water: Part[] = [];
    for (const r of rows.values()) {
      water.push(
        {
          geo: new THREE.RingGeometry(r - 0.55, r + 0.55, 64),
          color: WATER,
          pos: [0, 0.012, 0],
          rot: [-Math.PI / 2, 0, 0],
        },
        {
          geo: new THREE.TorusGeometry(r - 0.58, 0.05, 4, 64),
          color: STONE,
          pos: [0, 0.02, 0],
          rot: [-Math.PI / 2, 0, 0],
        },
        {
          geo: new THREE.TorusGeometry(r + 0.58, 0.05, 4, 64),
          color: STONE,
          pos: [0, 0.02, 0],
          rot: [-Math.PI / 2, 0, 0],
        },
      );
    }
    geos.push(mergeParts(water));
  }

  ring.forEach((s, i) => {
    const o = info.get(s.id);
    const parts = [
      ...styledParts(style, s.kind, i),
      ...markerParts(0, 0, o?.isNew ?? false, o?.isCopy ?? false),
    ];
    const g = mergeParts(parts);
    // Front (+z) zeigt von der Zentrale weg
    g.rotateY(Math.atan2(s.x, s.z));
    g.translate(s.x, 0, s.z);
    geos.push(g);
  });

  return mergeAll(geos);
}

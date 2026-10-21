import * as THREE from "three";
import type { ArtifactKind } from "@/lib/types";
import { KIND_COLORS } from "./colors";
import { box, cyl, type Part } from "./geo";
import { darken, STONE, WOOD } from "./models/common";

/**
 * Objektformen nach Kategorie: Rechner = Pult, Quiz = Tafel, Zusammenfassung = Buch, Cheatsheet = Blatt,
 * Tool = Werkzeugkiste, Visualisierung = Staffelei, Sonstiges = Tafel auf Sockel. Neue Objekte tragen
 * ein gelbes Fähnchen. Positionen sind lokal zum Haus (x, z = Platz im Grundstück).
 */
export function objectParts(kind: ArtifactKind, x: number, z: number, isNew: boolean): Part[] {
  const k = KIND_COLORS[kind];
  const out: Part[] = [];
  const add = (
    geo: THREE.BufferGeometry,
    color: string,
    px: number,
    py: number,
    pz: number,
    rot?: [number, number, number],
  ) => out.push({ geo, color, pos: [x + px, py, z + pz], rot });

  switch (kind) {
    case "rechner":
      add(cyl(0.05, 0.07, 0.8, 8), "#4b4f55", 0, 0.4, 0);
      add(box(0.34, 0.04, 0.26), "#4b4f55", 0, 0.8, 0);
      add(box(0.56, 0.05, 0.42), k, 0, 0.87, 0, [0.42, 0, 0]);
      add(box(0.4, 0.02, 0.13), "#1f2937", 0, 0.92, -0.07, [0.42, 0, 0]);
      for (let i = 0; i < 3; i++)
        add(box(0.09, 0.02, 0.07), "#f8fafc", -0.12 + i * 0.12, 0.88, 0.09, [0.42, 0, 0]);
      break;
    case "quiz":
      for (const s of [-1, 1]) add(box(0.05, 1.0, 0.05), WOOD, s * 0.33, 0.5, 0);
      add(box(0.6, 0.42, 0.04), "#2f4a3c", 0, 0.74, 0);
      add(box(0.68, 0.05, 0.06), k, 0, 0.97, 0);
      add(box(0.68, 0.05, 0.06), k, 0, 0.51, 0);
      add(box(0.26, 0.025, 0.05), "#f1f5f9", -0.08, 0.8, 0.01);
      add(box(0.36, 0.025, 0.05), "#f1f5f9", 0, 0.7, 0.01);
      break;
    case "zusammenfassung":
      add(cyl(0.24, 0.28, 0.5, 10), STONE, 0, 0.25, 0);
      add(box(0.52, 0.04, 0.36), k, 0, 0.52, 0);
      add(box(0.24, 0.05, 0.32), "#fbf7ee", -0.125, 0.56, 0, [0, 0, 0.12]);
      add(box(0.24, 0.05, 0.32), "#fbf7ee", 0.125, 0.56, 0, [0, 0, -0.12]);
      break;
    case "cheatsheet":
      add(cyl(0.025, 0.03, 0.85, 6), "#3f3f46", 0, 0.42, -0.04);
      add(box(0.4, 0.52, 0.015), "#fbf7ee", 0, 0.98, 0, [-0.22, 0, 0]);
      add(box(0.4, 0.1, 0.02), k, 0, 1.18, -0.05, [-0.22, 0, 0]);
      for (let i = 0; i < 3; i++)
        add(box(0.28, 0.022, 0.02), "#b8b2a7", 0, 1.02 - i * 0.1, 0.02 + i * 0.022, [-0.22, 0, 0]);
      break;
    case "tool":
      add(box(0.6, 0.17, 0.36), "#4a3424", 0, 0.085, 0);
      add(box(0.55, 0.3, 0.32), k, 0, 0.32, 0);
      add(box(0.56, 0.03, 0.33), darken(k, 0.7), 0, 0.42, 0);
      for (const s of [-1, 1]) add(box(0.04, 0.1, 0.04), "#2b2b2b", s * 0.15, 0.52, 0);
      add(box(0.34, 0.04, 0.05), "#2b2b2b", 0, 0.58, 0);
      break;
    case "visualisierung":
      for (const s of [-1, 1])
        add(cyl(0.025, 0.025, 1.25, 6), WOOD, s * 0.22, 0.6, 0.04, [-0.08, 0, s * 0.1]);
      add(cyl(0.025, 0.025, 1.2, 6), WOOD, 0, 0.58, -0.2, [0.32, 0, 0]);
      add(box(0.54, 0.44, 0.03), "#fbf7ee", 0, 0.88, 0.06, [-0.08, 0, 0]);
      [0.12, 0.22, 0.3].forEach((hh, i) =>
        add(box(0.08, hh, 0.02), k, -0.13 + i * 0.13, 0.7 + hh / 2, 0.085, [-0.08, 0, 0]),
      );
      break;
    default:
      add(cyl(0.26, 0.3, 0.32, 10), STONE, 0, 0.2, 0);
      add(box(0.44, 0.54, 0.08), k, 0, 0.66, 0, [-0.22, 0, 0]);
  }
  if (isNew) {
    add(cyl(0.015, 0.015, 0.8, 5), "#3f3f46", 0.36, 0.9, -0.14);
    add(box(0.3, 0.18, 0.012), "#facc15", 0.51, 1.2, -0.14);
  }
  return out;
}

/** Beet unter zusammenhängenden Objekten gleicher Kategorie: Erde mit Kante in der Kategoriefarbe. */
export function bedParts(
  slots: { kind: ArtifactKind; side: -1 | 1; row: number; col: number; x: number; z: number }[],
): Part[] {
  const out: Part[] = [];
  const groups = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = `${s.side}|${s.row}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a.col - b.col);
    let run = [g[0]];
    const flush = () => {
      const xs = run.map((s) => s.x);
      const x0 = Math.min(...xs) - 0.56;
      const x1 = Math.max(...xs) + 0.56;
      const z = run[0].z;
      const w = x1 - x0;
      const cx = (x0 + x1) / 2;
      const col = KIND_COLORS[run[0].kind];
      out.push({ geo: box(w, 0.05, 1.08), color: "#7b5d45", pos: [cx, 0.025, z] });
      out.push({ geo: box(w, 0.1, 0.07), color: col, pos: [cx, 0.05, z - 0.54] });
      out.push({ geo: box(w, 0.1, 0.07), color: col, pos: [cx, 0.05, z + 0.54] });
      out.push({ geo: box(0.07, 0.1, 1.08), color: col, pos: [x0, 0.05, z] });
      out.push({ geo: box(0.07, 0.1, 1.08), color: col, pos: [x1, 0.05, z] });
    };
    for (let i = 1; i < g.length; i++) {
      if (g[i].kind === run[0].kind && g[i].col === run[run.length - 1].col + 1) run.push(g[i]);
      else {
        flush();
        run = [g[i]];
      }
    }
    flush();
  }
  return out;
}

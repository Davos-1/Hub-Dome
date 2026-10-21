import { box, cyl } from "../geo";
import { Builder, WOOD, type Model } from "./common";

/** Baustelle für Häuser ohne Objekte: Fundament, Rohbauwände, Gerüst, Absperrung, Bretterstapel. */
export function baustelleModel(fp: number): Model {
  const b = new Builder();
  const w = fp * 2;
  const d = fp * 2.1;
  b.add({ geo: box(w + 0.3, 0.2, d + 0.3), color: "#c7c1b6", pos: [0, 0.1, 0] });
  b.add({ geo: box(w, fp * 0.8, 0.2), color: "#d6c4a6", pos: [0, 0.2 + fp * 0.4, -d / 2] });
  for (const s of [-1, 1]) {
    b.add({ geo: box(0.2, fp * 0.5, d), color: "#d6c4a6", pos: [(s * w) / 2, 0.2 + fp * 0.25, 0] });
  }
  const hh = fp * 2;
  for (const x of [-1, 1]) {
    for (const z of [-1, 0, 1]) {
      b.add({
        geo: cyl(0.04, 0.04, hh, 6),
        color: "#9ca3af",
        pos: [x * (w / 2 + 0.35), hh / 2, z * (d / 2 + 0.1)],
      });
    }
  }
  for (const y of [fp * 0.9, fp * 1.6]) {
    for (const x of [-1, 1]) {
      b.add({ geo: box(0.4, 0.06, d + 0.4), color: WOOD, pos: [x * (w / 2 + 0.35), y, 0] });
    }
  }
  for (const s of [-1, 1]) {
    b.add({ geo: box(0.08, 0.6, 0.08), color: "#f8fafc", pos: [s * 0.9, 0.3, d / 2 + 0.9] });
  }
  b.add({ geo: box(1.9, 0.14, 0.05), color: "#f97316", pos: [0, 0.5, d / 2 + 0.9] });
  for (let i = 0; i < 4; i++) {
    b.add({
      geo: box(1.4, 0.08, 0.22),
      color: "#a0703f",
      pos: [w / 2 - 0.4, 0.06 + i * 0.09, d / 2 + 0.5],
      rot: [0, 0.3, 0],
    });
  }
  return b.build(hh);
}

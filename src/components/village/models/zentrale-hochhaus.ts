import { box, cyl, rbox, sphere } from "../geo";
import { Builder, STONE, WARM, type Model } from "./common";

/** Pseudozufall 0…1 aus Zahlen, damit die beleuchteten Fenster stabil bleiben. */
const rnd = (a: number, b: number) => {
  const v = Math.sin(a * 91.7 + b * 12.3) * 43758.5453;
  return v - Math.floor(v);
};

/** Ein Turmkörper mit Glasfassade und teilweise erleuchteten Fenstern. */
function tower(
  b: Builder,
  w: number,
  d: number,
  y0: number,
  h: number,
  seed: number,
  color: string,
) {
  b.add({ geo: rbox(w, h, d, 0.08), color, pos: [0, y0 + h / 2, 0] });
  b.add({
    geo: rbox(w + 0.14, 0.14, d + 0.14, 0.03),
    color: "#475569",
    pos: [0, y0 + h + 0.05, 0],
  });
  const floors = Math.max(3, Math.round(h / 0.55));
  const cols = Math.max(3, Math.round(w / 0.45));
  const dcols = Math.max(3, Math.round(d / 0.45));
  for (let f = 0; f < floors; f++) {
    const y = y0 + 0.35 + (f * (h - 0.5)) / floors;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      const lit = rnd(seed + f, c) > 0.42;
      const geo = box((w / cols) * 0.62, 0.3, 0.06);
      if (lit) b.light({ geo, color: WARM, pos: [x, y, d / 2 + 0.02] });
      else b.add({ geo, color: "#93c5fd", pos: [x, y, d / 2 + 0.02] });
    }
    for (let c = 0; c < dcols; c++) {
      const z = -d / 2 + (d / dcols) * (c + 0.5);
      const geo = box(0.06, 0.3, (d / dcols) * 0.62);
      if (rnd(seed + f * 3, c + 9) > 0.45) b.light({ geo, color: WARM, pos: [w / 2 + 0.02, y, z] });
      else b.add({ geo, color: "#93c5fd", pos: [w / 2 + 0.02, y, z] });
      if (rnd(seed + f * 5, c + 4) > 0.45)
        b.light({ geo, color: WARM, pos: [-w / 2 - 0.02, y, z] });
      else b.add({ geo, color: "#93c5fd", pos: [-w / 2 - 0.02, y, z] });
    }
  }
}

/** Hochhaus: gestaffelter Glasturm auf Sockel, mit Antenne, Helikopterlandeplatz und Eingangsdach. */
export function hochhausModel(fp: number): Model {
  const b = new Builder();
  const base = 0.22;
  b.add({ geo: rbox(fp * 2.6, base, fp * 2.1, 0.04), color: STONE, pos: [0, base / 2, 0] });

  // Sockelgeschoss mit Lobby
  const ph = fp * 0.55;
  b.add({ geo: rbox(fp * 2.4, ph, fp * 1.9, 0.08), color: "#64748b", pos: [0, base + ph / 2, 0] });
  b.light({
    geo: box(fp * 1.9, ph * 0.55, 0.1),
    color: WARM,
    pos: [0, base + ph * 0.5, fp * 0.95 + 0.02],
  });
  b.add({
    geo: rbox(fp * 1.2, 0.09, fp * 0.7, 0.02),
    color: "#334155",
    pos: [0, base + ph + 0.02, fp * 1.15],
  });
  for (const x of [-0.5, 0.5])
    b.add({
      geo: cyl(0.05, 0.05, ph, 8),
      color: "#cbd5e1",
      pos: [x * fp, base + ph / 2, fp * 1.4],
    });

  const y1 = base + ph;
  tower(b, fp * 1.55, fp * 1.25, y1, fp * 2.7, 1, "#60758f");
  const y2 = y1 + fp * 2.7;
  tower(b, fp * 1.2, fp * 0.98, y2, fp * 1.5, 7, "#556b85");
  const y3 = y2 + fp * 1.5;
  tower(b, fp * 0.82, fp * 0.7, y3, fp * 0.95, 13, "#4b607a");
  const top = y3 + fp * 0.95 + 0.12;

  // Landeplatz und Antenne
  b.add({
    geo: cyl(fp * 0.34, fp * 0.34, 0.05, 20),
    color: "#334155",
    pos: [-fp * 0.1, top + 0.02, 0],
  });
  b.light({
    geo: cyl(fp * 0.2, fp * 0.2, 0.06, 20),
    color: "#fde68a",
    pos: [-fp * 0.1, top + 0.04, 0],
  });
  b.add({
    geo: cyl(0.04, 0.07, fp * 1.8, 8),
    color: "#9ca3af",
    pos: [fp * 0.2, top + fp * 0.9, -0.1],
  });
  b.light({ geo: sphere(0.1, 8), color: "#ff4d3a", pos: [fp * 0.2, top + fp * 1.82, -0.1] });
  for (const s of [-1, 1]) {
    b.add({
      geo: box(0.05, fp * 0.6, 0.05),
      color: "#9ca3af",
      pos: [fp * 0.2 + s * 0.16, top + fp * 0.3, -0.1],
    });
  }
  return b.build();
}

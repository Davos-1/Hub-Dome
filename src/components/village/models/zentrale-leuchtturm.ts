import * as THREE from "three";
import { box, cyl, rbox, sphere } from "../geo";
import { Builder, STONE, WARM, WHITE, WOOD, type Model } from "./common";

/** Leuchtturm: gestreifter Turm auf Felsen, Galerie, leuchtende Laterne und Boot. */
export function leuchtturmModel(fp: number): Model {
  const b = new Builder();

  // Felsen
  const rocks: [number, number, number, number][] = [
    [0, 0, 0, 1.15],
    [fp * 0.9, 0.1, fp * 0.3, 0.7],
    [-fp * 0.85, 0.05, -fp * 0.2, 0.75],
    [fp * 0.3, 0.05, -fp * 0.9, 0.65],
    [-fp * 0.4, 0.05, fp * 0.95, 0.6],
  ];
  rocks.forEach(([x, y, z, s], i) => {
    b.add({
      geo: new THREE.DodecahedronGeometry(fp * s, 0),
      color: i % 2 ? "#8c8c92" : "#9ca3af",
      pos: [x, y + fp * s * 0.35, z],
      scale: [1.15, 0.6, 1.05],
      rot: [0.2 * i, i, 0],
    });
  });
  const y0 = fp * 0.45;

  // Turm: konisch, rot-weiss gestreift
  const stripes = 6;
  const hTower = fp * 3.9;
  const seg = hTower / stripes;
  const rBottom = fp * 0.78;
  const rTop = fp * 0.5;
  for (let i = 0; i < stripes; i++) {
    const r0 = rBottom + ((rTop - rBottom) * i) / stripes;
    const r1 = rBottom + ((rTop - rBottom) * (i + 1)) / stripes;
    b.add({
      geo: cyl(r1, r0, seg, 20),
      color: i % 2 === 0 ? "#dc2626" : "#f8f5ef",
      pos: [0, y0 + seg * (i + 0.5), 0],
    });
  }
  // Tür und Fensterchen
  b.add({
    geo: rbox(fp * 0.32, fp * 0.55, 0.1, 0.03),
    color: WOOD,
    pos: [0, y0 + fp * 0.28, rBottom - 0.05],
  });
  for (const i of [1, 3, 4]) {
    const r = rBottom + ((rTop - rBottom) * (i + 0.5)) / stripes;
    b.light({ geo: box(0.2, 0.3, 0.08), color: WARM, pos: [0, y0 + seg * (i + 0.5), r - 0.02] });
  }

  // Galerie und Laterne
  const yg = y0 + hTower;
  b.add({ geo: cyl(fp * 0.78, fp * 0.7, 0.14, 20), color: "#374151", pos: [0, yg + 0.07, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.add({
      geo: cyl(0.025, 0.025, 0.42, 6),
      color: "#374151",
      pos: [Math.cos(a) * fp * 0.74, yg + 0.35, Math.sin(a) * fp * 0.74],
    });
  }
  b.add({
    geo: new THREE.TorusGeometry(fp * 0.74, 0.03, 6, 24),
    color: "#374151",
    pos: [0, yg + 0.55, 0],
    rot: [Math.PI / 2, 0, 0],
  });
  b.light({
    geo: cyl(fp * 0.34, fp * 0.34, fp * 0.65, 16),
    color: "#fff2b8",
    pos: [0, yg + 0.14 + fp * 0.33, 0],
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add({
      geo: box(0.05, fp * 0.65, 0.05),
      color: "#1f2937",
      pos: [Math.cos(a) * fp * 0.34, yg + 0.14 + fp * 0.33, Math.sin(a) * fp * 0.34],
    });
  }
  b.add({
    geo: new THREE.ConeGeometry(fp * 0.46, fp * 0.5, 16),
    color: "#dc2626",
    pos: [0, yg + 0.14 + fp * 0.9, 0],
  });
  b.add({ geo: cyl(0.02, 0.02, 0.6, 4), color: "#9ca3af", pos: [0, yg + 0.14 + fp * 1.35, 0] });
  b.light({ geo: sphere(0.07, 8), color: "#ffd479", pos: [0, yg + 0.14 + fp * 1.67, 0] });

  // Kleines Boot am Felsen (das frühere Wärterhaus entfällt: es wirkte wie ein Haus im Turm)
  b.add({
    geo: new THREE.CapsuleGeometry(0.12, 0.6, 4, 8),
    color: "#2563eb",
    pos: [-fp * 1.5, 0.14, fp * 0.8],
    rot: [0, 0, Math.PI / 2],
    scale: [1, 1, 1.6],
  });
  b.add({ geo: cyl(0.02, 0.02, 0.6, 4), color: WHITE, pos: [-fp * 1.5, 0.45, fp * 0.8] });
  b.add({ geo: box(0.01, 0.4, 0.3), color: WHITE, pos: [-fp * 1.5, 0.5, fp * 0.95] });
  void STONE;
  return b.build();
}

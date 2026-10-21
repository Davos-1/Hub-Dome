import * as THREE from "three";
import { box, cyl, rbox, sphere } from "../geo";
import { Builder, type Model } from "./common";
import { domeShape, solarPanel, tube } from "./house-marskuppel";

/** Grosse Marskuppel: zentrale Hauptkuppel mit vier Nebenkuppeln, Röhren, Solarfeld, Antenne und Landeplatz. */
export function zentraleMarskuppelModel(fp: number): Model {
  const b = new Builder();
  const R = fp * 1.35;
  const domeColor = "#eef0f2";

  // Marsboden
  b.add({ geo: cyl(fp * 3.2, fp * 3.3, 0.06, 36), color: "#b5654a", pos: [0, 0.03, 0] });
  b.add({ geo: cyl(fp * 2.7, fp * 2.8, 0.08, 36), color: "#a35a41", pos: [0, 0.05, 0] });
  for (let i = 0; i < 9; i++) {
    const a = i * 1.1 + 0.3;
    b.add({
      geo: sphere(0.2 + (i % 3) * 0.08, 6),
      color: "#8f4a35",
      pos: [Math.cos(a) * fp * 2.9, 0.13, Math.sin(a) * fp * 2.9],
      scale: [1, 0.6, 1],
    });
  }

  domeShape(b, 0, 0, R, domeColor, 5);

  // Nebenkuppeln im Kreis, Röhren zur Hauptkuppel
  const satellites = [
    { a: -0.9, r: 0.62, green: false },
    { a: -2.4, r: 0.55, green: true },
    { a: 0.9, r: 0.5, green: false },
    { a: 2.3, r: 0.58, green: false },
  ];
  for (const s of satellites) {
    const dist = R + fp * 0.95;
    const x = Math.sin(s.a) * dist;
    const z = Math.cos(s.a) * dist - fp * 0.2;
    const rr = fp * s.r;
    domeShape(b, x, z, rr, domeColor, 2, s.green);
    tube(
      b,
      Math.sin(s.a) * R * 0.85,
      Math.cos(s.a) * R * 0.85 - fp * 0.2,
      x - Math.sin(s.a) * rr * 0.85,
      z - Math.cos(s.a) * rr * 0.85,
      fp * 0.17,
    );
  }

  // Schleuse vorn
  const airR = fp * 0.34;
  b.add({
    geo: cyl(airR, airR, 1.4, 14),
    color: "#e7e5e4",
    pos: [0, airR + 0.18, R + 0.6],
    rot: [Math.PI / 2, 0, 0],
  });
  b.add({
    geo: cyl(airR * 1.04, airR * 1.04, 0.14, 14),
    color: "#f59e0b",
    pos: [0, airR + 0.18, R + 1.28],
    rot: [Math.PI / 2, 0, 0],
  });
  b.light({
    geo: cyl(airR * 0.75, airR * 0.75, 0.05, 14),
    color: "#9ae6ff",
    pos: [0, airR + 0.18, R + 1.38],
    rot: [Math.PI / 2, 0, 0],
  });

  // Solarfeld
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++) solarPanel(b, -fp * 2.2 + c * 0.9, -fp * 1.9 - r * 0.9, 1.1);

  // Antennenschüssel auf der Kuppel + Funkmast
  const top = 0.34 + R * 0.9;
  b.add({ geo: cyl(0.06, 0.08, 0.7, 6), color: "#9ca3af", pos: [R * 0.2, top + 0.25, -R * 0.1] });
  b.add({
    geo: new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
    color: "#f3f4f6",
    pos: [R * 0.2, top + 0.8, -R * 0.1],
    rot: [Math.PI * 0.72, 0.4, 0],
  });
  b.add({
    geo: cyl(0.04, 0.06, fp * 2.2, 6),
    color: "#9ca3af",
    pos: [-R * 0.5, top + fp * 0.9, -R * 0.2],
  });
  b.light({ geo: sphere(0.09, 8), color: "#ff5a4d", pos: [-R * 0.5, top + fp * 2.0, -R * 0.2] });

  // Landeplatz mit Positionslichtern
  const lx = fp * 2.0;
  const lz = fp * 1.8;
  b.add({ geo: cyl(fp * 0.85, fp * 0.85, 0.08, 24), color: "#52525b", pos: [lx, 0.1, lz] });
  b.add({ geo: box(0.1, 0.02, fp * 0.7), color: "#fbbf24", pos: [lx - 0.25, 0.15, lz] });
  b.add({ geo: box(0.1, 0.02, fp * 0.7), color: "#fbbf24", pos: [lx + 0.25, 0.15, lz] });
  b.add({ geo: box(0.5, 0.02, 0.1), color: "#fbbf24", pos: [lx, 0.15, lz] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.light({
      geo: sphere(0.07, 6),
      color: "#fde68a",
      pos: [lx + Math.cos(a) * fp * 0.8, 0.18, lz + Math.sin(a) * fp * 0.8],
    });
  }
  // kleine Landekapsel
  b.add({
    geo: new THREE.CapsuleGeometry(0.22, 0.5, 4, 10),
    color: "#e5e7eb",
    pos: [lx, 0.52, lz],
  });
  b.add({ geo: rbox(0.5, 0.05, 0.05, 0.01), color: "#f59e0b", pos: [lx, 0.4, lz + 0.22] });
  return b.build();
}

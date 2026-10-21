import * as THREE from "three";
import { box, cyl, cylZ, rbox } from "../geo";
import { Builder, onSphere, orient } from "./common";

const PANEL = "#1e3a5f";
const RIB = "#9ca3af";

/** Eine Kuppel mit Rippen, Bullaugen und Sockel an Position (x, z). */
export function domeShape(
  b: Builder,
  x: number,
  z: number,
  R: number,
  color: string,
  windows: number,
  green = false,
) {
  const g = new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add({ geo: cyl(R * 1.06, R * 1.12, 0.34, 28), color: "#d6d3d1", pos: [x, 0.17, z] });
  b.add({ geo: g, color: green ? "#9bd18b" : color, pos: [x, 0.34, z], scale: [1, 0.9, 1] });
  // Rippen: vier Halbkreise, um je 45° gedreht, ergeben acht Meridiane
  for (let i = 0; i < 4; i++) {
    b.add({
      geo: new THREE.TorusGeometry(R + 0.015, 0.035, 6, 28, Math.PI),
      color: green ? "#5a8f4d" : RIB,
      pos: [x, 0.34, z],
      rot: [0, (i * Math.PI) / 4, 0],
      scale: [1, 0.9, 1],
    });
  }
  b.add({
    geo: new THREE.TorusGeometry(R * 0.866 + 0.015, 0.03, 6, 28),
    color: green ? "#5a8f4d" : RIB,
    pos: [x, 0.34 + R * 0.5 * 0.9, z],
    rot: [Math.PI / 2, 0, 0],
  });
  for (let i = 0; i < windows; i++) {
    const az = (windows === 1 ? 0 : (i / (windows - 1) - 0.5) * 1.5) + 0;
    const { pos, normal } = onSphere(R * 0.995, 0, az, 0.55);
    b.light({
      geo: cyl(R * 0.12, R * 0.12, 0.08, 14),
      color: green ? "#b7f59a" : "#ffe2a0",
      pos: [x + pos[0], 0.34 + pos[1] * 0.9, z + pos[2]],
      rot: orient([normal[0], normal[1] / 0.9, normal[2]]),
    });
  }
}

/** Röhre zwischen zwei Punkten auf Bodenhöhe. */
export function tube(b: Builder, x1: number, z1: number, x2: number, z2: number, r: number) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  b.add({
    geo: cylZ(r, r, len, 12),
    color: "#e7e5e4",
    pos: [(x1 + x2) / 2, r + 0.12, (z1 + z2) / 2],
    rot: [0, Math.atan2(x2 - x1, z2 - z1), 0],
  });
}

export function solarPanel(b: Builder, x: number, z: number, s = 1) {
  b.add({ geo: cyl(0.04, 0.05, 0.5 * s, 6), color: "#6b7280", pos: [x, 0.25 * s, z] });
  b.add({
    geo: rbox(0.9 * s, 0.04, 0.6 * s, 0.01),
    color: PANEL,
    pos: [x, 0.58 * s, z],
    rot: [-0.7, 0, 0],
  });
  b.add({
    geo: box(0.9 * s, 0.045, 0.02),
    color: "#93c5fd",
    pos: [x, 0.58 * s, z],
    rot: [-0.7, 0, 0],
  });
}

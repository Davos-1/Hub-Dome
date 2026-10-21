import * as THREE from "three";
import type { Tier } from "@/lib/layout";
import { box, cyl, cylZ, gearGeometry, rbox, sphere } from "../geo";
import { Builder, mix, onSphere, orient, type Model } from "./common";

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

/** Marskuppel: Kuppelstation auf rotem Boden mit Schleuse; grösser mit Nebenkuppeln, Solarfeld und Antenne. */
export function marskuppelModel(fp: number, tier: Tier, wall: string): Model {
  const b = new Builder();
  const R = fp * 1.15;
  const domeColor = mix(wall, "#f5f5f4", 0.78);

  // Marsboden
  b.add({ geo: cyl(fp * 2.3, fp * 2.4, 0.06, 30), color: "#b5654a", pos: [0, 0.03, 0] });
  b.add({ geo: cyl(fp * 1.9, fp * 2.0, 0.08, 30), color: "#a35a41", pos: [0, 0.05, 0] });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7 + 0.4;
    b.add({
      geo: sphere(0.18 + (i % 3) * 0.06, 6),
      color: "#8f4a35",
      pos: [Math.cos(a) * fp * 1.9, 0.12, Math.sin(a) * fp * 1.9 - 0.2],
      scale: [1, 0.6, 1],
    });
  }

  domeShape(b, 0, 0, R, domeColor, 3);

  // Schleuse mit Warnstreifen
  const airR = fp * 0.3;
  const front = R + 0.45;
  b.add({
    geo: cyl(airR, airR, 1.1, 14),
    color: "#e7e5e4",
    pos: [0, airR + 0.18, front - 0.2],
    rot: [Math.PI / 2, 0, 0],
  });
  b.add({
    geo: cyl(airR * 1.04, airR * 1.04, 0.12, 14),
    color: "#f59e0b",
    pos: [0, airR + 0.18, front + 0.25],
    rot: [Math.PI / 2, 0, 0],
  });
  b.light({
    geo: cyl(airR * 0.75, airR * 0.75, 0.05, 14),
    color: "#9ae6ff",
    pos: [0, airR + 0.18, front + 0.34],
    rot: [Math.PI / 2, 0, 0],
  });
  b.add({ geo: rbox(0.9, 0.08, 0.6, 0.02), color: "#a8a29e", pos: [0, 0.12, front + 0.5] });

  // Antennenmast und Probenbehälter
  b.add({
    geo: cyl(0.03, 0.04, fp * 1.4, 6),
    color: "#9ca3af",
    pos: [-R * 0.55, 0.34 + R * 0.78 + fp * 0.55, -R * 0.2],
  });
  b.light({
    geo: sphere(0.07, 8),
    color: "#ff5a4d",
    pos: [-R * 0.55, 0.34 + R * 0.78 + fp * 1.28, -R * 0.2],
  });
  for (let i = 0; i < 3; i++) {
    b.add({
      geo: cyl(0.1, 0.1, 0.34, 10),
      color: "#e5e7eb",
      pos: [R + 0.75 + i * 0.28, 0.25, -0.3 + i * 0.2],
    });
    b.add({
      geo: cyl(0.105, 0.105, 0.05, 10),
      color: "#f59e0b",
      pos: [R + 0.75 + i * 0.28, 0.45, -0.3 + i * 0.2],
    });
  }

  if (tier >= 2) {
    const r2 = R * 0.6;
    const x2 = R * 1.55;
    domeShape(b, x2, -R * 0.25, r2, domeColor, 2);
    tube(b, R * 0.85, -R * 0.1, x2 - r2 * 0.85, -R * 0.2, fp * 0.2);
    for (const k of [0, 1, 2]) solarPanel(b, -R * 1.5 - k * 0.8, R * 0.2 - k * 0.1, 1);
  }

  if (tier >= 3) {
    const r3 = R * 0.55;
    const x3 = -R * 1.45;
    domeShape(b, x3, -R * 0.55, r3, domeColor, 1, true);
    tube(b, -R * 0.85, -R * 0.25, x3 + r3 * 0.85, -R * 0.5, fp * 0.18);
    // Antennenschüssel auf der Hauptkuppel
    const top = 0.34 + R * 0.9;
    b.add({
      geo: cyl(0.05, 0.06, 0.5, 6),
      color: "#9ca3af",
      pos: [R * 0.25, top + 0.2, -R * 0.15],
    });
    b.add({
      geo: new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
      color: "#f3f4f6",
      pos: [R * 0.25, top + 0.55, -R * 0.15],
      rot: [Math.PI * 0.7, 0, 0],
    });
    // Rover
    const rx = R * 0.9;
    const rz = R * 1.25;
    b.add({ geo: rbox(0.7, 0.22, 0.45, 0.04), color: "#d1d5db", pos: [rx, 0.38, rz] });
    b.add({ geo: rbox(0.3, 0.16, 0.25, 0.03), color: "#f59e0b", pos: [rx - 0.1, 0.56, rz] });
    for (const sx of [-0.28, 0.28]) {
      for (const sz of [-0.28, 0.28]) {
        b.add({
          geo: cyl(0.13, 0.13, 0.1, 10),
          color: "#374151",
          pos: [rx + sx, 0.17, rz + sz],
          rot: [Math.PI / 2, 0, 0],
        });
      }
    }
    b.add({
      geo: gearGeometry(8, 0.1, 0.15, 0.04, 0.05),
      color: "#fbbf24",
      pos: [rx + 0.15, 0.7, rz + 0.1],
    });
  }
  return b.build();
}

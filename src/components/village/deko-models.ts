import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { seededRandom } from "@/lib/random";
import type { DekoTyp } from "@/lib/world/catalog";
import type { Palette } from "@/lib/world/map";
import { box, cyl, sphere, type Part } from "./geo";
import { at, between, fruitColors, rock, sit, type V3 } from "./model-helpers";
import { darken, mix, orient, STONE, WOOD } from "./models/common";

/**
 * Modelle der Deko-Elemente (Bank bis Steg), prozedural aus Grundformen. Lokal um den Ursprung, die Front
 * (Sitzseite, Steg-Spitze) zeigt nach +z, der Boden liegt bei y = 0. Alles bleibt innerhalb der Grundfläche
 * aus `catalog.ts`; unter y = 0 liegen nur die Pfähle des Stegs. Ziel: unter 1500 Dreiecke pro Element.
 */

type Built = { body: Part[]; glow?: Part[] };

const WOOD_LIGHT = "#b5855a";
const WOOD_DARK = "#4a3424";
const TRUNK = "#6b4423";
const IRON = "#2f2f35";
const IRON_POLE = "#3f3f46";
const SOIL = "#5a4030";
const WATER = "#6aaed6";
const WATER_LIGHT = "#a9d3ea";

/** Kugelförmiger Körper (gleiche Form wie die Bäume der Szene: Ikosaeder mit glatten Normalen). */
const ico = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
/** Vierseitige Spitze mit rechteckiger Grundfläche (Seiten parallel zu den Achsen), Fusspunkt bei y = −h/2. */
function pyramid(w: number, d: number, h: number) {
  const g = new THREE.CylinderGeometry(0, 0.5, h, 4);
  g.rotateY(Math.PI / 4);
  g.scale(w * Math.SQRT2, 1, d * Math.SQRT2);
  return g;
}
/** Quader mit leicht gerundeten Kanten, sparsam einsetzen (108 Dreiecke). */
const soft = (w: number, h: number, d: number, r = 0.02) => new RoundedBoxGeometry(w, h, d, 1, r);

/** Bank: drei Sitzlatten, drei Lehnenlatten, Beine und Armlehnen. Sitzseite +z, Lehne hinten (−z). */
function bank(): Built {
  const body: Part[] = [];
  for (const z of [-0.05, 0.09, 0.23]) {
    body.push({ geo: box(1.16, 0.045, 0.12), color: WOOD_LIGHT, pos: [0, 0.42, z] });
  }
  for (const y of [0.56, 0.68, 0.8]) {
    body.push({ geo: box(1.0, 0.09, 0.03), color: WOOD_LIGHT, pos: [0, y, -0.19] });
  }
  for (const s of [-1, 1]) {
    const x = s * 0.53;
    body.push({ geo: box(0.06, 0.4, 0.06), color: WOOD, pos: [x, 0.2, 0.22] });
    body.push({ geo: box(0.06, 0.86, 0.06), color: WOOD, pos: [x, 0.43, -0.19] });
    body.push({ geo: box(0.05, 0.14, 0.05), color: WOOD, pos: [x, 0.51, 0.22] });
    body.push({ geo: soft(0.09, 0.045, 0.46, 0.015), color: WOOD_DARK, pos: [x, 0.6, 0.02] });
    body.push({ geo: box(0.04, 0.04, 0.4), color: WOOD, pos: [x, 0.15, 0.015] });
  }
  return { body };
}

/** Picknicktisch: Tischplatte aus drei Brettern, zwei angesetzte Bänke, A-förmige Beine, Vase mit Blumen. */
function picknick(p: Palette): Built {
  const body: Part[] = [];
  for (const z of [-0.23, 0, 0.23]) {
    body.push({ geo: box(1.7, 0.04, 0.21), color: WOOD_LIGHT, pos: [0, 0.72, z] });
  }
  for (const s of [-1, 1]) {
    body.push({
      geo: box(1.7, 0.045, 0.28),
      color: darken(WOOD_LIGHT, 0.94),
      pos: [0, 0.4, s * 0.55],
    });
  }
  // A-Beine: oben unter der Tischplatte (z = ±0.26), unten auf dem Boden (z = ±0.64)
  const lean = Math.atan2(0.38, 0.7);
  const legLen = Math.hypot(0.38, 0.7);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.push(
        sit({
          geo: box(0.07, legLen, 0.05),
          color: WOOD,
          pos: [sx * 0.62, 0.35, sz * 0.45],
          rot: [-sz * lean, 0, 0],
        }),
      );
    }
    body.push({ geo: box(0.08, 0.06, 0.6), color: WOOD, pos: [sx * 0.62, 0.68, 0] });
  }
  body.push({ geo: box(1.24, 0.05, 0.06), color: WOOD, pos: [0, 0.66, 0] });
  // Kleine Vase mit drei Blumen auf dem Tisch
  body.push({ geo: cyl(0.045, 0.06, 0.12, 7), color: "#8fb8c9", pos: [0.3, 0.8, 0.02] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    body.push({
      geo: ico(0.045, 0),
      color: at(p.flowers, i + 1),
      pos: [0.3 + Math.cos(a) * 0.035, 0.89 + (i % 2) * 0.03, 0.02 + Math.sin(a) * 0.035],
    });
  }
  return { body };
}

/** Laterne: wie die Strassenlaternen der Szene (Sockel, Mast, Kopf mit Spitzdach), aber kleiner. */
function laterne(): Built {
  const body: Part[] = [
    { geo: cyl(0.09, 0.12, 0.2, 8), color: IRON, pos: [0, 0.1, 0] },
    { geo: cyl(0.055, 0.07, 0.05, 8), color: IRON, pos: [0, 0.225, 0] },
    { geo: cyl(0.03, 0.042, 1.52, 6), color: IRON_POLE, pos: [0, 0.97, 0] },
    { geo: cyl(0.06, 0.06, 0.03, 6), color: IRON, pos: [0, 1.2, 0] },
    { geo: box(0.17, 0.04, 0.17), color: IRON, pos: [0, 1.75, 0] },
    { geo: box(0.2, 0.035, 0.2), color: IRON, pos: [0, 1.995, 0] },
    { geo: cyl(0, 0.17, 0.15, 4), color: IRON, pos: [0, 2.0875, 0], rot: [0, Math.PI / 4, 0] },
    { geo: sphere(0.03, 6), color: IRON, pos: [0, 2.19, 0] },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.push({ geo: box(0.025, 0.2, 0.025), color: IRON, pos: [sx * 0.07, 1.885, sz * 0.07] });
    }
  }
  return { body, glow: [{ geo: box(0.13, 0.19, 0.13), color: "#ffe9b8", pos: [0, 1.885, 0] }] };
}

/** Blumenbeet: Holzrand, Erde, Laubhügel und viele kleine Blüten in den Farben der Stimmung. */
function blumenbeet(p: Palette, rnd: () => number): Built {
  const body: Part[] = [];
  for (const s of [-1, 1]) {
    body.push({ geo: box(1.7, 0.16, 0.06), color: WOOD_LIGHT, pos: [0, 0.08, s * 0.55] });
    body.push({
      geo: box(0.06, 0.16, 1.04),
      color: darken(WOOD_LIGHT, 0.92),
      pos: [s * 0.82, 0.08, 0],
    });
    for (const t of [-1, 1]) {
      body.push({ geo: box(0.09, 0.22, 0.09), color: WOOD, pos: [s * 0.82, 0.11, t * 0.55] });
    }
  }
  body.push({ geo: box(1.6, 0.12, 1.04), color: SOIL, pos: [0, 0.08, 0] });

  // Laubhügel (liegen mit der Unterkante auf y = 0, die Erde deckt den Rest)
  const R = 0.42;
  const sx = 0.9;
  const sy = 0.42;
  const lumps = [-0.4, 0, 0.4].map((cx, i) =>
    sit({ geo: ico(R), color: at(p.bushes, i), pos: [cx, 0.15, 0], scale: [sx, sy, 1] }),
  );
  body.push(...lumps);
  const surface = (x: number, z: number) => {
    let y = 0.14;
    for (const l of lumps) {
      const [cx, cy] = l.pos!;
      const k = 1 - ((x - cx) / (R * sx)) ** 2 - (z / R) ** 2;
      if (k > 0) y = Math.max(y, cy + R * sy * Math.sqrt(k));
    }
    return y;
  };

  // Blüten: Raster mit Streuung, Farben in Gruppen, damit Flecken entstehen
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -0.72 + i * 0.18 + (rnd() - 0.5) * 0.06;
      const z = -0.2 + j * 0.24 + (rnd() - 0.5) * 0.06;
      const r = 0.062 + rnd() * 0.02;
      body.push({
        geo: ico(r, 0),
        color: at(p.flowers, Math.floor(i / 2) + j * 2),
        pos: [x, surface(x, z) + 0.025, z],
        rot: [rnd() * 3, rnd() * 3, 0],
      });
    }
  }
  // Hohe Blumen in der hinteren Reihe
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4;
    const z = -0.41;
    body.push({ geo: box(0.018, 0.3, 0.018), color: at(p.bushes, i + 1), pos: [x, 0.29, z] });
    body.push({
      geo: ico(0.085, 0),
      color: at(p.flowers, i + 3),
      pos: [x, 0.46, z],
      rot: [i, 1, 0],
    });
  }
  return { body };
}

/** Hochbeet: Holzkasten (~0.7 m) mit Kohlköpfen und Karotten. */
function hochbeet(): Built {
  const body: Part[] = [];
  for (const y of [0.17, 0.53]) {
    for (const s of [-1, 1]) {
      body.push({ geo: box(1.46, 0.34, 0.045), color: WOOD_LIGHT, pos: [0, y, s * 0.395] });
      body.push({
        geo: box(0.045, 0.34, 0.72),
        color: darken(WOOD_LIGHT, 0.92),
        pos: [s * 0.7375, y, 0],
      });
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.push({ geo: box(0.08, 0.72, 0.08), color: WOOD, pos: [sx * 0.73, 0.36, sz * 0.39] });
    }
    body.push({ geo: box(1.58, 0.04, 0.09), color: WOOD, pos: [0, 0.72, sx * 0.39] });
    body.push({ geo: box(0.09, 0.04, 0.72), color: WOOD, pos: [sx * 0.735, 0.72, 0] });
  }
  const top = 0.62;
  body.push({ geo: box(1.42, 0.22, 0.74), color: SOIL, pos: [0, 0.51, 0] });

  // Kohlköpfe (hinten): grün, einer violett, mit flachem Blattkranz
  [-0.45, 0, 0.45].forEach((x, i) => {
    body.push({ geo: cyl(0.21, 0.19, 0.05, 8), color: "#6fa84f", pos: [x, top + 0.03, -0.13] });
    body.push({
      geo: ico(0.15),
      color: i === 1 ? "#8e5b9b" : "#a9d46f",
      pos: [x, top + 0.115, -0.13],
      scale: [1, 0.85, 1],
    });
  });
  // Karotten (vorn): oranger Kopf in der Erde, Kraut fächert nach oben auf
  const greens = ["#4f9a3f", "#62ad4a"];
  const carrots: [number, number][] = [];
  for (let i = 0; i < 5; i++) carrots.push([-0.48 + i * 0.24, 0.12]);
  for (let i = 0; i < 4; i++) carrots.push([-0.36 + i * 0.24, 0.28]);
  carrots.forEach(([x, z], k) => {
    body.push({ geo: cyl(0.04, 0, 0.14, 6), color: "#f08a24", pos: [x, top + 0.0, z] });
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + k;
      const d = new THREE.Vector3(Math.sin(a) * 0.45, 1, Math.cos(a) * 0.45).normalize();
      body.push({
        geo: cyl(0, 0.03, 0.22, 4),
        color: at(greens, b + k),
        pos: [x + d.x * 0.11, top + 0.01 + d.y * 0.11, z + d.z * 0.11],
        rot: orient([d.x, d.y, d.z]),
      });
    }
  });
  return { body };
}

/** Zaun: zwei Meter, drei Pfosten mit Spitzen, zwei Latten vorn und kurze Zaunlatten dahinter. */
function zaun(): Built {
  const body: Part[] = [];
  for (const x of [-0.92, 0, 0.92]) {
    body.push({ geo: box(0.1, 0.9, 0.1), color: WOOD, pos: [x, 0.45, 0] });
    body.push({ geo: pyramid(0.1, 0.1, 0.1), color: WOOD, pos: [x, 0.95, 0] });
  }
  for (const y of [0.25, 0.55]) {
    body.push({ geo: box(1.84, 0.07, 0.04), color: WOOD_LIGHT, pos: [0, y, 0.07] });
  }
  for (const start of [-0.87, 0.05]) {
    for (let i = 0; i < 5; i++) {
      const x = start + 0.08 + i * 0.16;
      body.push({
        geo: box(0.08, 0.64, 0.03),
        color: darken(WOOD_LIGHT, 0.92),
        pos: [x, 0.32, -0.035],
      });
      body.push({
        geo: pyramid(0.08, 0.03, 0.08),
        color: darken(WOOD_LIGHT, 0.92),
        pos: [x, 0.68, -0.035],
      });
    }
  }
  return { body };
}

/** Brunnen: Steinbecken mit Rand und Wasser, Säule, obere Schale und Wasserstrahl mit Tropfen. */
function brunnen(): Built {
  const rim = mix(STONE, "#ffffff", 0.25);
  const body: Part[] = [
    { geo: cyl(0.88, 0.92, 0.36, 14), color: darken(STONE, 0.95), pos: [0, 0.18, 0] },
    {
      geo: new THREE.TorusGeometry(0.83, 0.09, 5, 14),
      color: rim,
      pos: [0, 0.36, 0],
      // Drehung um die Torusachse um eine halbe Segmentbreite, damit die Ecken auf denen des Beckens liegen
      rot: [Math.PI / 2, 0, Math.PI / 14],
    },
    { geo: cyl(0.78, 0.78, 0.03, 14), color: WATER, pos: [0, 0.375, 0] },
    { geo: cyl(0.26, 0.3, 0.12, 10), color: STONE, pos: [0, 0.4, 0] },
    { geo: cyl(0.12, 0.2, 0.6, 8), color: STONE, pos: [0, 0.6, 0] },
    { geo: cyl(0.42, 0.2, 0.16, 10), color: STONE, pos: [0, 0.95, 0] },
    {
      geo: new THREE.TorusGeometry(0.405, 0.03, 4, 10),
      color: rim,
      pos: [0, 1.04, 0],
      rot: [Math.PI / 2, 0, Math.PI / 10],
    },
    { geo: cyl(0.38, 0.38, 0.02, 10), color: WATER, pos: [0, 1.03, 0] },
    { geo: cyl(0.02, 0.055, 0.42, 6), color: WATER_LIGHT, pos: [0, 1.25, 0] },
    { geo: sphere(0.065, 8), color: WATER_LIGHT, pos: [0, 1.52, 0] },
  ];
  // Tropfen, die in einem Bogen um den Strahl herabfallen
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const r = 0.16 + (i % 2) * 0.07;
    body.push({
      geo: sphere(0.035, 6),
      color: WATER_LIGHT,
      pos: [Math.cos(a) * r, 1.33 - (i % 2) * 0.12, Math.sin(a) * r],
    });
  }
  return { body };
}

/** Laubbaum: Stamm und drei Kronenkugeln in den Laubfarben. */
function laubbaum(p: Palette): Built {
  return {
    body: [
      { geo: cyl(0.15, 0.25, 1.5, 8), color: TRUNK, pos: [0, 0.75, 0] },
      { geo: ico(1.0), color: at(p.leaves, 0), pos: [0, 2.3, 0], scale: [1, 0.9, 1] },
      { geo: ico(0.7), color: at(p.leaves, 1), pos: [0.5, 1.85, 0.2] },
      { geo: ico(0.62), color: at(p.leaves, 2), pos: [-0.5, 1.95, -0.25] },
    ],
  };
}

/** Nadelbaum: Stamm und zwei übereinandergesetzte Kegel in Nadelfarben. */
function nadelbaum(p: Palette): Built {
  return {
    body: [
      { geo: cyl(0.1, 0.17, 0.9, 7), color: TRUNK, pos: [0, 0.45, 0] },
      { geo: cyl(0, 0.95, 1.6, 9), color: at(p.needles, 0), pos: [0, 1.4, 0] },
      { geo: cyl(0, 0.68, 1.4, 9), color: at(p.needles, 1), pos: [0, 2.3, 0], rot: [0, 0.35, 0] },
    ],
  };
}

/** Obstbaum: kleinere Krone mit Früchten (Blütenfarben der Stimmung) und ein paar Fallobst am Boden. */
function obstbaum(p: Palette, rnd: () => number): Built {
  // Laub etwas Richtung Nadelgrün gemischt, damit die Früchte auch im Herbst (orange Laub) abstechen
  const leaf = (i: number) => mix(at(p.leaves, i), at(p.needles, 0), 0.35);
  const crowns: { r: number; pos: V3; n: number; color: string }[] = [
    { r: 0.8, pos: [0, 1.75, 0], n: 7, color: leaf(0) },
    { r: 0.55, pos: [0.4, 1.5, 0.2], n: 4, color: leaf(1) },
    { r: 0.5, pos: [-0.38, 1.55, -0.25], n: 4, color: leaf(2) },
  ];
  const body: Part[] = [{ geo: cyl(0.13, 0.22, 1.1, 8), color: TRUNK, pos: [0, 0.55, 0] }];
  const fruit = fruitColors(p);
  let k = 0;
  for (const c of crowns) {
    body.push({
      geo: ico(c.r),
      color: c.color,
      pos: c.pos,
      scale: c.r > 0.7 ? [1, 0.92, 1] : undefined,
    });
    for (let i = 0; i < c.n; i++) {
      // gleichmässig um die Krone verteilt, leicht oberhalb des Äquators
      const az = (i / c.n) * Math.PI * 2 + rnd() * 0.8;
      const el = -0.05 + rnd() * 0.75;
      const rr = c.r * 0.98;
      body.push({
        geo: ico(0.1, 0),
        color: at(fruit, k++),
        pos: [
          c.pos[0] + Math.sin(az) * Math.cos(el) * rr,
          c.pos[1] + Math.sin(el) * rr,
          c.pos[2] + Math.cos(az) * Math.cos(el) * rr,
        ],
        rot: [rnd() * 3, rnd() * 3, 0],
      });
    }
  }
  for (const [x, z] of [
    [0.5, 0.65],
    [-0.3, 0.7],
    [0.2, -0.65],
  ]) {
    body.push(sit({ geo: ico(0.06, 0), color: at(fruit, k++), pos: [x, 0.1, z] }));
  }
  return { body };
}

/** Busch: drei Kugeln in Buschfarben mit ein paar Blüten. */
function busch(p: Palette, rnd: () => number): Built {
  const balls: { r: number; x: number; z: number }[] = [
    { r: 0.4, x: 0, z: 0 },
    { r: 0.3, x: 0.27, z: 0.12 },
    { r: 0.28, x: -0.26, z: -0.12 },
  ];
  const body: Part[] = balls.map((b, i) =>
    sit({ geo: ico(b.r), color: at(p.bushes, i), pos: [b.x, 0, b.z], scale: [1, 0.9, 1] }),
  );
  // Blüten auf der Oberseite der grossen Kugel
  for (let i = 0; i < 7; i++) {
    const az = (i / 7) * Math.PI * 2 + rnd() * 0.6;
    const el = 0.3 + rnd() * 0.9;
    const b = balls[i % 3];
    const cy = (body[i % 3].pos as V3)[1];
    body.push({
      geo: ico(0.045, 0),
      color: at(p.flowers, i),
      pos: [
        b.x + Math.sin(az) * Math.cos(el) * b.r * 0.97,
        cy + Math.sin(el) * b.r * 0.9 * 0.97,
        b.z + Math.cos(az) * Math.cos(el) * b.r * 0.97,
      ],
    });
  }
  return { body };
}

/** Findling: grosser Stein aus drei verdrehten Dodekaedern, mit Grasbüscheln am Fuss. */
function findling(p: Palette): Built {
  const body: Part[] = [
    sit({
      geo: rock(0.48),
      color: at(p.rocks, 0),
      pos: [-0.05, 0, 0],
      rot: [0.25, 0.6, 0.1],
      scale: [1.12, 0.8, 0.95],
    }),
    sit({
      geo: rock(0.25),
      color: at(p.rocks, 1),
      pos: [0.26, 0, 0.1],
      rot: [0.1, 1.9, -0.3],
      scale: [1.1, 0.8, 1],
    }),
    sit({
      geo: rock(0.22),
      color: at(p.rocks, 2),
      pos: [-0.25, 0, -0.2],
      rot: [0.5, 0.2, 0.4],
      scale: [1, 0.85, 1.1],
    }),
  ];
  // Grasbüschel: je drei schmale, leicht gespreizte Halme
  const tufts: [number, number][] = [
    [-0.36, 0.34],
    [0.42, -0.26],
    [0.05, 0.46],
  ];
  tufts.forEach(([x, z], k) => {
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + k * 2;
      const d = new THREE.Vector3(Math.sin(a) * 0.35, 1, Math.cos(a) * 0.35).normalize();
      body.push(
        sit({
          geo: cyl(0, 0.03, 0.2, 4),
          color: at(p.bushes, b + k),
          pos: [x + d.x * 0.1, d.y * 0.1, z + d.z * 0.1],
          rot: orient([d.x, d.y, d.z]),
        }),
      );
    }
  });
  return { body };
}

/** Feuerstelle: Steinkreis, schräg angelehnte Holzscheite, Glut und Flamme (glow) und zwei Baumstamm-Bänke. */
function feuerstelle(p: Palette, rnd: () => number): Built {
  const body: Part[] = [{ geo: cyl(0.4, 0.4, 0.02, 10), color: "#3a332e", pos: [0, 0.01, 0] }];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    body.push(
      sit({
        geo: rock(0.14),
        color: at(p.rocks, i),
        pos: [Math.sin(a) * 0.46, 0, Math.cos(a) * 0.46],
        rot: [rnd() * 0.5, rnd() * 3, rnd() * 0.5],
        scale: [1.15, 0.8, 1],
      }),
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    body.push(
      between(
        [Math.sin(a) * 0.3, 0.06, Math.cos(a) * 0.3],
        [Math.sin(a) * 0.04, 0.4, Math.cos(a) * 0.04],
        0.05,
        0.04,
        i % 2 ? WOOD : TRUNK,
        6,
      ),
    );
  }
  // Baumstamm-Bänke: liegende Stämme tangential um das Feuer, mit hellen Schnittflächen
  for (const phi of [0.4, Math.PI + 0.4]) {
    const c: V3 = [Math.sin(phi) * 0.72, 0.17, Math.cos(phi) * 0.72];
    const u: V3 = [Math.cos(phi), 0, -Math.sin(phi)];
    const len = 0.8;
    body.push({ geo: cyl(0.17, 0.17, len, 8), color: TRUNK, pos: c, rot: [0, phi, Math.PI / 2] });
    for (const s of [-1, 1]) {
      body.push({
        geo: cyl(0.15, 0.15, 0.02, 8),
        color: "#d9b483",
        pos: [c[0] + u[0] * s * (len / 2 + 0.005), c[1], c[2] + u[2] * s * (len / 2 + 0.005)],
        rot: [0, phi, Math.PI / 2],
      });
    }
  }
  const glow: Part[] = [
    sit({ geo: ico(0.07, 0), color: "#ffb84d", pos: [0.1, 0, 0.05], scale: [1.4, 0.6, 1.4] }),
    sit({ geo: ico(0.06, 0), color: "#ffb84d", pos: [-0.09, 0, -0.1], scale: [1.4, 0.6, 1.4] }),
    sit({ geo: ico(0.06, 0), color: "#ffb84d", pos: [-0.04, 0, 0.13], scale: [1.4, 0.6, 1.4] }),
    { geo: cyl(0, 0.1, 0.38, 6), color: "#ffb84d", pos: [0, 0.27, 0] },
    { geo: cyl(0, 0.06, 0.24, 6), color: "#ffb84d", pos: [0.09, 0.2, 0.04], rot: [0.2, 0, -0.2] },
  ];
  return { body, glow };
}

/** Steg: Bohlen von z = −2 bis +2 in Deckhöhe 0.25, Auflager am Ufer, vier Pfähle bis y = −0.6 unter dem Wasserteil. */
function steg(): Built {
  const body: Part[] = [];
  for (let k = 0; k < 20; k++) {
    const z = -1.9 + k * 0.2;
    body.push({
      geo: box(1.0, 0.05, 0.17),
      color: darken(WOOD_LIGHT, k % 2 ? 0.9 : 1),
      pos: [0, 0.225, z],
    });
  }
  for (const s of [-1, 1]) {
    body.push({ geo: box(0.1, 0.1, 3.9), color: WOOD, pos: [s * 0.4, 0.15, 0] });
    // Auflager aus Stein am Ufer (landseitig, z < 0)
    for (const z of [-1.75, -0.7]) {
      body.push(
        sit({ geo: rock(0.15), color: STONE, pos: [s * 0.4, 0, z], scale: [1.1, 0.7, 1.4] }),
      );
    }
    // Pfähle im Wasser (wasserseitig, z > 0): bis y = −0.6, oben mit Kappe
    for (const z of [0.55, 1.75]) {
      body.push({ geo: cyl(0.055, 0.06, 1.1, 7), color: WOOD_DARK, pos: [s * 0.52, -0.05, z] });
      body.push({ geo: cyl(0.07, 0.07, 0.04, 7), color: WOOD, pos: [s * 0.52, 0.52, z] });
    }
    // Seil zwischen den Pfählen
    body.push(between([s * 0.52, 0.43, 0.55], [s * 0.52, 0.43, 1.75], 0.012, 0.012, "#d9c9a0", 5));
  }
  return { body };
}

const BUILDERS: Record<DekoTyp, (p: Palette, rnd: () => number) => Built> = {
  bank,
  picknick,
  laterne,
  blumenbeet,
  hochbeet,
  zaun,
  brunnen,
  laubbaum,
  nadelbaum,
  obstbaum,
  busch,
  findling,
  feuerstelle,
  steg,
};

/**
 * Bauteile eines Deko-Elements: `body` mit Vertex-Farben, `glow` = leuchtende Teile (Laterne, Glut; sonst leer).
 * Lokal um den Ursprung, Front nach +z, Boden bei y = 0. Gleicher Typ und gleiche Palette ergeben immer dasselbe Modell.
 */
export function dekoParts(typ: DekoTyp, palette: Palette): { body: Part[]; glow: Part[] } {
  const built = BUILDERS[typ](palette, seededRandom(`deko:${typ}`));
  return { body: built.body, glow: built.glow ?? [] };
}

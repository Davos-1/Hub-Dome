import * as THREE from "three";
import type { ItemType } from "@/lib/item-types";
import {
  arch,
  arrowBoard,
  box,
  cyl,
  gearGeometry,
  mergeParts,
  rbox,
  sphere,
  type Part,
} from "./geo";
import type { Model } from "./models/common";

const STONE = "#cfc9bd";
const STONE_DARK = "#a8a29e";
export const PEDESTAL_HEIGHT = 0.62;

const tint = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(amount > 0 ? "#ffffff" : "#000000"), Math.abs(amount));
  return `#${c.getHexString()}`;
};

/** Sockel, auf dem jedes Objekt steht; der Ring zeigt die Inhaltskategorie. */
function pedestal(kindColor: string): Part[] {
  return [
    {
      geo: cyl(0.3, 0.4, PEDESTAL_HEIGHT - 0.1, 14),
      color: STONE,
      pos: [0, (PEDESTAL_HEIGHT - 0.1) / 2, 0],
    },
    { geo: cyl(0.45, 0.45, 0.07, 18), color: STONE_DARK, pos: [0, 0.035, 0] },
    { geo: cyl(0.46, 0.46, 0.06, 18), color: kindColor, pos: [0, PEDESTAL_HEIGHT - 0.12, 0] },
    { geo: cyl(0.42, 0.42, 0.07, 18), color: STONE, pos: [0, PEDESTAL_HEIGHT - 0.05, 0] },
  ];
}

const Y = PEDESTAL_HEIGHT; // Oberkante des Sockels

/** Claude-Artifact: leuchtender Kristall mit zwei kleinen Splittern. */
function crystal(color: string): Part[] {
  const bip = (
    r: number,
    h: number,
    c: string,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ): Part[] => [
    {
      geo: new THREE.ConeGeometry(r, h * 0.55, 6),
      color: c,
      pos: [pos[0], pos[1] + h * 0.275, pos[2]],
      rot,
    },
    {
      geo: new THREE.ConeGeometry(r, h * 0.45, 6),
      color: tint(c, -0.2),
      pos: [pos[0], pos[1] - h * 0.225, pos[2]],
      rot: [rot[0] + Math.PI, rot[1], rot[2]],
    },
  ];
  return [
    ...bip(0.2, 1.0, tint(color, 0.15), [0, Y + 0.62, 0], [0, 0.3, 0.06]),
    ...bip(0.11, 0.55, tint(color, 0.3), [0.3, Y + 0.34, 0.06], [0, 0.6, -0.35]),
    ...bip(0.09, 0.45, color, [-0.28, Y + 0.3, -0.05], [0, 0.2, 0.4]),
  ];
}

/** GitHub-Repo: Zahnrad mit Nabe und kleinem Zweitrad. */
function gear(color: string): Part[] {
  return [
    {
      geo: gearGeometry(10, 0.3, 0.4, 0.1, 0.16),
      color,
      pos: [-0.06, Y + 0.55, 0],
      rot: [0, 0, 0.2],
    },
    {
      geo: cyl(0.14, 0.14, 0.22, 14),
      color: tint(color, -0.25),
      pos: [-0.06, Y + 0.55, 0],
      rot: [Math.PI / 2, 0, 0],
    },
    {
      geo: gearGeometry(7, 0.15, 0.22, 0.05, 0.12),
      color: tint(color, 0.25),
      pos: [0.38, Y + 0.28, 0.02],
      rot: [0, 0, 0.5],
    },
  ];
}

/** Gist: kleiner Monitor mit Terminal. */
function terminal(): { body: Part[]; glow: Part[] } {
  const g = "#4ade80";
  return {
    body: [
      { geo: rbox(0.72, 0.52, 0.14, 0.05), color: "#374151", pos: [0, Y + 0.58, 0] },
      { geo: box(0.62, 0.42, 0.03), color: "#0b1220", pos: [0, Y + 0.58, 0.075] },
      { geo: cyl(0.05, 0.07, 0.18, 8), color: "#4b5563", pos: [0, Y + 0.23, 0] },
      { geo: rbox(0.3, 0.05, 0.2, 0.02), color: "#4b5563", pos: [0, Y + 0.14, 0] },
    ],
    glow: [
      // «>_» und zwei Textzeilen
      { geo: box(0.07, 0.025, 0.02), color: g, pos: [-0.2, Y + 0.7, 0.095], rot: [0, 0, -0.5] },
      { geo: box(0.07, 0.025, 0.02), color: g, pos: [-0.2, Y + 0.66, 0.095], rot: [0, 0, 0.5] },
      { geo: box(0.1, 0.025, 0.02), color: g, pos: [-0.08, Y + 0.64, 0.095] },
      { geo: box(0.3, 0.025, 0.02), color: g, pos: [0.0, Y + 0.54, 0.095] },
      { geo: box(0.2, 0.025, 0.02), color: g, pos: [-0.05, Y + 0.47, 0.095] },
    ],
  };
}

/** Cloud-Ordner: Holztruhe mit Eisenbändern, Schloss und kleiner Wolke. */
function chest(color: string): Part[] {
  const wood = "#8a5a33";
  const metal = "#4b5563";
  return [
    { geo: rbox(0.74, 0.34, 0.5, 0.05), color: wood, pos: [0, Y + 0.19, 0] },
    {
      geo: arch(0.25, 0.74),
      color: tint(wood, 0.08),
      pos: [0, Y + 0.36, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [1, 1, 1],
    },
    ...[-0.24, 0.24].flatMap((x): Part[] => [
      { geo: box(0.07, 0.36, 0.52), color: metal, pos: [x, Y + 0.19, 0] },
      { geo: arch(0.26, 0.07), color: metal, pos: [x, Y + 0.36, 0], rot: [0, Math.PI / 2, 0] },
    ]),
    { geo: rbox(0.12, 0.14, 0.05, 0.02), color: "#e0b341", pos: [0, Y + 0.34, 0.27] },
    // Wolke als Kategorie-Symbol
    { geo: sphere(0.13, 10), color: "#ffffff", pos: [-0.12, Y + 0.88, 0] },
    { geo: sphere(0.17, 10), color: "#ffffff", pos: [0.02, Y + 0.93, 0] },
    { geo: sphere(0.12, 10), color: "#ffffff", pos: [0.17, Y + 0.87, 0] },
    { geo: rbox(0.42, 0.1, 0.2, 0.05), color: "#ffffff", pos: [0.02, Y + 0.84, 0] },
    { geo: rbox(0.5, 0.04, 0.5, 0.02), color: tint(color, 0.3), pos: [0, Y + 0.0, 0] },
  ];
}

/** Link: Wegweiser mit zwei Pfeilschildern. */
function signpost(color: string): Part[] {
  return [
    { geo: cyl(0.05, 0.06, 1.15, 8), color: "#7a4a2b", pos: [0, Y + 0.58, 0] },
    { geo: sphere(0.07, 8), color: "#7a4a2b", pos: [0, Y + 1.16, 0] },
    {
      geo: arrowBoard(0.7, 0.22, 0.05),
      color: color,
      pos: [0.12, Y + 0.95, 0.07],
      rot: [0, 0.15, 0.06],
    },
    {
      geo: arrowBoard(0.6, 0.2, 0.05),
      color: tint(color, 0.35),
      pos: [-0.1, Y + 0.65, 0.07],
      rot: [0, -0.15, Math.PI - 0.05],
    },
  ];
}

/** Datei (ab Phase 8): aufgeschlagenes Buch. */
function book(color: string): Part[] {
  return [
    { geo: rbox(0.62, 0.1, 0.46, 0.03), color, pos: [0, Y + 0.15, 0] },
    { geo: rbox(0.56, 0.1, 0.4, 0.02), color: "#fbf7ec", pos: [0.02, Y + 0.2, 0] },
    { geo: box(0.4, 0.02, 0.02), color: "#9ca3af", pos: [0.02, Y + 0.26, 0.1] },
    { geo: box(0.3, 0.02, 0.02), color: "#9ca3af", pos: [0.02, Y + 0.26, 0] },
    { geo: box(0.36, 0.02, 0.02), color: "#9ca3af", pos: [0.02, Y + 0.26, -0.1] },
  ];
}

/** Paket (ab Phase 9): Kiste mit Deckel und Band. */
function crate(color: string): Part[] {
  return [
    { geo: rbox(0.58, 0.44, 0.58, 0.04), color: "#b4833d", pos: [0, Y + 0.25, 0] },
    { geo: rbox(0.64, 0.1, 0.64, 0.03), color: color, pos: [0, Y + 0.52, 0] },
    { geo: box(0.1, 0.46, 0.6), color: "#e7d3a8", pos: [0, Y + 0.25, 0] },
  ];
}

const cache = new Map<string, Model>();

/** Modell eines Objekts (Sockel + Form), geteilt zwischen gleichen Typ/Farb-Kombinationen. */
export function objectModel(type: ItemType, kindColor: string): Model {
  const key = `${type}:${kindColor}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let body: Part[] = [];
  let glow: Part[] = [];
  switch (type) {
    case "github_repo":
      body = gear(kindColor);
      break;
    case "gist": {
      const t = terminal();
      body = t.body;
      glow = t.glow;
      break;
    }
    case "cloud_ordner":
      body = chest(kindColor);
      break;
    case "link":
      body = signpost(kindColor);
      break;
    case "datei":
      body = book(kindColor);
      break;
    case "paket":
      body = crate(kindColor);
      break;
    default:
      glow = crystal(kindColor);
  }
  const model: Model = {
    body: mergeParts([...pedestal(kindColor), ...body]),
    // Leere Glow-Geometrie vermeiden: mergeParts braucht mind. ein Teil
    glow: glow.length
      ? mergeParts(glow)
      : mergeParts([{ geo: box(0.001, 0.001, 0.001), color: "#000000" }]),
  };
  cache.set(key, model);
  return model;
}

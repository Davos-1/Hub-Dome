import type { FachbereichId } from "./fachbereiche";
import type { VillageLayout } from "./layout";

/** Kamerapose: Position und Blickziel (Weltkoordinaten). */
export type Pose = { position: [number, number, number]; target: [number, number, number] };
export type ViewMode = "3d" | "karte";

export type Nav =
  | { level: "dorf" }
  | { level: "quartier"; q: FachbereichId }
  | { level: "haus"; q: FachbereichId | null; h: string };

export const overviewPose = (extent: number): Pose => ({
  position: [0, extent * 1.0 + 11, extent * 1.38 + 16],
  target: [0, 0, 0],
});

const mapPose = (extent: number): Pose => ({
  position: [0, extent * 1.75 + 8, 0.05],
  target: [0, 0, 0],
});

/** Abstand der Übersichtskamera zum Ursprung (für den Nebel). */
export const overviewDistance = (extent: number) => Math.hypot(extent + 11, extent * 1.38 + 16);

/** Quartier wie einen Ordner öffnen: Blick auf Nebenplatz und Häuser von der Seite der Zentrale. */
function quarterPose(layout: VillageLayout, id: FachbereichId, view: ViewMode): Pose {
  const q = layout.quarters.find((x) => x.id === id);
  if (!q) return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
  let cx = q.x;
  let cz = q.z;
  for (const hid of q.houseIds) {
    cx += layout.houses[hid].x;
    cz += layout.houses[hid].z;
  }
  cx /= q.houseIds.length + 1;
  cz /= q.houseIds.length + 1;
  const R = q.radius;
  if (view === "karte") return { position: [cx, R * 2.2 + 10, cz + 0.05], target: [cx, 0, cz] };
  const ux = Math.cos(q.theta);
  const uz = Math.sin(q.theta);
  const back = R * 1.25 + 7;
  return { position: [cx - ux * back, R * 1.05 + 8, cz - uz * back], target: [cx, 0, cz] };
}

/** Höhe der Quartiertafeln samt Pfosten (Meter) und Sicherheitsabstand der Blickachse darüber. */
const BOARD_TOP = 4.2;
const BOARD_MARGIN = 1.3;

/**
 * Liegt die Blickachse (Kamera → Ziel) durch eine Quartiertafel? Die Tafel ist 5.2 m breit, quer zur
 * Richtung Zentrale, mit 0.8 m Spielraum an den Seiten.
 */
function blockedByBoard(
  layout: VillageLayout,
  from: [number, number, number],
  to: [number, number, number],
) {
  const steps = 60;
  for (const q of layout.quarters) {
    const ux = Math.cos(q.theta);
    const uz = Math.sin(q.theta);
    const cx = q.x + ux * 0.4;
    const cz = q.z + uz * 0.4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from[0] + (to[0] - from[0]) * t;
      const z = from[2] + (to[2] - from[2]) * t;
      const y = from[1] + (to[1] - from[1]) * t;
      const along = (x - cx) * ux + (z - cz) * uz; // Richtung Zentrale/weg
      const side = -(x - cx) * uz + (z - cz) * ux;
      if (
        Math.abs(side) < 2.6 + 0.8 &&
        Math.abs(along) < 0.4 + 0.8 &&
        y < BOARD_TOP + BOARD_MARGIN
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Haus von vorne aus der Vogelperspektive: vor dem Gartentor, etwas weiter draussen und höher, und so hoch,
 * dass die Blickachse sicher über die grosse Quartiertafel hinwegführt (kein Verdecken je nach Winkel).
 */
function housePose(layout: VillageLayout, id: string, view: ViewMode): Pose {
  const h = layout.houses[id];
  if (!h) return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
  if (view === "karte") return { position: [h.x, 30, h.z + 0.01], target: [h.x, 0, h.z] };
  const dx = Math.sin(h.angle);
  const dz = Math.cos(h.angle);
  const gate = h.plot ? h.plot.front : h.footprint * 2;
  const back = gate + 8;
  const target: [number, number, number] = [h.x + dx * gate * 0.45, 1.1, h.z + dz * gate * 0.45];
  const position: [number, number, number] = [
    h.x + dx * back,
    6.2 + h.footprint * 1.1,
    h.z + dz * back,
  ];
  // Höher gehen, bis die Blickachse frei über jeder Tafel liegt (Obergrenze: 40 m)
  while (position[1] < 40 && blockedByBoard(layout, position, target)) position[1] += 0.5;
  return { position, target };
}

export function poseFor(layout: VillageLayout, nav: Nav, view: ViewMode): Pose {
  if (nav.level === "quartier") return quarterPose(layout, nav.q, view);
  if (nav.level === "haus") return housePose(layout, nav.h, view);
  return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
}

/** Eine Ebene zurück: Haus → Quartier (falls vorhanden) → Dorf. */
export function navUp(nav: Nav): Nav {
  if (nav.level === "haus" && nav.q) return { level: "quartier", q: nav.q };
  return { level: "dorf" };
}

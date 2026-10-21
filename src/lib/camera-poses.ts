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

export const mapPose = (extent: number): Pose => ({
  position: [0, extent * 1.75 + 8, 0.05],
  target: [0, 0, 0],
});

/** Abstand der Übersichtskamera zum Ursprung (für den Nebel). */
export const overviewDistance = (extent: number) => Math.hypot(extent + 11, extent * 1.38 + 16);

/** Quartier wie einen Ordner öffnen: Blick auf Nebenplatz und Häuser von der Seite der Zentrale. */
export function quarterPose(layout: VillageLayout, id: FachbereichId, view: ViewMode): Pose {
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

/** Haus: vor dem Gartentor, 6.5 m nach aussen, Blick auf das Grundstück. */
export function housePose(layout: VillageLayout, id: string, view: ViewMode): Pose {
  const h = layout.houses[id];
  if (!h) return view === "karte" ? mapPose(layout.extent) : overviewPose(layout.extent);
  if (view === "karte") return { position: [h.x, 30, h.z + 0.01], target: [h.x, 0, h.z] };
  const dx = Math.sin(h.angle);
  const dz = Math.cos(h.angle);
  const gate = h.plot ? h.plot.front : h.footprint * 2;
  return {
    position: [h.x + dx * (gate + 6.5), 3.4 + h.footprint * 0.7, h.z + dz * (gate + 6.5)],
    target: [h.x + dx * gate * 0.45, 1.1, h.z + dz * gate * 0.45],
  };
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

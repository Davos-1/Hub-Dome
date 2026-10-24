"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { planFlight, type Flight, type Obstacle } from "@/lib/camera-flight";
import { poseFor, shiftPose, type Pose, type PoseOpts } from "@/lib/camera-poses";
import type { VillageLayout } from "@/lib/layout";
import { hudLayout } from "./hud/layout";
import type { OverlayStore } from "./overlay-store";
import { useScene, type SceneStore } from "./scene-store";

/** Höhe des Welt-Streifens über Inventar und Einstellungen (Pixel). */
export const STRIP = 150;

/**
 * Hochformat (Handy): Kamera weiter weg und steiler von oben, damit das runde Dorf das hohe Bild füllt statt
 * eines breiten Streifens unter viel Himmel. Ansichten auf Augenhöhe bleiben, wie sie sind (sonst stünde die
 * Kamera in einem Haus).
 */
function fitPortrait(p: Pose, aspect: number, maxK: number): Pose {
  if (aspect >= 1 || p.position[1] < 4) return p;
  const t = new THREE.Vector3(...p.target);
  const s = new THREE.Spherical().setFromVector3(new THREE.Vector3(...p.position).sub(t));
  const narrow = 1 - aspect;
  s.radius *= Math.min(maxK, 1 + narrow * 1.5);
  s.phi = Math.max(0.12, s.phi * (1 - narrow * 0.5));
  const v = new THREE.Vector3().setFromSpherical(s).add(t);
  return { position: [v.x, v.y, v.z], target: p.target };
}

type Controls = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

/**
 * Fährt die Kamera ruhig zur Pose der aktuellen Ebene (Dorf › Quartier › Haus/Zentrale, 3D oder Karte).
 * Die Fahrt rechnet `planFlight` (Bogen um den Blickpunkt, 2.0–3.2 s je nach Weg und Drehung, weiches Anfahren
 * und Abbremsen); bei `prefers-reduced-motion` springt sie. Häuser und Zentrale werden nach der Hülle des
 * tatsächlichen Modells in den Ausschnitt eingepasst, den `hudLayout` freilässt (Liste links, Tafel rechts,
 * Rand für Sucher und Kacheln). Nach der Fahrt meldet sie «angekommen» (Sucher und Kacheln erscheinen).
 * Es wird nur gerendert, solange die Fahrt läuft.
 */
/**
 * Inventar offen: Die Welt erscheint verkleinert im Streifen oben. Statt die Kamera zu bewegen (die Pan-Grenze
 * würde das abschneiden), wird nur der Bildausschnitt verschoben und der Blickwinkel geweitet.
 */
export function InventoryLens({ store }: { store: SceneStore }) {
  const inv = useScene(store, (s) => s.inv);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    lens(camera, inv, width, height);
    invalidate();
  }, [inv, camera, width, height, invalidate]);
  return null;
}

/** Bildausschnitt für den Inventar-Streifen setzen bzw. zurücksetzen (ausserhalb von React-Werten). */
function lens(camera: THREE.PerspectiveCamera, on: boolean, width: number, height: number) {
  if (on) {
    camera.setViewOffset(width, height, 0, height / 2 - STRIP / 2, width, height);
    camera.zoom = 0.42;
  } else {
    camera.clearViewOffset();
    camera.zoom = 1;
  }
  camera.updateProjectionMatrix();
}

export function CameraRig({
  layout,
  store,
  overlay,
  reducedMotion,
  hullOf,
}: {
  layout: VillageLayout;
  store: SceneStore;
  overlay: OverlayStore;
  reducedMotion: boolean;
  hullOf?: PoseOpts["hullOf"];
}) {
  // Hohe Bauten, über die die Fahrt mit Abstand hinwegführt: die Zentrale (Höhe aus der Hülle)
  const obstacles = useMemo<Obstacle[]>(() => {
    const z = Object.values(layout.houses).find((h) => !h.plot);
    const pts = z ? hullOf?.(z.id) : null;
    if (!z || !pts?.length) return [];
    const top = Math.max(...pts.map((p) => p[1]));
    return [{ x: z.x, z: z.z, r: z.footprint * 2, top }];
  }, [layout, hullOf]);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);

  const storeNav = useScene(store, (s) => s.nav);
  const focus = useScene(store, (s) => (s.building ? s.buildFocus : null));
  // Bau-Modus: Kamera zum gewählten Quartier (die Navigation selbst bleibt beim Dorf)
  const nav = useMemo<typeof storeNav>(
    () => (focus && storeNav.level === "dorf" ? { level: "quartier", q: focus } : storeNav),
    [focus, storeNav],
  );
  const view = useScene(store, (s) => s.view);
  const intro = useScene(store, (s) => s.intro);
  const devPose = useScene(store, (s) => s.devPose);
  const listW = useScene(store, (s) => s.listW);
  const tafelOpen = useScene(store, (s) => s.tafel !== null);
  const inv = useScene(store, (s) => s.inv);
  const flyNonce = useScene(store, (s) => s.flyNonce);
  // Hochformat (Handy): weiter zurück und steiler, damit das Dorf das Bild füllt
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const aspect = width / Math.max(1, height);
  const pose: Pose = useMemo(() => {
    if (devPose) return fitPortrait(devPose, aspect, 2);
    const hud = hudLayout({
      width,
      height,
      listW,
      level: nav.level,
      tafel: tafelOpen,
      strip: inv ? STRIP : undefined,
    });
    // Haus, Zentrale und Quartier sind schon für Seitenverhältnis und freien Ausschnitt eingepasst
    const fitted = nav.level !== "dorf" && !inv;
    const raw = poseFor(layout, inv ? { level: "dorf" } : nav, view, {
      aspect,
      frame: hud.frame,
      hullOf,
    });
    // Übersicht: in die Mitte der freien Fläche verschieben (Liste links); im Inventar übernimmt die
    // Bildverschiebung der Kamera (`InventoryLens`) den Streifen oben
    const p = fitted || inv ? raw : shiftPose(fitPortrait(raw, aspect, 2), hud.frame, aspect);
    // Einstieg: weit draussen beginnen, nach dem Start-Dialog zur Übersicht einfliegen
    return intro
      ? { position: p.position.map((c) => c * 1.45) as [number, number, number], target: p.target }
      : p;
    // flyNonce: gleiche Pose erneut anfliegen (z.B. nach «Kamera bleibt stehen»)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layout,
    nav,
    view,
    intro,
    devPose,
    aspect,
    width,
    height,
    hullOf,
    listW,
    tafelOpen,
    inv,
    flyNonce,
  ]);

  const anim = useRef<{ t: number; flight: Flight } | null>(null);
  const first = useRef(true);

  // Haus der aktuellen Ebene: Ziel von «angekommen»
  const navHouse = () => {
    const n = store.get().nav;
    return n.level === "haus" ? n.h : null;
  };

  useEffect(() => {
    if (!controls) return;
    // Klick auf den Rasen: Auswahl weg, Kamera bleibt, wo sie ist
    if (store.get().camHold) {
      store.set({ camHold: false });
      anim.current = null;
      overlay.set({ flying: false, arrived: null });
      return;
    }
    if (first.current || reducedMotion) {
      first.current = false;
      camera.position.set(...pose.position);
      controls.target.set(...pose.target);
      controls.update();
      invalidate();
      overlay.set({ flying: false, arrived: navHouse() });
      return;
    }
    // Von der aktuellen Lage aus (auch mitten in einer anderen Fahrt) zur neuen Pose
    const from: Pose = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
    anim.current = { t: 0, flight: planFlight(from, pose, obstacles) };
    // Ein anderes Haus: Sucher und Kacheln erst nach der Ankunft; dasselbe Haus: sie gleiten mit
    const o = overlay.get();
    overlay.set({ flying: true, arrived: o.arrived === navHouse() ? o.arrived : null });
    invalidate();
    // Nur eine neue Pose startet eine Fahrt (nicht neue Hindernisse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, controls, camera, reducedMotion, invalidate]);

  // Schwenken (Pan) auf das Dorf begrenzen (nicht in der Kartenansicht: dort ist die Höhe wichtig).
  useEffect(() => {
    if (!controls) return;
    const limit = layout.extent + 6;
    const clamp = () => {
      const t = controls.target;
      const d = Math.hypot(t.x, t.z);
      if (d > limit) {
        t.x = (t.x / d) * limit;
        t.z = (t.z / d) * limit;
      }
      t.y = Math.min(Math.max(t.y, 0), 6);
    };
    controls.addEventListener("change", clamp);
    return () => controls.removeEventListener("change", clamp);
  }, [controls, layout.extent]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !controls) return;
    // Lange Frames (Tab im Hintergrund) nicht als Sprung übernehmen
    a.t = Math.min(1, a.t + Math.min(delta, 0.1) / a.flight.duration);
    const p = a.flight.at(a.t);
    controls.target.set(...p.target);
    camera.position.set(...p.position);
    controls.update();
    if (a.t >= 1) {
      anim.current = null;
      overlay.set({ flying: false, arrived: navHouse() });
    } else invalidate();
  });

  return null;
}

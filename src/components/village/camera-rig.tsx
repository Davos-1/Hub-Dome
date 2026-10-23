"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { planFlight, type Flight, type Obstacle } from "@/lib/camera-flight";
import { poseFor, type Pose, type PoseOpts } from "@/lib/camera-poses";
import type { VillageLayout } from "@/lib/layout";
import { freeFrame } from "./hud/insets";
import { useScene, type SceneStore } from "./scene-store";

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
 * tatsächlichen Modells in den freien Bildausschnitt eingepasst (Fenster rechts bzw. Blatt unten ausgespart).
 * Es wird nur gerendert, solange die Fahrt läuft.
 */
export function CameraRig({
  layout,
  store,
  reducedMotion,
  hullOf,
}: {
  layout: VillageLayout;
  store: SceneStore;
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

  const nav = useScene(store, (s) => s.nav);
  const view = useScene(store, (s) => s.view);
  const intro = useScene(store, (s) => s.intro);
  const devPose = useScene(store, (s) => s.devPose);
  // Hochformat (Handy): weiter zurück und steiler, damit das Dorf das Bild füllt
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const aspect = width / Math.max(1, height);
  const pose: Pose = useMemo(() => {
    if (devPose) return fitPortrait(devPose, aspect, 2);
    // Haus, Zentrale und Quartier sind schon für Seitenverhältnis und freien Ausschnitt eingepasst
    const fitted = nav.level !== "dorf";
    const raw = poseFor(layout, nav, view, {
      aspect,
      frame: freeFrame(width, height, nav.level !== "dorf"),
      hullOf,
    });
    const p = fitted ? raw : fitPortrait(raw, aspect, 2);
    // Einstieg: weit draussen beginnen, nach dem Start-Dialog zur Übersicht einfliegen
    return intro
      ? { position: p.position.map((c) => c * 1.45) as [number, number, number], target: p.target }
      : p;
  }, [layout, nav, view, intro, devPose, aspect, width, height, hullOf]);

  const anim = useRef<{ t: number; flight: Flight } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    if (first.current || reducedMotion) {
      first.current = false;
      camera.position.set(...pose.position);
      controls.target.set(...pose.target);
      controls.update();
      invalidate();
      return;
    }
    // Von der aktuellen Lage aus (auch mitten in einer anderen Fahrt) zur neuen Pose
    const from: Pose = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
    anim.current = { t: 0, flight: planFlight(from, pose, obstacles) };
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
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return null;
}

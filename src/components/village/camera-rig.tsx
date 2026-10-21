"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { poseFor, type Pose } from "@/lib/camera-poses";
import type { VillageLayout } from "@/lib/layout";
import { useScene, type SceneStore } from "./scene-store";

const DURATION = 0.9;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

type Controls = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

/**
 * Fährt die Kamera sanft zur Pose der aktuellen Ebene (Dorf › Quartier › Haus, 3D oder Karte). Übergang
 * 0.9 s, ease-out; bei `prefers-reduced-motion` sofort. Es wird nur gerendert, solange die Fahrt läuft.
 */
export function CameraRig({
  layout,
  store,
  reducedMotion,
}: {
  layout: VillageLayout;
  store: SceneStore;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);

  const nav = useScene(store, (s) => s.nav);
  const view = useScene(store, (s) => s.view);
  const intro = useScene(store, (s) => s.intro);
  const pose: Pose = useMemo(() => {
    const p = poseFor(layout, nav, view);
    // Einstieg: weit draussen beginnen, nach dem Start-Dialog zur Übersicht einfliegen
    return intro
      ? { position: p.position.map((c) => c * 1.45) as [number, number, number], target: p.target }
      : p;
  }, [layout, nav, view, intro]);

  const anim = useRef<{
    t: number;
    from: THREE.Vector3;
    fromTarget: THREE.Vector3;
    to: Pose;
  } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    const to = new THREE.Vector3(...pose.position);
    const target = new THREE.Vector3(...pose.target);
    if (first.current || reducedMotion) {
      first.current = false;
      camera.position.copy(to);
      controls.target.copy(target);
      controls.update();
      invalidate();
      return;
    }
    anim.current = {
      t: 0,
      from: camera.position.clone(),
      fromTarget: controls.target.clone(),
      to: pose,
    };
    invalidate();
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
    a.t = Math.min(1, a.t + delta / DURATION);
    const k = ease(a.t);
    camera.position.lerpVectors(a.from, new THREE.Vector3(...a.to.position), k);
    controls.target.lerpVectors(a.fromTarget, new THREE.Vector3(...a.to.target), k);
    controls.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return null;
}

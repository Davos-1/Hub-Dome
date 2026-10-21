"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { HouseLayout } from "@/lib/layout";

type Pose = { position: THREE.Vector3; target: THREE.Vector3 };

/** Kameraposition für die Übersicht. */
export function overviewPose(extent: number): Pose {
  return {
    position: new THREE.Vector3(0, extent * 0.75 + 9, extent * 0.95 + 13),
    target: new THREE.Vector3(0, 0, 0),
  };
}

/** Kamera steht zwischen Zentrale und Haus und blickt auf die Hausfront samt Objekten. */
export function housePose(h: HouseLayout): Pose {
  const dx = Math.sin(h.angle);
  const dz = Math.cos(h.angle);
  const back = h.footprint + 8;
  return {
    position: new THREE.Vector3(h.x + dx * back, 5.5 + h.footprint, h.z + dz * back),
    target: new THREE.Vector3(h.x + dx * 0.8, 1.4, h.z + dz * 0.8),
  };
}

const DURATION = 0.9;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Fährt die Kamera sanft zum Ziel (frameloop="demand": es wird nur gerendert, solange die Fahrt läuft).
 * Bei `prefers-reduced-motion` springt die Kamera ohne Fahrt.
 */
export function CameraRig({
  pose,
  reducedMotion,
  extent,
}: {
  pose: Pose;
  reducedMotion: boolean;
  extent: number;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  } | null;
  const invalidate = useThree((s) => s.invalidate);

  const anim = useRef<{
    t: number;
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    pose: Pose;
  } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    if (first.current) {
      first.current = false;
      return; // Startpose kommt aus der Canvas-Kamera
    }
    if (reducedMotion) {
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      controls.update();
      invalidate();
      return;
    }
    anim.current = {
      t: 0,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      pose,
    };
    invalidate();
  }, [pose, controls, camera, reducedMotion, invalidate]);

  // Schwenken (Pan) auf das Dorf begrenzen.
  useEffect(() => {
    if (!controls) return;
    const limit = extent + 6;
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
  }, [controls, extent]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + delta / DURATION);
    const k = ease(a.t);
    camera.position.lerpVectors(a.fromPos, a.pose.position, k);
    controls.target.lerpVectors(a.fromTarget, a.pose.target, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return null;
}

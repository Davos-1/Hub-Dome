"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { poseFor, type Pose } from "@/lib/camera-poses";
import type { VillageLayout } from "@/lib/layout";
import { useScene, type SceneStore } from "./scene-store";

const DURATION = 0.9;
/** Zusatzdauer bei einer halben Umrundung (Drehung um 180°). */
const EXTRA_PER_HALF_TURN = 0.6;
/** Fast senkrechter Blick (Karte): kein Schwenk um das Ziel, sonst entsteht eine Spirale. */
const TOP_DOWN_PHI = 0.2;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Kürzester Drehweg von a nach b (−π…π). */
const angleDelta = (a: number, b: number) => {
  const d = (b - a) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};

type Controls = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

/**
 * Fährt die Kamera sanft zur Pose der aktuellen Ebene (Dorf › Quartier › Haus, 3D oder Karte). Übergang
 * im Bogen um das Ziel, 0.9–1.5 s je nach Drehwinkel, ease-in-out; bei `prefers-reduced-motion` sofort. Es wird nur gerendert, solange die Fahrt läuft.
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
    duration: number;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    /** Versatz Kamera − Ziel in Kugelkoordinaten, am Anfang und am Ende. */
    fromOff: THREE.Spherical;
    toOff: THREE.Spherical;
    turn: number;
    lift: number;
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
    // Kamera im Bogen um das Ziel führen (Kugelkoordinaten) statt geradeaus: der Blick bleibt
    // während der ganzen Fahrt auf dem Ziel, am Ende dreht sie nicht mehr ruckartig nach.
    const fromTarget = controls.target.clone();
    const fromOff = new THREE.Spherical().setFromVector3(camera.position.clone().sub(fromTarget));
    const toOff = new THREE.Spherical().setFromVector3(to.clone().sub(target));
    const topDown = fromOff.phi < TOP_DOWN_PHI || toOff.phi < TOP_DOWN_PHI;
    const turn = topDown ? 0 : angleDelta(fromOff.theta, toOff.theta);
    const share = Math.abs(turn) / Math.PI;
    anim.current = {
      t: 0,
      duration: DURATION + EXTRA_PER_HALF_TURN * share,
      fromTarget,
      toTarget: target,
      fromOff,
      toOff,
      turn,
      lift: share * 0.25 * Math.max(fromOff.radius, toOff.radius),
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
    a.t = Math.min(1, a.t + delta / a.duration);
    const k = ease(a.t);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    const theta =
      a.turn === 0
        ? THREE.MathUtils.lerp(a.fromOff.theta, a.toOff.theta, k)
        : a.fromOff.theta + a.turn * k;
    const off = new THREE.Spherical(
      THREE.MathUtils.lerp(a.fromOff.radius, a.toOff.radius, k),
      THREE.MathUtils.lerp(a.fromOff.phi, a.toOff.phi, k),
      theta,
    );
    // In der Mitte des Bogens etwas höher, damit er nicht durch Dächer und Bäume führt.
    const lift = new THREE.Vector3(0, Math.sin(Math.PI * k) * a.lift, 0);
    camera.position.setFromSpherical(off).add(controls.target).add(lift);
    controls.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return null;
}

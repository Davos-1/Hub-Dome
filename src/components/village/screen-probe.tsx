"use client";

import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/camera-poses";
import type { Rect } from "./hud/layout";
import type { OverlayStore } from "./overlay-store";
import type { SceneStore } from "./scene-store";

type Controls = { target: THREE.Vector3; update: () => void };

/**
 * Rechnet Hüllen in Bildschirmpixel um. Veränderlicher Zustand (Hilfsvektor) lebt in dieser Klasse, nicht in
 * React (React-Compiler: Hook-Werte im `useFrame` nicht verändern).
 */
class Projector {
  private readonly v = new THREE.Vector3();

  rect(points: Vec3[] | null, camera: THREE.Camera, w: number, h: number): Rect | null {
    if (!points?.length) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      this.v.set(p[0], p[1], p[2]).project(camera);
      // Hinter der Kamera: keine sinnvolle Lage auf dem Bildschirm
      if (this.v.z > 1) return null;
      const x = ((this.v.x + 1) / 2) * w;
      const y = ((1 - this.v.y) / 2) * h;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Kamera entlang der Blickrichtung näher bzw. weiter weg (Zoomregler). */
  dolly(camera: THREE.Camera, controls: Controls, factor: number, min: number, max: number) {
    this.v.copy(camera.position).sub(controls.target);
    const d = this.v.length();
    const next = Math.min(max, Math.max(min, d * factor));
    this.v.setLength(next);
    camera.position.copy(controls.target).add(this.v);
    controls.update();
  }

  zoom(camera: THREE.Camera, controls: Controls, min: number, max: number) {
    const d = camera.position.distanceTo(controls.target);
    return Math.min(1, Math.max(0, (d - min) / (max - min)));
  }
}

/**
 * Meldet der Oberfläche, wo das gewählte und das überfahrene Haus auf dem Bildschirm stehen (Sucher, Kacheln,
 * Tooltip) und wie weit die Kamera weg ist (Zoomregler). Läuft nur bei gezeichneten Bildern, also nur, wenn
 * sich die Kamera bewegt; Hover-Wechsel ohne Bewegung werden sofort nachgerechnet.
 */
export function ScreenProbe({
  store,
  overlay,
  hullOf,
  minDistance,
  maxDistance,
}: {
  store: SceneStore;
  overlay: OverlayStore;
  hullOf: (id: string) => Vec3[] | null;
  minDistance: number;
  maxDistance: number;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const [projector] = useState(() => new Projector());

  useEffect(() => {
    const measure = () => {
      const s = store.get();
      const sel =
        s.nav.level === "haus" ? projector.rect(hullOf(s.nav.h), camera, width, height) : null;
      const hover = s.hoverHouseId
        ? projector.rect(hullOf(s.hoverHouseId), camera, width, height)
        : null;
      overlay.set({
        sel,
        hover,
        ...(controls ? { zoom: projector.zoom(camera, controls, minDistance, maxDistance) } : {}),
      });
    };
    measure();
    const off = store.subscribe(measure);
    return () => {
      off();
    };
  }, [
    store,
    overlay,
    hullOf,
    projector,
    camera,
    controls,
    width,
    height,
    minDistance,
    maxDistance,
  ]);

  useEffect(() => {
    if (!controls) return;
    overlay.registerZoom((factor) => {
      projector.dolly(camera, controls, factor, minDistance, maxDistance);
      invalidate();
    });
    return () => overlay.registerZoom(null);
  }, [overlay, projector, camera, controls, minDistance, maxDistance, invalidate]);

  useFrame(() => {
    const s = store.get();
    overlay.set({
      sel: s.nav.level === "haus" ? projector.rect(hullOf(s.nav.h), camera, width, height) : null,
      hover: s.hoverHouseId ? projector.rect(hullOf(s.hoverHouseId), camera, width, height) : null,
      ...(controls ? { zoom: projector.zoom(camera, controls, minDistance, maxDistance) } : {}),
    });
  });

  return null;
}

"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { overviewDistance } from "@/lib/camera-poses";
import { TIMES, type TimeKey } from "@/lib/daytime";

/**
 * Himmel, Nebel, Sonne und Hemisphärenlicht nach Tageszeit (ohne Neuaufbau der Szene).
 * In der Kartenansicht entfällt der Nebel.
 */
export function Daylight({
  time,
  extent,
  map,
  lowDetail,
}: {
  time: TimeKey;
  extent: number;
  map: boolean;
  lowDetail: boolean;
}) {
  const p = TIMES[time];
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const sky = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, p.sky[0]);
    g.addColorStop(0.55, p.sky[1]);
    g.addColorStop(1, p.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [p]);
  useEffect(() => () => sky.dispose(), [sky]);

  useEffect(() => {
    // Belichtung des Renderers pro Tageszeit (kein React-State, daher direkt setzen)
    // eslint-disable-next-line react-hooks/immutability
    gl.toneMappingExposure = p.exposure;
    invalidate();
  }, [gl, p.exposure, invalidate]);

  const d0 = overviewDistance(extent);
  return (
    <>
      <primitive object={sky} attach="background" />
      {!map && <fog attach="fog" args={[p.sky[2], d0 + extent * 0.4, d0 + extent * 2.2]} />}
      <hemisphereLight args={[p.hemi.sky, p.hemi.ground, p.hemi.intensity]} />
      <directionalLight
        position={[p.sunPosition[0] * extent, p.sunPosition[1] * extent, p.sunPosition[2] * extent]}
        intensity={p.sunIntensity}
        color={p.sun}
        castShadow={!lowDetail}
        shadow-mapSize={[4096, 4096]}
        shadow-radius={3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={extent * 4}
        shadow-camera-left={-(extent + 14)}
        shadow-camera-right={extent + 14}
        shadow-camera-top={extent + 14}
        shadow-camera-bottom={-(extent + 14)}
      />
    </>
  );
}

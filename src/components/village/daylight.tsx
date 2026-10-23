"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import { TIMES, type TimeKey, type TimePreset } from "@/lib/daytime";
import { setWaterSky } from "./life/water-sky";

/**
 * Himmel, Nebel, Sonne und Hemisphärenlicht nach Tageszeit (ohne Neuaufbau der Szene).
 * In der Kartenansicht entfällt der Nebel.
 */
export function Daylight({
  time,
  extent,
  map,
  lowDetail,
  tint = 0,
}: {
  time: TimeKey;
  extent: number;
  map: boolean;
  lowDetail: boolean;
  /** Farbton der Welt (v2): −1 kühl … +1 warm; verschiebt Himmel und Sonne leicht. */
  tint?: number;
}) {
  const p = useMemo(() => tinted(TIMES[time], tint), [time, tint]);
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

  // Himmel als Umgebung fürs Wasser (Spiegelung): Zenit oben, Horizont in der Mitte, Boden unten
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, p.sky[0]);
    g.addColorStop(0.3, p.sky[1]);
    g.addColorStop(0.5, p.sky[2]);
    g.addColorStop(0.56, p.hemi.ground);
    g.addColorStop(1, p.hemi.ground);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 64);
    const equi = new THREE.CanvasTexture(c);
    equi.mapping = THREE.EquirectangularReflectionMapping;
    equi.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromEquirectangular(equi).texture;
    equi.dispose();
    pmrem.dispose();
    setWaterSky(env);
    invalidate();
    return () => {
      setWaterSky(null);
      env.dispose();
    };
  }, [gl, p, invalidate]);

  useEffect(() => {
    // Belichtung des Renderers pro Tageszeit (kein React-State, daher direkt setzen)
    // eslint-disable-next-line react-hooks/immutability
    gl.toneMappingExposure = p.exposure;
    invalidate();
  }, [gl, p.exposure, invalidate]);

  return (
    <>
      <primitive object={sky} attach="background" />
      {time === "nacht" && !map && (
        <NightSky
          moon={[p.sunPosition[0] * 420, p.sunPosition[1] * 420, p.sunPosition[2] * 420]}
          count={lowDetail ? 260 : 700}
        />
      )}
      {/* Luftperspektive: exponentieller Dunst; das Dorf bleibt klar, Berge werden nach hinten heller */}
      {!map && <fogExp2 attach="fog" args={[p.sky[2], FOG_DENSITY]} />}
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

/** Dichte des Dunsts: bei 150 m kaum spürbar (6 %), bei 400 m ein Drittel, bei 700 m rund 70 %. */
const FOG_DENSITY = 0.0016;

/** Tageszeit leicht getönt: warm Richtung Pfirsich, kühl Richtung Blau (höchstens 10 %). */
function tinted(p: TimePreset, tint: number): TimePreset {
  if (!tint) return p;
  const to = new THREE.Color(tint > 0 ? "#ffcf9e" : "#9ec2ff");
  const k = Math.min(1, Math.abs(tint)) * 0.1;
  const mix = (c: string) => "#" + new THREE.Color(c).lerp(to, k).getHexString();
  return {
    ...p,
    sky: [mix(p.sky[0]), mix(p.sky[1]), mix(p.sky[2])],
    sun: mix(p.sun),
    hemi: { ...p.hemi, sky: mix(p.hemi.sky) },
  };
}

/**
 * Sternenhimmel und Mond (nur nachts). Sterne liegen auf einer grossen Kuppel über dem Horizont, ohne
 * Nebel, immer gleich (fester Zufall). Der Mond steht dort, woher das Mondlicht kommt.
 */
function NightSky({ moon, count }: { moon: [number, number, number]; count: number }) {
  const stars = useMemo(() => {
    const r = seededRandom("sterne");
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // gleichmässig auf der Kuppel, nicht zu nah am Horizont (dort liegt der Nebel)
      const az = r() * Math.PI * 2;
      const el = Math.asin(0.12 + r() * 0.88);
      const R = 600;
      pos[i * 3] = Math.cos(az) * Math.cos(el) * R;
      pos[i * 3 + 1] = Math.sin(el) * R;
      pos[i * 3 + 2] = Math.sin(az) * Math.cos(el) * R;
      const b = 0.55 + r() * 0.45;
      tint.set(r() < 0.15 ? "#ffe2b8" : r() < 0.3 ? "#cfe0ff" : "#ffffff").multiplyScalar(b);
      col[i * 3] = tint.r;
      col[i * 3 + 1] = tint.g;
      col[i * 3 + 2] = tint.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);
  useEffect(() => () => stars.dispose(), [stars]);
  // Mondscheibe in Richtung des Mondlichts, aber tiefer am Himmel (sonst sieht ihn keine Kamera)
  const h = Math.hypot(moon[0], moon[2]);
  const el = 0.36;
  const at: [number, number, number] = [
    (moon[0] / h) * Math.cos(el) * 560,
    Math.sin(el) * 560,
    (moon[2] / h) * Math.cos(el) * 560,
  ];
  return (
    <group>
      <points geometry={stars} frustumCulled={false} renderOrder={-1}>
        <pointsMaterial
          vertexColors
          size={2.2}
          sizeAttenuation={false}
          fog={false}
          depthWrite={false}
          transparent
          opacity={0.9}
        />
      </points>
      <mesh position={at} renderOrder={-1}>
        <sphereGeometry args={[16, 24, 16]} />
        <meshBasicMaterial color="#f4f1e2" fog={false} />
      </mesh>
      <mesh position={at} renderOrder={-1}>
        <sphereGeometry args={[30, 24, 16]} />
        <meshBasicMaterial
          color="#9fb3ff"
          fog={false}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

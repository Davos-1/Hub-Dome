"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Daylight } from "@/components/village/daylight";
import { dekoParts } from "@/components/village/deko-models";
import { mergeParts } from "@/components/village/geo";
import { DEKO, DEKO_TYPEN, type DekoForm, type DekoTyp } from "@/lib/world/catalog";
import { PALETTES, STIMMUNG_LABELS, type Palette, type Stimmung } from "@/lib/world/map";

declare global {
  interface Window {
    /** Galerie fertig gezeichnet (für Screenshots). */
    __dekoReady?: boolean;
  }
}

const COLS = 5;
const DX = 4.2;
const DZ = 5.2;

/** Platz eines Elements im Raster: Reihen von hinten nach vorne, die letzte Reihe zentriert. */
function slot(i: number) {
  const row = Math.floor(i / COLS);
  const inRow = Math.min(COLS, DEKO_TYPEN.length - row * COLS);
  return { x: ((i % COLS) - (inRow - 1) / 2) * DX, z: (row - 1) * DZ };
}
const STEG = slot(DEKO_TYPEN.indexOf("steg"));
const OVERVIEW_TARGET: [number, number, number] = [0, 0.3, 2.6];
const POND = { w: 3.4, d: 3.6 };

type Geos = { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null; tris: number };

function buildGeos(typ: DekoTyp, palette: Palette): Geos {
  const { body, glow } = dekoParts(typ, palette);
  const b = mergeParts(body);
  const g = glow.length ? mergeParts(glow) : null;
  const tris = (b.attributes.position.count + (g?.attributes.position.count ?? 0)) / 3;
  return { body: b, glow: g, tris };
}

function useGeos(typ: DekoTyp, palette: Palette): Geos {
  const geos = useMemo(() => buildGeos(typ, palette), [typ, palette]);
  useEffect(
    () => () => {
      geos.body.dispose();
      geos.glow?.dispose();
    },
    [geos],
  );
  return geos;
}

/** Grundfläche als dünner halbtransparenter Umriss mit schwacher Füllung. */
export function Footprint({ form }: { form: DekoForm }) {
  const { outline, fill } = useMemo(() => {
    if (form.kind === "circle") {
      return {
        outline: new THREE.RingGeometry(form.r - 0.03, form.r, 72),
        fill: new THREE.CircleGeometry(form.r, 48),
      };
    }
    const { hw, hd } = form;
    const s = new THREE.Shape();
    s.moveTo(-hw, -hd);
    s.lineTo(hw, -hd);
    s.lineTo(hw, hd);
    s.lineTo(-hw, hd);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-hw + 0.03, -hd + 0.03);
    hole.lineTo(-hw + 0.03, hd - 0.03);
    hole.lineTo(hw - 0.03, hd - 0.03);
    hole.lineTo(hw - 0.03, -hd + 0.03);
    hole.closePath();
    s.holes.push(hole);
    return { outline: new THREE.ShapeGeometry(s), fill: new THREE.PlaneGeometry(hw * 2, hd * 2) };
  }, [form]);
  useEffect(
    () => () => {
      outline.dispose();
      fill.dispose();
    },
    [outline, fill],
  );
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <mesh geometry={fill} position={[0, 0, 0.012]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh geometry={outline} position={[0, 0, 0.016]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Element({ typ, palette, x, z }: { typ: DekoTyp; palette: Palette; x: number; z: number }) {
  const geos = useGeos(typ, palette);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geos.body} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      {geos.glow && (
        <mesh geometry={geos.glow}>
          <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={0.85} />
        </mesh>
      )}
      <Footprint form={DEKO[typ].form} />
    </group>
  );
}

/** Wiese mit einem Loch für den Teich am Steg; darunter Teichwände und Wasserfläche. */
function Meadow({ color }: { color: string }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-80, -60);
    s.lineTo(80, -60);
    s.lineTo(80, 60);
    s.lineTo(-80, 60);
    s.closePath();
    // Shape-y entspricht −z der Welt
    const z0 = STEG.z - 0.2;
    const hole = new THREE.Path();
    hole.moveTo(STEG.x - POND.w / 2, -z0);
    hole.lineTo(STEG.x - POND.w / 2, -(z0 + POND.d));
    hole.lineTo(STEG.x + POND.w / 2, -(z0 + POND.d));
    hole.lineTo(STEG.x + POND.w / 2, -z0);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const cz = STEG.z - 0.2 + POND.d / 2;
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[STEG.x, -0.4, cz]}>
        <boxGeometry args={[POND.w + 0.04, 0.8, POND.d + 0.04]} />
        <meshStandardMaterial color="#6b5240" side={THREE.BackSide} />
      </mesh>
      <mesh position={[STEG.x, -0.1, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[POND.w, POND.d]} />
        <meshStandardMaterial color="#5f9fc6" transparent opacity={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Richtet die Kamera sofort auf das Ziel aus (die Steuerung tut das erst bei der ersten Bewegung). */
export function Aim({ target }: { target: [number, number, number] }) {
  const camera = useThree((st) => st.camera);
  useLayoutEffect(() => {
    camera.lookAt(...target);
  }, [camera, target]);
  return null;
}

/** Meldet nach dem zweiten gezeichneten Frame `window.__dekoReady`. */
export function Ready() {
  const frames = useRef(0);
  useEffect(() => {
    window.__dekoReady = false;
  }, []);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) requestAnimationFrame(() => (window.__dekoReady = true));
    // Falls kein zweiter Frame folgt (Bildschirm im Hintergrund), nach kurzer Zeit trotzdem fertig
    if (frames.current === 1) setTimeout(() => (window.__dekoReady = true), 2500);
  });
  return null;
}

function Label({ typ, palette }: { typ: DekoTyp; palette: Palette }) {
  const tris = useMemo(() => {
    const g = buildGeos(typ, palette);
    g.body.dispose();
    g.glow?.dispose();
    return g.tris;
  }, [typ, palette]);
  const e = DEKO[typ];
  const size =
    e.form.kind === "circle"
      ? `⌀ ${(e.form.r * 2).toFixed(2)} m`
      : `${(e.form.hw * 2).toFixed(2)} × ${(e.form.hd * 2).toFixed(2)} m`;
  return (
    <>
      <span className="font-medium">{e.label}</span>
      <span className="text-neutral-600 block text-xs">
        {size} · {tris} Dreiecke
      </span>
    </>
  );
}

/** Kamera für die Nahansicht eines einzelnen Elements (`?nur=typ`): Abstand nach Grösse der Grundfläche. */
function closeUp(typ: DekoTyp) {
  const f = DEKO[typ].form;
  const size = f.kind === "circle" ? f.r : Math.max(f.hw, f.hd);
  const p = slot(DEKO_TYPEN.indexOf(typ));
  const d = 2.6 + size * 2;
  return {
    target: [p.x, 0.7, p.z] as [number, number, number],
    position: [p.x + d * 0.55, 0.8 + d * 0.55, p.z + d * 0.85] as [number, number, number],
  };
}

/**
 * Entwickler-Galerie: alle Deko-Elemente im Raster auf einer Wiese, Grundfläche als Umriss, Stimmung per URL.
 * Mit `nur` wird die Kamera auf ein einzelnes Element gerichtet (Nahansicht).
 */
export function Gallery({ stimmung, nur }: { stimmung: Stimmung; nur?: DekoTyp }) {
  const palette = PALETTES[stimmung];
  const close = nur ? closeUp(nur) : null;
  const aim = close?.target ?? OVERVIEW_TARGET;
  return (
    <div className="p-4">
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Stimmung">
        <span className="font-medium">Stimmung:</span>
        {(Object.keys(PALETTES) as Stimmung[]).map((s) => (
          <Link
            key={s}
            href={`/dev/deko?stimmung=${s}${nur ? `&nur=${nur}` : ""}`}
            aria-current={s === stimmung ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${s === stimmung ? "bg-foreground text-background" : ""}`}
          >
            {STIMMUNG_LABELS[s]}
          </Link>
        ))}
      </nav>
      <div className="h-[720px] overflow-hidden rounded-xl border" data-testid="deko-canvas">
        <Canvas
          frameloop="demand"
          shadows="percentage"
          dpr={[1, 1.5]}
          camera={{ position: close?.position ?? [0, 11.5, 15.5], fov: 38, near: 0.1, far: 200 }}
        >
          <Daylight time="mittag" extent={16} map lowDetail={false} />
          <Meadow color={palette.lawn} />
          {DEKO_TYPEN.map((typ, i) => {
            const p = slot(i);
            return <Element key={typ} typ={typ} palette={palette} x={p.x} z={p.z} />;
          })}
          <Aim target={aim} />
          <Ready />
          <OrbitControls
            enablePan={false}
            target={aim}
            minDistance={close ? 2 : 6}
            maxDistance={45}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Canvas>
      </div>
      <p className="text-neutral-600 mt-3 text-sm">
        Reihenfolge wie im Raster, von hinten links nach vorne rechts. Weisser Umriss = Grundfläche
        aus dem Katalog. Die Front zeigt zur Kamera (+z).
      </p>
      <ol className="mt-2 grid list-decimal grid-cols-2 gap-x-6 gap-y-2 pl-6 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {DEKO_TYPEN.map((typ) => (
          <li key={typ} data-testid={`deko-${typ}`}>
            <Label typ={typ} palette={palette} />
          </li>
        ))}
      </ol>
    </div>
  );
}

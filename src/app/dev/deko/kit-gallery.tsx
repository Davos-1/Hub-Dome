"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Daylight } from "@/components/village/daylight";
import { mergeParts } from "@/components/village/geo";
import {
  ANBAU_MASSE,
  GARTEN_MASSE,
  anbauParts,
  gartenParts,
  type KitFarben,
} from "@/components/village/kit-models";
import type { Anbau } from "@/lib/world/doc";
import { PALETTES, STIMMUNG_LABELS, type Palette, type Stimmung } from "@/lib/world/map";
import { Aim, Footprint, Ready } from "./gallery";
import { KIT_ANBAUTEN, KIT_FARBSAETZE, KIT_LABELS, KIT_NAMEN, type KitName } from "./kit-namen";

const isAnbau = (name: KitName): name is Exclude<Anbau, "keiner"> =>
  KIT_ANBAUTEN.some((a) => a === name);

/** Platz im Raster: hinten die Anbauten, davor die Gartenstile. */
function slot(name: KitName): { x: number; z: number } {
  const ai = KIT_ANBAUTEN.findIndex((a) => a === name);
  if (ai >= 0) return { x: (ai - (KIT_ANBAUTEN.length - 1) / 2) * 2.8, z: -1.9 };
  const gi = KIT_NAMEN.filter((n) => !isAnbau(n)).findIndex((g) => g === name);
  return { x: (gi - (KIT_NAMEN.length - KIT_ANBAUTEN.length - 1) / 2) * 2.5, z: 1.8 };
}

type Geos = { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null; tris: number };

function buildGeos(name: KitName, palette: Palette, farben: KitFarben): Geos {
  if (isAnbau(name)) {
    const { body, glow } = anbauParts(name, farben);
    const b = mergeParts(body);
    const g = glow.length ? mergeParts(glow) : null;
    return {
      body: b,
      glow: g,
      tris: (b.attributes.position.count + (g?.attributes.position.count ?? 0)) / 3,
    };
  }
  const b = mergeParts(gartenParts(name, palette));
  return { body: b, glow: null, tris: b.attributes.position.count / 3 };
}

function Element({
  name,
  palette,
  farben,
  x,
  z,
}: {
  name: KitName;
  palette: Palette;
  farben: KitFarben;
  x: number;
  z: number;
}) {
  const geos = useMemo(() => buildGeos(name, palette, farben), [name, palette, farben]);
  useEffect(
    () => () => {
      geos.body.dispose();
      geos.glow?.dispose();
    },
    [geos],
  );
  const m = isAnbau(name) ? ANBAU_MASSE : GARTEN_MASSE;
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
      <Footprint form={{ kind: "box", hw: m.hw, hd: m.hd }} />
    </group>
  );
}

function Label({ name, palette, farben }: { name: KitName; palette: Palette; farben: KitFarben }) {
  const tris = useMemo(() => {
    const g = buildGeos(name, palette, farben);
    g.body.dispose();
    g.glow?.dispose();
    return g.tris;
  }, [name, palette, farben]);
  const m = isAnbau(name) ? ANBAU_MASSE : GARTEN_MASSE;
  return (
    <>
      <span className="font-medium">{KIT_LABELS[name]}</span>
      <span className="text-hd-muted block text-xs">
        {(m.hw * 2).toFixed(2)} × {(m.hd * 2).toFixed(2)} m · bis {m.h.toFixed(1)} m · {tris}{" "}
        Dreiecke
      </span>
    </>
  );
}

/** Kamera für die Nahansicht eines einzelnen Elements (`?nur=laube`). */
function closeUp(name: KitName) {
  const p = slot(name);
  const d = 3.4;
  return {
    target: [p.x, 0.85, p.z] as [number, number, number],
    position: [p.x + d * 0.55, 0.9 + d * 0.5, p.z + d * 0.95] as [number, number, number],
  };
}

const OVERVIEW_TARGET: [number, number, number] = [0, 0.5, 0.1];

/**
 * Entwickler-Galerie der Bausatz-Modelle: hinten die drei Anbauten, davor die vier Gartenstile,
 * jeweils mit Grundfläche als Umriss. Stimmung, Farbsatz und Nahansicht per URL.
 */
export function KitGallery({
  stimmung,
  nur,
  farben,
}: {
  stimmung: Stimmung;
  nur?: KitName;
  farben: number;
}) {
  const palette = PALETTES[stimmung];
  const farbSatz = KIT_FARBSAETZE[farben] ?? KIT_FARBSAETZE[0];
  const close = nur ? closeUp(nur) : null;
  const aim = close?.target ?? OVERVIEW_TARGET;
  const query = (s: Stimmung, f: number) =>
    `/dev/deko?ansicht=kit&stimmung=${s}${f ? `&farben=${f + 1}` : ""}${nur ? `&nur=${nur}` : ""}`;
  return (
    <div className="p-4">
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Stimmung">
        <span className="font-medium">Stimmung:</span>
        {(Object.keys(PALETTES) as Stimmung[]).map((s) => (
          <Link
            key={s}
            href={query(s, farben)}
            aria-current={s === stimmung ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${s === stimmung ? "bg-foreground text-background" : ""}`}
          >
            {STIMMUNG_LABELS[s]}
          </Link>
        ))}
        <span className="ml-3 font-medium">Farben:</span>
        {KIT_FARBSAETZE.map((_, f) => (
          <Link
            key={f}
            href={query(stimmung, f)}
            aria-current={f === farben ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${f === farben ? "bg-foreground text-background" : ""}`}
          >
            {f + 1}
          </Link>
        ))}
        <Link href={`/dev/deko?stimmung=${stimmung}`} className="ml-3 underline">
          Deko-Elemente
        </Link>
      </nav>
      <div className="h-[720px] overflow-hidden rounded-xl border" data-testid="kit-canvas">
        <Canvas
          frameloop="demand"
          shadows="percentage"
          dpr={[1, 1.5]}
          camera={{
            position: close?.position ?? [0, 8.2, 9.6],
            fov: 38,
            near: 0.1,
            far: 200,
          }}
        >
          <Daylight time="mittag" extent={16} map lowDetail={false} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[160, 120]} />
            <meshStandardMaterial color={palette.lawn} roughness={1} />
          </mesh>
          {KIT_NAMEN.map((name) => {
            const p = slot(name);
            return (
              <Element key={name} name={name} palette={palette} farben={farbSatz} x={p.x} z={p.z} />
            );
          })}
          <Aim target={aim} />
          <Ready />
          <OrbitControls
            enablePan={false}
            target={aim}
            minDistance={close ? 1.5 : 5}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Canvas>
      </div>
      <p className="text-hd-muted mt-3 text-sm">
        Hinten die Anbauten (Laube, Schuppen, Wintergarten), davor die Gartenstile (Blumen, Gemüse,
        Stein, Obst). Weisser Umriss = Grundfläche. Die Front zeigt zur Kamera (+z).
      </p>
      <ol className="mt-2 grid list-decimal grid-cols-2 gap-x-6 gap-y-2 pl-6 text-sm sm:grid-cols-4">
        {KIT_NAMEN.map((name) => (
          <li key={name} data-testid={`kit-${name}`}>
            <Label name={name} palette={palette} farben={farbSatz} />
          </li>
        ))}
      </ol>
    </div>
  );
}

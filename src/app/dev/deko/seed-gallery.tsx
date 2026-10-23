"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Daylight } from "@/components/village/daylight";
import { mergeParts, type Part } from "@/components/village/geo";
import {
  seedObjectParts,
  stoneBridgeParts,
  willowParts,
} from "@/components/village/seed-object-models";
import { PALETTES, STIMMUNG_LABELS, type Palette, type Stimmung } from "@/lib/world/map";
import { SEED_OBJEKT, spanFor, type SeedForm } from "@/lib/world/seed-objects";
import { Aim, Footprint, Ready } from "./gallery";
import { SEED_REIHENFOLGE, type SeedExtra, type SeedName } from "./seed-namen";

/** Wo die Galerie Wasser zeichnet: `ufer` = vorn (z > 0.3), `quer` = Streifen quer durch die Grundfläche. */
type Water = { kind: "ufer" } | { kind: "quer"; width: number };

type Meta = { label: string; sub: string; form: SeedForm; water: Water | null };

const EXTRA_LABELS: Record<SeedExtra, string> = {
  weide: "Trauerweide (Instanz am Ufer)",
  bruecke: "Steinbogenbrücke (12 m)",
};
const RIVER = 6;
const BRIDGE_SPAN = 12;
const BRIDGE_WATER = 5;
const GAP = 1.8;
const MAX_ROW = 48;

function meta(id: SeedName): Meta {
  if (id === "weide") {
    return {
      label: EXTRA_LABELS.weide,
      sub: "Wurzelbereich",
      form: { kind: "circle", r: 1.6 },
      water: null,
    };
  }
  if (id === "bruecke") {
    return {
      label: EXTRA_LABELS.bruecke,
      sub: "über dem Fluss",
      form: { kind: "box", hw: 1.1, hd: BRIDGE_SPAN / 2 },
      water: { kind: "quer", width: BRIDGE_WATER },
    };
  }
  const e = SEED_OBJEKT[id];
  // Quer-Objekte: halbe Länge aus der Flussbreite (wie in der Welt)
  const form: SeedForm =
    e.lage === "quer" && e.form.kind === "box" ? { ...e.form, hd: spanFor(RIVER) } : e.form;
  const water: Water | null =
    e.lage === "ufer"
      ? { kind: "ufer" }
      : e.lage === "quer"
        ? { kind: "quer", width: RIVER }
        : null;
  return { label: e.name, sub: e.lage, form, water };
}

const extent = (f: SeedForm) =>
  f.kind === "circle" ? { w: f.r * 2, d: f.r * 2 } : { w: f.hw * 2, d: f.hd * 2 };

type Placed = { id: SeedName; x: number; z: number };

/** Regale: von links nach rechts füllen, bei zu grosser Breite neue Zeile; alles um die Mitte zentriert. */
function layout(): { placed: Placed[]; width: number; depth: number } {
  const rows: { ids: SeedName[]; w: number; d: number }[] = [];
  let cur: { ids: SeedName[]; w: number; d: number } = { ids: [], w: 0, d: 0 };
  for (const id of SEED_REIHENFOLGE) {
    const { w, d } = extent(meta(id).form);
    if (cur.ids.length && cur.w + GAP + w > MAX_ROW) {
      rows.push(cur);
      cur = { ids: [], w: 0, d: 0 };
    }
    cur.w += (cur.ids.length ? GAP : 0) + w;
    cur.d = Math.max(cur.d, d);
    cur.ids.push(id);
  }
  rows.push(cur);
  const depth = rows.reduce((s, r) => s + r.d, 0) + GAP * (rows.length - 1);
  const placed: Placed[] = [];
  let z = -depth / 2;
  for (const r of rows) {
    let x = -r.w / 2;
    for (const id of r.ids) {
      const { w } = extent(meta(id).form);
      placed.push({ id, x: x + w / 2, z: z + r.d / 2 });
      x += w + GAP;
    }
    z += r.d + GAP;
  }
  return { placed, width: Math.max(...rows.map((r) => r.w)), depth };
}

const LAYOUT = layout();
const SLOT = new Map(LAYOUT.placed.map((p) => [p.id, p]));

type Built = {
  id: SeedName;
  m: Meta;
  body: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
  tris: number;
};

function partsFor(id: SeedName, palette: Palette): { body: Part[]; glow: Part[] } {
  if (id === "weide") return { body: willowParts(), glow: [] };
  if (id === "bruecke") return { body: stoneBridgeParts(BRIDGE_SPAN), glow: [] };
  return seedObjectParts(id, palette, { hd: spanFor(RIVER), water: RIVER });
}

function build(id: SeedName, palette: Palette): Built {
  const { body, glow } = partsFor(id, palette);
  const b = mergeParts(body);
  const g = glow.length ? mergeParts(glow) : null;
  const tris = (b.attributes.position.count + (g?.attributes.position.count ?? 0)) / 3;
  return { id, m: meta(id), body: b, glow: g, tris };
}

function useBuilt(palette: Palette): Built[] {
  const items = useMemo(() => SEED_REIHENFOLGE.map((id) => build(id, palette)), [palette]);
  useEffect(
    () => () => {
      for (const i of items) {
        i.body.dispose();
        i.glow?.dispose();
      }
    },
    [items],
  );
  return items;
}

/** Rechteck der Wasserfläche eines Objekts (Weltkoordinaten): x0, x1, z0, z1. */
function waterRect(id: SeedName): { x0: number; x1: number; z0: number; z1: number } | null {
  const { water, form } = meta(id);
  const s = SLOT.get(id)!;
  if (!water || form.kind !== "box") return null;
  const hw = form.hw + 0.6;
  if (water.kind === "ufer") {
    return { x0: s.x - hw, x1: s.x + hw, z0: s.z + 0.3, z1: s.z + form.hd + 0.6 };
  }
  return { x0: s.x - hw, x1: s.x + hw, z0: s.z - water.width / 2, z1: s.z + water.width / 2 };
}

const WATER_RECTS = SEED_REIHENFOLGE.flatMap((id) => {
  const r = waterRect(id);
  return r ? [r] : [];
});

/** Wiese mit rechteckigen Löchern für die Wasserflächen; darunter Becken und darüber die Oberfläche bei y = 0.05. */
function Meadow({ color }: { color: string }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-90, -70);
    s.lineTo(90, -70);
    s.lineTo(90, 70);
    s.lineTo(-90, 70);
    s.closePath();
    // Shape-y entspricht −z der Welt
    for (const r of WATER_RECTS) {
      const h = new THREE.Path();
      h.moveTo(r.x0, -r.z0);
      h.lineTo(r.x0, -r.z1);
      h.lineTo(r.x1, -r.z1);
      h.lineTo(r.x1, -r.z0);
      h.closePath();
      s.holes.push(h);
    }
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {WATER_RECTS.map((r, i) => {
        const w = r.x1 - r.x0;
        const d = r.z1 - r.z0;
        const cx = (r.x0 + r.x1) / 2;
        const cz = (r.z0 + r.z1) / 2;
        return (
          <group key={i}>
            <mesh position={[cx, -0.4, cz]}>
              <boxGeometry args={[w + 0.04, 0.8, d + 0.04]} />
              <meshStandardMaterial color="#6b5240" side={THREE.BackSide} />
            </mesh>
            <mesh position={[cx, 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, d]} />
              <meshStandardMaterial color="#5f9fc6" transparent opacity={0.8} roughness={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Item({ item }: { item: Built }) {
  const s = SLOT.get(item.id)!;
  return (
    <group position={[s.x, 0, s.z]}>
      <mesh geometry={item.body} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      {item.glow && (
        <mesh geometry={item.glow}>
          <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={0.85} />
        </mesh>
      )}
      <Footprint form={item.m.form} />
    </group>
  );
}

function sizeText(f: SeedForm) {
  return f.kind === "circle"
    ? `⌀ ${(f.r * 2).toFixed(1)} m`
    : `${(f.hw * 2).toFixed(1)} × ${(f.hd * 2).toFixed(1)} m`;
}

/** Kamera für die Nahansicht eines einzelnen Objekts (`?nur=kapelle`): Abstand nach der Grösse des gebauten Modells. */
function closeUp(item: Built, winkel: number) {
  const p = SLOT.get(item.id)!;
  item.body.computeBoundingBox();
  const b = item.body.boundingBox!;
  const size = b.getSize(new THREE.Vector3());
  const d = 2.5 + Math.max(size.x, size.y * 1.1, size.z * 0.8) * 1.5;
  const cx = p.x + (b.min.x + b.max.x) / 2;
  const cz = p.z + (b.min.z + b.max.z) / 2;
  const ty = Math.max(0.6, b.max.y * 0.4);
  // Standard: schräg von vorne rechts (+z, +x); `winkel` dreht die Kamera um das Objekt (Grad)
  const az = Math.atan2(0.5, 0.85) + (winkel * Math.PI) / 180;
  const h = d * Math.hypot(0.5, 0.85);
  return {
    target: [cx, ty, cz] as [number, number, number],
    position: [cx + Math.sin(az) * h, ty + d * 0.5, cz + Math.cos(az) * h] as [
      number,
      number,
      number,
    ],
  };
}

const OVERVIEW_TARGET: [number, number, number] = [0, 0.3, 0];

/**
 * Entwickler-Galerie der Seed-Objekte: alle 17 Objekte plus Trauerweide und Steinbogenbrücke im Raster auf einer
 * Wiese; Wasser (blau) dort, wo die Lage `ufer` oder `quer` es braucht. Stimmung und Nahansicht per URL.
 */
export function SeedGallery({
  stimmung,
  nur,
  winkel = 0,
}: {
  stimmung: Stimmung;
  nur?: SeedName;
  winkel?: number;
}) {
  const palette = PALETTES[stimmung];
  const items = useBuilt(palette);
  const focus = nur ? items.find((i) => i.id === nur) : undefined;
  const close = focus ? closeUp(focus, winkel) : null;
  const aim = close?.target ?? OVERVIEW_TARGET;
  const ext = Math.max(LAYOUT.width / 1.6, LAYOUT.depth * 1.15);
  const query = (s: Stimmung) =>
    `/dev/deko?ansicht=seed&stimmung=${s}${nur ? `&nur=${nur}` : ""}${nur && winkel ? `&winkel=${winkel}` : ""}`;
  return (
    <div className="p-4">
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Stimmung">
        <span className="font-medium">Stimmung:</span>
        {(Object.keys(PALETTES) as Stimmung[]).map((s) => (
          <Link
            key={s}
            href={query(s)}
            aria-current={s === stimmung ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${s === stimmung ? "bg-foreground text-background" : ""}`}
          >
            {STIMMUNG_LABELS[s]}
          </Link>
        ))}
        <Link href={`/dev/deko?stimmung=${stimmung}`} className="ml-3 underline">
          Deko-Elemente
        </Link>
        <Link href={`/dev/deko?ansicht=kit&stimmung=${stimmung}`} className="underline">
          Bausätze
        </Link>
        {nur && (
          <Link href={query(stimmung).replace(`&nur=${nur}`, "")} className="underline">
            Alle zeigen
          </Link>
        )}
      </nav>
      <div className="h-[720px] overflow-hidden rounded-xl border" data-testid="seed-canvas">
        <Canvas
          frameloop="demand"
          shadows="percentage"
          dpr={[1, 1.5]}
          camera={{
            position: close?.position ?? [0, ext * 0.95, ext * 0.8],
            fov: 38,
            near: 0.1,
            far: 400,
          }}
        >
          <Daylight time="mittag" extent={Math.max(30, ext)} map lowDetail={false} />
          <Meadow color={palette.lawn} />
          {items.map((it) => (
            <Item key={it.id} item={it} />
          ))}
          <Aim target={aim} />
          <Ready />
          <OrbitControls
            target={aim}
            minDistance={close ? 2 : 6}
            maxDistance={140}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Canvas>
      </div>
      <p className="text-hd-muted mt-3 text-sm">
        Wasser (blau) liegt bei Mühle, Fischerhütte und Ruderboot vorn (z &gt; 0.3), bei Fähre, Wehr
        und Brücke als Streifen quer durch die Grundfläche. Weisser Umriss = Grundfläche aus dem
        Katalog. Die Front zeigt zur Kamera (+z). Mit <code>?nur=kapelle</code> in der Adresse
        Nahansicht.
      </p>
      <ol className="mt-2 grid list-decimal grid-cols-2 gap-x-6 gap-y-2 pl-6 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <li key={it.id} data-testid={`seed-${it.id}`}>
            <span className="font-medium">{it.m.label}</span>
            <span className="text-hd-muted block text-xs">
              {sizeText(it.m.form)} · {it.m.sub} · {it.tris} Dreiecke
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

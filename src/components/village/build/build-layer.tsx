"use client";

import { useEffect, useMemo } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { DEKO, type DekoTyp } from "@/lib/world/catalog";
import type { DekoItem } from "@/lib/world/doc";
import type { WorldMap } from "@/lib/world/map";
import { dekoGroundY } from "../deko-layer";
import { dekoParts } from "../deko-models";
import { mergeParts } from "../geo";
import { PLOT } from "@/lib/world/settlement";
import { useBuild, type BuildStore, type HouseSlot } from "./build-store";

const OK = "#5fd17a";
const BAD = "#ff5d5d";
const SEL = "#ffd166";

/** Umriss der Grundfläche als Linie (Kreis oder Rechteck), lokal um den Ursprung. */
function outline(typ: DekoTyp): THREE.BufferGeometry {
  const f = DEKO[typ].form;
  const pts: THREE.Vector3[] = [];
  if (f.kind === "circle") {
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * f.r, 0, Math.cos(a) * f.r));
    }
  } else {
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ])
      pts.push(new THREE.Vector3(x * f.hw, 0, z * f.hd));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/** Element an seiner Stelle: halbtransparentes Modell in Signalfarbe und Umriss am Boden. */
function Marker({
  map,
  item,
  color,
  model = true,
}: {
  map: WorldMap;
  item: DekoItem;
  color: string;
  model?: boolean;
}) {
  const geo = useMemo(() => {
    const p = dekoParts(item.typ, map.palette);
    const all = [...p.body, ...p.glow];
    const g = mergeParts(all);
    all.forEach((x) => x.geo.dispose());
    return g;
  }, [item.typ, map.palette]);
  const line = useMemo(() => outline(item.typ), [item.typ]);
  useEffect(
    () => () => {
      geo.dispose();
      line.dispose();
    },
    [geo, line],
  );
  const y = dekoGroundY(map, item);
  return (
    <group position={[item.x, y, item.z]} rotation={[0, (item.r * Math.PI) / 180, 0]}>
      {model && (
        <mesh geometry={geo} renderOrder={2}>
          <meshStandardMaterial
            vertexColors
            color={color}
            transparent
            opacity={0.72}
            depthWrite={false}
            emissive={color}
            emissiveIntensity={0.25}
          />
        </mesh>
      )}
      <lineLoop geometry={line} position={[0, 0.08, 0]} renderOrder={3}>
        <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </lineLoop>
    </group>
  );
}

/** Freier Bauplatz beim Umsetzen eines Hauses: Umriss des Grundstücks und Fläche in Signalgrün. */
function SlotMarker({ slot }: { slot: HouseSlot; n: number }) {
  const line = useMemo(() => {
    const pts = [
      [-PLOT.hw, -PLOT.back],
      [PLOT.hw, -PLOT.back],
      [PLOT.hw, PLOT.front],
      [-PLOT.hw, PLOT.front],
      [-PLOT.hw, -PLOT.back],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  useEffect(() => () => line.dispose(), [line]);
  return (
    <group position={[slot.x, 0.06, slot.z]} rotation={[0, slot.angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (PLOT.front - PLOT.back) / 2]}>
        <planeGeometry args={[PLOT.hw * 2, PLOT.front + PLOT.back]} />
        <meshBasicMaterial color={OK} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <lineLoop geometry={line} renderOrder={3}>
        <lineBasicMaterial color={OK} depthTest={false} />
      </lineLoop>
    </group>
  );
}

/**
 * Bau-Modus in der Szene: unsichtbare Bodenfläche fängt Zeiger und Klicks, darüber die Vorschau (grün =
 * passt, rot = passt nicht) und die Markierung des gewählten Elements.
 */
export function BuildLayer({ build, map }: { build: BuildStore; map: WorldMap }) {
  const active = useBuild(build, (s) => s.active);
  const ghost = useBuild(build, (s) => s.ghost);
  const selected = useBuild(build, (s) =>
    s.selected ? s.history.present.deko.find((d) => d.id === s.selected) : undefined,
  );
  const moving = useBuild(build, (s) => s.moving);
  const tool = useBuild(build, (s) => s.tool);
  const slots = useBuild(build, (s) => s.houseSlots);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  // Neues Werkzeug: Vorschau zuerst dort, wohin die Kamera schaut (Tastatur: Pfeile, dann Enter)
  useEffect(() => {
    if (tool && controls) build.setCursor(controls.target.x, controls.target.z);
  }, [tool, controls, build]);
  if (!active) return null;
  const size = 2 * (map.rBuild + 20);
  const at = (e: ThreeEvent<PointerEvent | MouseEvent>) => ({ x: e.point.x, z: e.point.z });
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerMove={(e) => {
          const p = at(e);
          build.hover(p.x, p.z);
        }}
        onPointerOut={() => build.leave()}
        onClick={(e) => {
          // Kamerafahrt (Ziehen) ist kein Klick
          if (e.delta > 5) return;
          e.stopPropagation();
          const p = at(e);
          build.click(p.x, p.z);
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {ghost && <Marker map={map} item={ghost.item} color={ghost.ok ? OK : BAD} />}
      {slots?.map((sl, i) => (
        <SlotMarker key={`${sl.dir}-${sl.key}`} slot={sl} n={i + 1} />
      ))}
      {selected && !moving && <Marker map={map} item={selected} color={SEL} model={false} />}
    </group>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { DEKO, type DekoTyp } from "@/lib/world/catalog";
import type { DekoItem } from "@/lib/world/doc";
import type { World } from "@/lib/world/generate";
import { pointShapeDist } from "@/lib/world/geom";
import type { WorldMap } from "@/lib/world/map";
import { dekoGroundY } from "../deko-layer";
import { dekoParts } from "../deko-models";
import { mergeParts } from "../geo";
import { NODE_RP, PLOT, plotShape } from "@/lib/world/settlement";
import { useBuild, type BuildStore, type HouseSlot } from "./build-store";

const OK = "#5fd17a";
const BAD = "#ff5d5d";
const SEL = "#ffd166";
/** Gruppe nur bis zur Grenze verschiebbar. */
const EDGE = "#ffb04d";

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
  return <PlotMarker x={slot.x} z={slot.z} angle={slot.angle} color={OK} />;
}

/**
 * Grundstück in Signalfarbe: Fläche, Umriss (immer sichtbar), Tor als Pfeil zur Front und auf Wunsch ein
 * durchscheinender Hauskörper, damit die Vorschau auch von weit oben gut zu sehen ist.
 */
function PlotMarker({
  x,
  z,
  angle,
  color,
  body = false,
  faint = false,
}: {
  x: number;
  z: number;
  angle: number;
  color: string;
  body?: boolean;
  faint?: boolean;
}) {
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
    <group position={[x, 0.06, z]} rotation={[0, angle, 0]}>
      {!faint && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (PLOT.front - PLOT.back) / 2]}>
          <planeGeometry args={[PLOT.hw * 2, PLOT.front + PLOT.back]} />
          <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      <lineLoop geometry={line} renderOrder={3}>
        <lineBasicMaterial color={color} depthTest={false} transparent opacity={faint ? 0.55 : 1} />
      </lineLoop>
      {/* Tor: kleiner Pfeil an der Front (Ausrichtung automatisch zum Weg) */}
      {!faint && (
        <mesh
          position={[0, 0.05, PLOT.front - 0.6]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
          renderOrder={3}
        >
          <circleGeometry args={[0.55, 3]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
        </mesh>
      )}
      {body && (
        <mesh position={[0, 1.9, 0.4]} renderOrder={2}>
          <boxGeometry args={[4.6, 3.8, 4.6]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.38}
            depthWrite={false}
            emissive={color}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

/** Griff am Quartierplatz (Bau-Modus): Ring mit vier Pfeilen; gewählt gelb. */
function QuarterHandle({ x, z, on }: { x: number; z: number; on: boolean }) {
  const color = on ? SEL : "#ffffff";
  return (
    <group position={[x, 0.12, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[1.05, 1.4, 32]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh
          key={k}
          rotation={[-Math.PI / 2, 0, (k * Math.PI) / 2]}
          position={[Math.sin((k * Math.PI) / 2) * 2.0, 0, Math.cos((k * Math.PI) / 2) * 2.0]}
          renderOrder={3}
        >
          <circleGeometry args={[0.45, 3, Math.PI / 2 - (k * Math.PI) / 2]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Bau-Modus in der Szene: unsichtbare Bodenfläche fängt Zeiger und Klicks, darüber die Vorschau (grün =
 * passt, rot = passt nicht) und die Markierung des gewählten Elements.
 */
export function BuildLayer({ build, world }: { build: BuildStore; world: World }) {
  const map = world.map;
  const active = useBuild(build, (s) => s.active);
  const drag = useBuild(build, (s) => s.drag);
  const quarter = useBuild(build, (s) => s.quarter);
  const cursor = useBuild(build, (s) => s.cursor);
  // Ziehen mit gedrückter Maustaste: erst nach etwas Bewegung (sonst ist es ein Klick zum Auswählen)
  const press = useRef<{ kind: "haus" | "quartier"; id: string; x: number; z: number } | null>(
    null,
  );
  const dragging = useRef(false);
  const getThree = useThree((s) => s.get);
  const setOrbit = (on: boolean) => {
    const c = getThree().controls as unknown as { enabled: boolean } | null;
    if (c) c.enabled = on;
  };
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
  const free = map.version === 2;
  const groupColor =
    drag?.kind === "quartier"
      ? drag.ghost.state === "ok"
        ? OK
        : drag.ghost.state === "grenze"
          ? EDGE
          : BAD
      : OK;
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerDown={(e) => {
          // v2: Haus oder Quartier-Griff mit gedrückter Taste ziehen (Kamera ruht solange)
          const s = build.get();
          if (e.button !== 0 || !free || s.tool || s.moving || s.drag) return;
          const p = at(e);
          const house = Object.values(world.settlement.houses).find(
            (h) => pointShapeDist(p.x, p.z, plotShape(h.x, h.z, h.angle)) <= 0,
          );
          const node = world.settlement.nodes.find(
            (n) => Math.hypot(n.x - p.x, n.z - p.z) <= NODE_RP,
          );
          if (!house && !node) return;
          press.current = house
            ? { kind: "haus", id: house.id, ...p }
            : { kind: "quartier", id: node!.quarterId, ...p };
          // Kamera ruht, solange gezogen wird (sonst dreht sie mit)
          setOrbit(false);
          const up = () => {
            setOrbit(true);
            press.current = null;
            dragging.current = false;
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointerup", up);
        }}
        onPointerMove={(e) => {
          const p = at(e);
          const pr = press.current;
          if (pr && !dragging.current && Math.hypot(p.x - pr.x, p.z - pr.z) > 0.6) {
            dragging.current =
              pr.kind === "haus"
                ? build.startHouseDrag(pr.id)
                : build.startGroupDrag(pr.id as Parameters<typeof build.startGroupDrag>[0]);
          }
          build.hover(p.x, p.z);
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          e.stopPropagation();
          const p = at(e);
          build.drop(p.x, p.z);
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
      {/* Griffe der Quartiere (Quartier wählen und verschieben) */}
      {world.settlement.nodes.map((n) => (
        <QuarterHandle key={n.quarterId} x={n.x} z={n.z} on={quarter === n.quarterId} />
      ))}
      {/* Gewähltes Quartier: Grundstücke gelb umrandet */}
      {quarter &&
        !drag &&
        Object.values(world.settlement.houses)
          .filter((h) => h.quarterId === quarter)
          .map((h) => <PlotMarker key={h.id} x={h.x} z={h.z} angle={h.angle} color={SEL} faint />)}
      {drag?.kind === "haus" && (
        <PlotMarker
          x={drag.ghost.x}
          z={drag.ghost.z}
          angle={drag.ghost.angle}
          color={drag.ghost.ok ? OK : BAD}
          body
        />
      )}
      {drag?.kind === "quartier" && (
        <>
          {drag.members.map((m) => {
            const p = drag.ghost.poses[m.id];
            const h = world.settlement.houses[m.id];
            const want = { x: m.x + cursor.x - drag.anchor.x, z: m.z + cursor.z - drag.anchor.z };
            return (
              <group key={m.id}>
                {p && drag.ghost.state !== "nein" && (
                  <PlotMarker x={p.x} z={p.z} angle={p.angle} color={groupColor} body />
                )}
                {drag.ghost.state !== "ok" && h && (
                  <PlotMarker x={want.x} z={want.z} angle={h.angle} color={BAD} faint />
                )}
              </group>
            );
          })}
          {drag.ghost.state !== "nein" &&
            drag.ghost.deko.map((d) => <Marker key={d.id} map={map} item={d} color={groupColor} />)}
          <QuarterHandle x={drag.anchor.x + drag.ghost.dx} z={drag.anchor.z + drag.ghost.dz} on />
        </>
      )}
    </group>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { FachbereichId } from "@/lib/fachbereiche";
import { DEKO, type DekoTyp } from "@/lib/world/catalog";
import type { DekoItem } from "@/lib/world/doc";
import type { World } from "@/lib/world/generate";
import { pointShapeDist, toWorld, type Pt } from "@/lib/world/geom";
import type { WorldMap } from "@/lib/world/map";
import { NODE_RP, PLOT, plotShape, quarterName, quarterOutline } from "@/lib/world/settlement";
import { treeRadius } from "@/lib/world/vegetation";
import { dekoGroundY } from "../deko-layer";
import { dekoParts } from "../deko-models";
import { mergeParts } from "../geo";
import { quarterColor, useBuild, type BuildStore, type HouseSlot } from "./build-store";
import { circlePts, dashedRibbon, gridTexture, merge, ribbon } from "./plan-geometry";

/** Signalfarben der Vorschau (passt / passt nicht / nur bis zur Grenze). */
const OK = "#5fd17a";
const BAD = "#ff5d5d";
const EDGE = "#ffb04d";

/** UI-Farben aus den Design-Tokens (CSS-Variablen), für Materialien der Szene. */
type Ui = {
  accent: string;
  accentLine: string;
  accentInk: string;
  chip: string;
  surface: string;
  ink: string;
};
function useUiColors(): Ui {
  return useMemo(() => {
    const css = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
    const v = (name: string) => css?.getPropertyValue(name).trim() || "gray";
    return {
      accent: v("--hd-accent"),
      accentLine: v("--hd-accent-line"),
      accentInk: v("--hd-accent-ink"),
      chip: v("--hd-chip"),
      surface: v("--hd-surface"),
      ink: v("--hd-ink"),
    };
  }, []);
}

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

/** Grundstück in Signalfarbe: Fläche, Umriss und Tor; auf Wunsch ein durchscheinender Hauskörper. */
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

/** Flache Form (Band, Fläche) am Boden, immer obenauf gezeichnet. */
function Flat({
  geometry,
  color,
  opacity = 1,
  order = 3,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  opacity?: number;
  order?: number;
}) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={order}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Raster des Plans (Linien alle 2 m, Kacheln 10 m) über der bebaubaren Fläche. */
function Grid({ radius }: { radius: number }) {
  const tex = useMemo(() => {
    const t = gridTexture();
    t.repeat.set((radius * 2) / 10, (radius * 2) / 10);
    return t;
  }, [radius]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} renderOrder={1}>
      <circleGeometry args={[radius, 96]} />
      <meshBasicMaterial map={tex} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

/** Quartier als Fläche (Datenfarbe, gestrichelter Rand) mit Name oben. */
function QuarterArea({
  q,
  x,
  z,
  r,
  on,
  label,
}: {
  q: FachbereichId;
  x: number;
  z: number;
  r: number;
  on: boolean;
  /** Lage des Namens: über dem Griff am Quartierplatz. */
  label: Pt;
}) {
  const color = quarterColor(q);
  const fill = useMemo(() => new THREE.CircleGeometry(r, 72), [r]);
  const edge = useMemo(() => dashedRibbon(circlePts(x, z, r, 96), 0.28, 1.4, 1.0, 0.07), [x, z, r]);
  useEffect(() => () => fill.dispose(), [fill]);
  return (
    <group>
      <mesh geometry={fill} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.05, z]} renderOrder={1}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={on ? 0.14 : 0.05}
          depthWrite={false}
        />
      </mesh>
      <Flat geometry={edge} color={color} opacity={on ? 1 : 0.35} order={2} />
      <Html
        position={[label.x, 0.2, label.z]}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span className="relative -top-[30px] rounded-hd-sm bg-hd-surface px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] whitespace-nowrap text-hd-muted uppercase">
          {quarterName(q)}
        </span>
      </Html>
    </group>
  );
}

/** Griff am Quartierplatz (runde Scheibe mit Kreuzpfeil); gewählt in Petrol. */
function QuarterHandle({
  x,
  z,
  color,
  on,
  ui,
}: {
  x: number;
  z: number;
  color: string;
  on: boolean;
  ui: Ui;
}) {
  return (
    <group position={[x, 0.15, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <circleGeometry args={[1.45, 40]} />
        <meshBasicMaterial color={on ? ui.accent : ui.chip} depthTest={false} transparent />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[1.25, 1.55, 40]} />
        <meshBasicMaterial color={on ? ui.accentInk : color} depthTest={false} transparent />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh
          key={k}
          rotation={[-Math.PI / 2, 0, (k * Math.PI) / 2]}
          position={[Math.sin((k * Math.PI) / 2) * 0.72, 0, Math.cos((k * Math.PI) / 2) * 0.72]}
          renderOrder={6}
        >
          <circleGeometry args={[0.32, 3, Math.PI / 2 - (k * Math.PI) / 2]} />
          <meshBasicMaterial color={ui.accentInk} depthTest={false} transparent />
        </mesh>
      ))}
    </group>
  );
}

/** Kleiner Ring (Eckpunkt, Baum). */
function Dot({
  x,
  z,
  r,
  color,
  fill,
  width = 0.25,
}: {
  x: number;
  z: number;
  r: number;
  color: string;
  fill?: string;
  width?: number;
}) {
  return (
    <group position={[x, 0.18, z]}>
      {fill && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
          <circleGeometry args={[r, 28]} />
          <meshBasicMaterial color={fill} depthTest={false} transparent opacity={0.9} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
        <ringGeometry args={[Math.max(0, r - width), r, 28]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
    </group>
  );
}

function SlotMarker({ slot }: { slot: HouseSlot }) {
  return <PlotMarker x={slot.x} z={slot.z} angle={slot.angle} color={OK} />;
}

/**
 * Bau-Modus in der Szene als Plan von oben: Raster, Quartierflächen mit Griff, Bewegungsraum des gewählten
 * Hauses, je nach Werkzeug Stichwege mit Eckpunkten oder Bäume zum Ziehen; dazu die Vorschau (grün = passt,
 * rot = passt nicht). Eine unsichtbare Bodenfläche fängt Zeiger und Klicks.
 */
export function BuildLayer({ build, world }: { build: BuildStore; world: World }) {
  const map = world.map;
  const ui = useUiColors();
  const accentLine = ui.accentLine;
  const active = useBuild(build, (s) => s.active);
  const btool = useBuild(build, (s) => s.btool);
  const drag = useBuild(build, (s) => s.drag);
  const point = useBuild(build, (s) => s.point);
  const quarter = useBuild(build, (s) => s.quarter);
  const house = useBuild(build, (s) => s.house);
  const cursor = useBuild(build, (s) => s.cursor);
  const bends = useBuild(build, (s) => s.history.present.bends);
  const moved = useBuild(build, (s) => s.history.present.trees);
  const press = useRef<{ kind: "haus" | "quartier"; id: string; x: number; z: number } | null>(
    null,
  );
  const dragging = useRef(false);
  const pointDrag = useRef(false);
  /** Wo das Ziehen eines Eckpunkts oder Baums begann; `neu` = Eckpunkt eben erst gesetzt. */
  const pointStart = useRef<{ x: number; z: number; neu: boolean } | null>(null);
  const justDropped = useRef(false);
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

  const v3 = world.version >= 3;
  const free = (map.version ?? 1) >= 2;
  const houses = Object.values(world.settlement.houses);
  const selHouse = house ? world.settlement.houses[house] : undefined;
  // Bewegungsraum des Quartiers des gewählten Hauses (gestrichelt)
  const range = useMemo(
    () => (selHouse ? quarterOutline(world.editSpace, world.settlement, selHouse.quarterId) : null),
    [selHouse, world],
  );
  const rangeGeo = useMemo(
    () => (range && range.length > 2 ? dashedRibbon(range, 0.3, 1.0, 0.7, 0.09) : null),
    [range],
  );
  // Stichwege zum Anklicken (Weg-Werkzeug)
  const spurGeo = useMemo(() => {
    if (btool !== "weg") return null;
    const list = Object.values(world.settlement.spurs);
    return list.length ? merge(list.map((pts) => ribbon(pts, 1.5, 0.08))) : null;
  }, [btool, world]);
  // Vorschau beim Ziehen eines Eckpunkts: Tor → Punkt
  const bendPreview = useMemo(() => {
    if (point?.kind !== "eckpunkt") return null;
    const h = world.settlement.houses[point.houseId];
    if (!h) return null;
    const gate = toWorld(h.x, h.z, h.angle, 0, PLOT.front);
    return ribbon([gate, { x: point.x, z: point.z }], 0.5, 0.1);
  }, [point, world]);
  // Bäume nahe der Siedlung (Deko-Werkzeug)
  const reach = world.layout.extent + 8;
  const trees =
    btool === "deko" ? world.vegetation.trees.filter((t) => Math.hypot(t.x, t.z) < reach) : [];

  if (!active) return null;
  const size = 2 * (map.rBuild + 20);
  const at = (e: ThreeEvent<PointerEvent | MouseEvent>) => ({ x: e.point.x, z: e.point.z });
  const hold = () => {
    setOrbit(false);
    const up = () => {
      setOrbit(true);
      // Losgelassen ausserhalb des Plans (über dem HUD oder ausserhalb des Fensters): abbrechen, sonst
      // hinge der Punkt bzw. das Haus am Zeiger
      const s = build.get();
      if ((pointDrag.current && s.point) || (dragging.current && s.drag)) build.escape();
      press.current = null;
      dragging.current = false;
      pointDrag.current = false;
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointerup", up);
  };
  const nearBend = (p: Pt) =>
    Object.entries(build.get().history.present.bends).find(
      ([, b]) => Math.hypot(b.x - p.x, b.z - p.z) < 1.0,
    )?.[0];
  const treeAt = (p: Pt) =>
    world.vegetation.trees.find(
      (t) => t.i !== undefined && Math.hypot(t.x - p.x, t.z - p.z) < treeRadius(t.kind, t.s),
    )?.i;
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
          // Nach einem Ziehen per Touch folgt kein Klick: Die Sperre gilt nur für den Klick direkt danach
          justDropped.current = false;
          const s = build.get();
          if (e.button !== 0 || s.tool || s.moving || s.drag || s.point) return;
          const p = at(e);
          if (v3 && s.btool === "weg") {
            const b = nearBend(p);
            const ok = b
              ? build.startBendDrag(b)
              : (build.addBendAt(p.x, p.z), !!build.get().point);
            if (ok) {
              pointDrag.current = true;
              pointStart.current = { ...p, neu: !b };
              hold();
            }
            return;
          }
          if (v3 && s.btool === "deko") {
            const i = treeAt(p);
            if (i !== undefined && build.startTreeDrag(i)) {
              pointDrag.current = true;
              pointStart.current = { ...p, neu: false };
              hold();
            }
            return;
          }
          if (!free || s.btool === "deko" || s.btool === "weg") return;
          const h = houses.find((x) => pointShapeDist(p.x, p.z, plotShape(x.x, x.z, x.angle)) <= 0);
          const node =
            s.btool === "haus"
              ? undefined
              : world.settlement.nodes.find((n) => Math.hypot(n.x - p.x, n.z - p.z) <= NODE_RP);
          if (h)
            press.current =
              s.btool === "quartier"
                ? { kind: "quartier", id: h.quarterId, ...p }
                : { kind: "haus", id: h.id, ...p };
          else if (node) press.current = { kind: "quartier", id: node.quarterId, ...p };
          else return;
          hold();
        }}
        onPointerMove={(e) => {
          const p = at(e);
          if (pointDrag.current) return build.hover(p.x, p.z);
          const pr = press.current;
          if (pr && !dragging.current && Math.hypot(p.x - pr.x, p.z - pr.z) > 0.6) {
            dragging.current =
              pr.kind === "haus"
                ? build.startHouseDrag(pr.id)
                : build.startGroupDrag(pr.id as FachbereichId, { x: pr.x, z: pr.z });
          }
          build.hover(p.x, p.z);
        }}
        onPointerUp={(e) => {
          const p = at(e);
          if (pointDrag.current) {
            e.stopPropagation();
            pointDrag.current = false;
            justDropped.current = true;
            const st = pointStart.current;
            pointStart.current = null;
            // Nur angeklickt (nicht gezogen): bestehender Eckpunkt bzw. Baum bleibt, kein Schritt im Verlauf
            if (st && !st.neu && Math.hypot(p.x - st.x, p.z - st.z) < 0.3) build.releasePoint();
            else build.dropPoint(p.x, p.z);
            return;
          }
          if (!dragging.current) return;
          e.stopPropagation();
          dragging.current = false;
          justDropped.current = true;
          build.drop(p.x, p.z);
        }}
        onPointerOut={() => build.leave()}
        onClick={(e) => {
          if (justDropped.current) {
            justDropped.current = false;
            return;
          }
          // Kamerafahrt (Ziehen) ist kein Klick
          if (e.delta > 5) return;
          e.stopPropagation();
          const p = at(e);
          build.click(p.x, p.z);
        }}
        onDoubleClick={(e) => {
          if (build.get().btool !== "weg") return;
          const b = nearBend(at(e));
          if (b) {
            e.stopPropagation();
            build.removeBend(b);
          }
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <Grid radius={map.rBuild + 6} />
      {world.layout.quarters.map((q) => (
        <QuarterArea
          key={q.id}
          q={q.id}
          x={q.x}
          z={q.z}
          r={q.radius}
          on={quarter === q.id}
          label={world.settlement.nodes.find((n) => n.quarterId === q.id) ?? q}
        />
      ))}
      {rangeGeo && <Flat geometry={rangeGeo} color={accentLine} opacity={0.95} order={3} />}

      {spurGeo && <Flat geometry={spurGeo} color={ui.ink} opacity={0.5} order={3} />}
      {bendPreview && <Flat geometry={bendPreview} color={accentLine} opacity={0.9} order={4} />}
      {v3 &&
        btool === "weg" &&
        Object.entries(bends).map(([id, b]) =>
          point?.kind === "eckpunkt" && point.houseId === id ? null : (
            <Dot
              key={id}
              x={b.x}
              z={b.z}
              r={0.7}
              color={accentLine}
              fill={ui.surface}
              width={0.28}
            />
          ),
        )}
      {point?.kind === "eckpunkt" && (
        <Dot x={point.x} z={point.z} r={0.7} color={accentLine} fill={ui.surface} width={0.28} />
      )}

      {trees.map((t) =>
        point?.kind === "baum" && point.i === t.i ? null : (
          <Dot
            key={t.i}
            x={t.x}
            z={t.z}
            r={treeRadius(t.kind, t.s) + 0.2}
            color={moved[String(t.i)] ? accentLine : ui.ink}
            width={moved[String(t.i)] ? 0.3 : 0.12}
          />
        ),
      )}
      {point?.kind === "baum" && (
        <Dot x={point.x} z={point.z} r={1.3} color={point.ok ? OK : BAD} width={0.35} />
      )}

      {ghost && <Marker map={map} item={ghost.item} color={ghost.ok ? OK : BAD} />}
      {slots?.map((sl) => (
        <SlotMarker key={`${sl.dir}-${sl.key}`} slot={sl} />
      ))}
      {selected && !moving && <Marker map={map} item={selected} color={accentLine} model={false} />}
      {/* Gewähltes Haus: Grundstück in Petrol */}
      {selHouse && !drag && (
        <PlotMarker x={selHouse.x} z={selHouse.z} angle={selHouse.angle} color={accentLine} faint />
      )}
      {/* Griffe der Quartiere (nicht beim Haus-Werkzeug) */}
      {btool !== "haus" &&
        world.settlement.nodes.map((n) => (
          <QuarterHandle
            key={n.quarterId}
            x={n.x}
            z={n.z}
            color={quarterColor(n.quarterId)}
            on={quarter === n.quarterId}
            ui={ui}
          />
        ))}
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
        </>
      )}
    </group>
  );
}

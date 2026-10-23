"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { isDark, resolveTime, TIMES } from "@/lib/daytime";
import type { ZentraleStyle } from "@/lib/styles";
import type { VillageModel } from "@/lib/village-model";
import { Boards } from "./boards";
import { House3D, modelOfHouse, ZENTRALE_LIFT, Zentrale3D } from "./buildings";
import { CameraRig } from "./camera-rig";
import { hullLookup } from "./hull";
import { Daylight } from "./daylight";
import { DekoLayer } from "./deko-layer";
import { BuildLayer } from "./build/build-layer";
import type { BuildStore } from "./build/build-store";
import { Ground, Lamps, Nature, PlazaDeco, Plazas } from "./decor";
import { PathLayer } from "./path-layer";
import { RockOutcrops, SeedObjects } from "./landscape-extras";
import { PanoramaLayer } from "./panorama";
import { buildVillageGardens, type VillageGardens } from "./garden-geometry";
import { loadLabelFont } from "./label-atlas";
import { Labels } from "./labels";
import { Life } from "./life";
import { buildMapGeometry } from "./map-geometry";
import { KIND_COLORS } from "./colors";
import { zentraleTopFactor } from "./models";
import type { SceneActions } from "./scene-actions";
import { ChimneySmoke, HighlightRing, ObjectCard } from "./scene-extras";
import { useScene, type SceneStore } from "./scene-store";
import { buildVillageAtlas, type VillageAtlas } from "./village-atlas";
import { environmentOf } from "./world-env";
import { ARTIFACT_KINDS } from "@/lib/types";

export type SceneProps = {
  villageId: string;
  ownerName: string;
  avatarSeed: string;
  zentraleStyle: ZentraleStyle;
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  isOwner: boolean;
  /** Klick auf das Baustellenschild eines leeren Hauses (nur Besitzer). */
  onConstruction: (houseId: string) => void;
  lowDetail: boolean;
  reducedMotion: boolean;
  /** Bau-Modus (nur Besitzer). */
  build?: BuildStore;
  /** Ein Dialog liegt über der Welt: Animation ruht, bis er geschlossen ist. */
  paused?: boolean;
};

declare global {
  interface Window {
    /** Render-Statistik der letzten Frame (für Performance-Tests). */
    __hubDome?: {
      calls: number;
      triangles: number;
      houses: number;
      artifacts: number;
      /** Szene fertig (Schrift, Beschriftungen, mindestens drei Frames): für die Screenshot-Matrix. */
      ready?: boolean;
      /** Mittlerer Abstand der letzten Frames (ms), nur aussagekräftig bei laufender Animation. */
      frameMs?: number;
      /** Anzahl gezeichneter Frames seit dem Laden. */
      frames?: number;
    };
  }
}

function PerfProbe({
  houses,
  artifacts,
  ready,
}: {
  houses: number;
  artifacts: number;
  ready: boolean;
}) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const original = gl.render.bind(gl);
    let after = 0;
    let frames = window.__hubDome?.frames ?? 0;
    const times: number[] = [];
    // Bewusst: Render-Aufruf umhüllen, um Statistik zu erfassen (ausserhalb von React-State).
    // eslint-disable-next-line react-hooks/immutability
    gl.render = (scene, camera) => {
      original(scene, camera);
      if (ready) after++;
      times.push(performance.now());
      if (times.length > 61) times.shift();
      window.__hubDome = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        houses,
        artifacts,
        ready: ready && after >= 3,
        // Zähler aller gezeichneten Frames (E2E: bei reduzierter Bewegung steht er still)
        frames: ++frames,
        frameMs:
          times.length > 1 ? (times[times.length - 1] - times[0]) / (times.length - 1) : undefined,
      };
    };
    return () => {
      gl.render = original;
    };
  }, [gl, houses, artifacts, ready]);
  // Auch ohne laufende Animation (frameloop «demand») ein paar Frames nach dem Fertigwerden zeichnen
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!ready) return;
    let n = 0;
    let id = 0;
    const tick = () => {
      invalidate();
      if (++n < 5) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [ready, invalidate]);
  return null;
}

/**
 * Atlas aller Beschriftungen (nach dem Laden der Schrift). Gehört immer zu genau einem Modell: ändert sich
 * das Dorf (z.B. neues Haus), gibt es bis zum neuen Atlas keinen, damit nie Modell und Atlas auseinanderlaufen.
 */
function useAtlas(model: VillageModel, ownerName: string): VillageAtlas | null {
  const [built, setBuilt] = useState<{ model: VillageModel; atlas: VillageAtlas } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let atlas: VillageAtlas | null = null;
    loadLabelFont().then(() => {
      if (cancelled) return;
      atlas = buildVillageAtlas(model, ownerName);
      setBuilt({ model, atlas });
    });
    return () => {
      cancelled = true;
      atlas?.dispose();
    };
  }, [model, ownerName]);
  return built?.model === model ? built.atlas : null;
}

/** Filter «Kategorie»: Objekte der Kategorie leuchten, andere werden grau (ohne Neuaufbau). */
function ObjectMeshes({ gardens, store }: { gardens: VillageGardens; store: SceneStore }) {
  const filter = useScene(store, (s) => s.filter);
  return (
    <>
      {ARTIFACT_KINDS.map((kind) => {
        const geo = gardens.objects[kind];
        if (!geo) return null;
        const match = filter !== "" && kind === filter;
        return (
          <mesh key={kind} geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial
              vertexColors
              roughness={0.65}
              color={filter === "" || match ? "#ffffff" : "#9a9a9a"}
              emissive={match ? KIND_COLORS[kind] : "#000000"}
              emissiveIntensity={match ? 0.45 : 0}
            />
          </mesh>
        );
      })}
    </>
  );
}

/** Heckenteile des ganzen Dorfs als ein InstancedMesh. */
function Hedges({ gardens }: { gardens: VillageGardens }) {
  const mesh = useMemo(() => {
    if (gardens.hedges.length === 0) return null;
    const im = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }),
      gardens.hedges.length,
    );
    const c = new THREE.Color();
    gardens.hedges.forEach((h, i) => {
      im.setMatrixAt(i, h.matrix);
      im.setColorAt(i, c.set(h.color));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    return im;
  }, [gardens]);
  useEffect(
    () => () => {
      mesh?.geometry.dispose();
      (mesh?.material as THREE.Material | undefined)?.dispose();
      mesh?.dispose();
    },
    [mesh],
  );
  return mesh ? <primitive object={mesh} /> : null;
}

function MapLayer({ model, atlas }: { model: VillageModel; atlas: VillageAtlas | null }) {
  const geometry = useMemo(() => buildMapGeometry(model), [model]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const labels = useMemo(() => {
    if (!atlas) return [];
    const out: {
      key: string;
      x: number;
      z: number;
      hh: number;
      entry: VillageAtlas["mapZentrale"];
    }[] = [];
    for (const h of model.houses) {
      const l = model.layout.houses[h.id];
      if (!l) continue;
      if (h.kind === "zentrale")
        out.push({ key: h.id, x: 0, z: 0, hh: 2.2, entry: atlas.mapZentrale });
      else out.push({ key: h.id, x: l.x, z: l.z, hh: 2.4, entry: atlas.mapHouse[h.id] });
    }
    for (const q of model.layout.quarters) {
      out.push({ key: `q-${q.id}`, x: q.x, z: q.z, hh: 2.0, entry: atlas.mapQuarter[q.id] });
    }
    return out;
  }, [model, atlas]);
  return (
    <group>
      {geometry && (
        <mesh geometry={geometry} receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.9} />
        </mesh>
      )}
      {labels.map((l) => (
        <sprite
          key={l.key}
          position={[l.x, 0.4, l.z]}
          scale={[l.hh * l.entry.aspect, l.hh, 1]}
          renderOrder={10}
        >
          <spriteMaterial map={l.entry.tex} transparent depthTest={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

export default function VillageScene(props: SceneProps) {
  const {
    ownerName,
    avatarSeed,
    zentraleStyle,
    model,
    store,
    actions,
    isOwner,
    onConstruction,
    lowDetail,
    reducedMotion,
    build,
    paused = false,
  } = props;
  const { layout } = model;

  const time = useScene(store, (s) => s.time);
  const view = useScene(store, (s) => s.view);
  const building = useScene(store, (s) => s.building);
  const map = view === "karte";
  const [hour] = useState(() => new Date().getHours());
  const timeKey = resolveTime(time, hour);

  const world = model.world;
  const env = useMemo(() => environmentOf(world), [world]);
  const gardens = useMemo(() => buildVillageGardens(model), [model]);
  useEffect(
    () => () => {
      gardens.lawns?.dispose();
      gardens.body?.dispose();
      gardens.glow?.dispose();
      Object.values(gardens.objects).forEach((g) => g.dispose());
    },
    [gardens],
  );
  const atlas = useAtlas(model, ownerName);
  const glow = TIMES[timeKey].glow;

  // Oberkante pro Haus für Beschriftung und Trefferfläche
  const tops = useMemo(() => {
    const out: Record<string, number> = {};
    for (const h of model.houses) {
      const l = layout.houses[h.id];
      if (!l) continue;
      out[h.id] =
        h.kind === "zentrale"
          ? zentraleTopFactor(zentraleStyle) * l.footprint + ZENTRALE_LIFT
          : modelOfHouse(h, l).top;
    }
    return out;
  }, [model, layout, zentraleStyle]);

  const [pointerCursor, setPointerCursor] = useState(false);
  useEffect(() => {
    document.body.style.cursor = pointerCursor ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [pointerCursor]);

  // Hülle der tatsächlichen Modelle: die Kamera passt Häuser und Zentrale vollständig ins Bild
  const hullOf = useMemo(() => hullLookup(model, zentraleStyle), [model, zentraleStyle]);

  const overview = useMemo(
    () => [0, layout.extent * 1.0 + 11, layout.extent * 1.38 + 16] as [number, number, number],
    [layout.extent],
  );

  return (
    <Canvas
      frameloop="demand"
      shadows={lowDetail ? false : "percentage"}
      dpr={lowDetail ? [1, 1.25] : [1, 2]}
      gl={{ antialias: !lowDetail, powerPreference: "high-performance" }}
      camera={{ position: overview, fov: 45, near: 0.1, far: 1600 }}
      onCreated={({ gl, invalidate }) => {
        // Bei Kontextverlust (z.B. Grafiktreiber-Reset) Wiederherstellung erlauben und neu zeichnen.
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        gl.domElement.addEventListener("webglcontextrestored", () => invalidate());
      }}
      onPointerMissed={() => {
        /* Klick ins Leere ändert nichts (verhindert versehentliches Verlassen) */
      }}
    >
      <Daylight
        time={timeKey}
        extent={layout.extent}
        map={map}
        lowDetail={lowDetail}
        tint={world.map.params?.tint ?? 0}
      />

      {/* Boden, Plätze, Wege und Rasen sind in beiden Ansichten sichtbar */}
      <Ground world={world} lowDetail={lowDetail} />
      {!map && (
        <PanoramaLayer
          map={world.map}
          lowDetail={lowDetail}
          glow={glow}
          morning={timeKey === "morgen"}
          frozen={reducedMotion}
        />
      )}
      <Plazas layout={layout} paving={world.map.palette.paving} />
      <PathLayer world={world} grass={world.map.palette.grassIn} lowDetail={lowDetail} />
      {gardens.lawns && (
        <mesh geometry={gardens.lawns} receiveShadow>
          <meshStandardMaterial color="#ffffff" vertexColors roughness={1} />
        </mesh>
      )}

      <Life
        layout={layout}
        env={env}
        lowDetail={lowDetail}
        reducedMotion={reducedMotion}
        mapOnly={map}
        dark={isDark(timeKey)}
        paused={paused}
        glow={glow}
      />

      <group visible={!map}>
        <PlazaDeco world={world} />
        <Lamps world={world} glow={glow} lit={isDark(timeKey)} lowDetail={lowDetail} />
        <Nature world={world} />
        <RockOutcrops rocks={world.map.rocks ?? []} map={world.map} />
        <SeedObjects objects={world.map.objects ?? []} map={world.map} glow={glow} />
        <DekoLayer map={world.map} items={world.deko} glow={glow} />
        {gardens.body && (
          <mesh geometry={gardens.body} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.85} />
          </mesh>
        )}
        {gardens.glow && (
          <mesh geometry={gardens.glow}>
            <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={glow} />
          </mesh>
        )}
        <Hedges gardens={gardens} />
        <ObjectMeshes gardens={gardens} store={store} />
        {atlas && (
          <Boards
            model={model}
            atlas={atlas}
            gardens={gardens}
            isOwner={isOwner}
            onConstruction={onConstruction}
            onNotice={(row) => {
              const o = model.notice[row];
              if (o) actions.goToObject(o.houseId, o.id);
            }}
            onHoverPointer={setPointerCursor}
            lit={isDark(timeKey)}
            disabled={building}
          />
        )}
        {!lowDetail && !reducedMotion && <ChimneySmoke houses={model.houses} model={model} />}
        {atlas && (
          <Labels model={model} atlas={atlas} tops={tops} store={store} actions={actions} />
        )}
        <ObjectCard model={model} store={store} />
        <HighlightRing model={model} store={store} />
      </group>

      {/* Häuser und Zentrale: auch in der Kartenansicht anklickbar (Trefferflächen); gezeichnet nur in 3D */}
      <group visible={!map}>
        {model.houses.map((h) => {
          const l = layout.houses[h.id];
          if (!l) return null;
          return h.kind === "zentrale" ? (
            <Zentrale3D
              key={h.id}
              info={h}
              layout={l}
              style={zentraleStyle}
              avatarSeed={avatarSeed}
              glow={glow}
              store={store}
              actions={actions}
            />
          ) : (
            <House3D key={h.id} info={h} layout={l} glow={glow} store={store} actions={actions} />
          );
        })}
      </group>

      {/* Nebenplätze: Klick öffnet das Quartier */}
      {layout.quarters.map((q) => (
        <mesh
          key={q.id}
          position={[q.x, 0.2, q.z]}
          visible={false}
          onPointerOver={(e) => {
            if (store.get().building) return;
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => (document.body.style.cursor = "")}
          onClick={(e) => {
            if (e.delta > 5 || store.get().building) return;
            e.stopPropagation();
            actions.openQuarter(q.id);
          }}
        >
          <cylinderGeometry args={[q.rp + 0.4, q.rp + 0.4, 0.4, 16]} />
        </mesh>
      ))}

      {map && <MapLayer model={model} atlas={atlas} />}
      {build && !map && <BuildLayer build={build} world={world} />}

      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        enableRotate={!map}
        minDistance={5}
        maxDistance={layout.extent * 2.4 + 30}
        maxPolarAngle={map ? 0.001 : Math.PI / 2.15}
        minPolarAngle={map ? 0 : 0.15}
      />
      <CameraRig layout={layout} store={store} reducedMotion={reducedMotion} hullOf={hullOf} />
      <PerfProbe
        houses={model.houses.length}
        artifacts={model.houses.reduce((n, h) => n + h.items.length, 0)}
        ready={atlas !== null}
      />
    </Canvas>
  );
}

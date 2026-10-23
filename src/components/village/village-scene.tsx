"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { resolveTime } from "@/lib/daytime";
import { computeEnvironment } from "@/lib/environment";
import type { ZentraleStyle } from "@/lib/styles";
import type { VillageModel } from "@/lib/village-model";
import { Boards } from "./boards";
import { House3D, modelOfHouse, ZENTRALE_LIFT, Zentrale3D } from "./buildings";
import { CameraRig } from "./camera-rig";
import { Daylight } from "./daylight";
import { Ground, Lamps, makeHeightFn, Nature, Paths, PlazaDeco, Plazas } from "./decor";
import { buildVillageGardens, type VillageGardens } from "./garden-geometry";
import { loadLabelFont } from "./label-atlas";
import { Labels } from "./labels";
import { Life } from "./life";
import { buildMapGeometry } from "./map-geometry";
import { KIND_COLORS } from "./colors";
import { zentraleTopFactor } from "./models";
import { isClick } from "./pointer";
import type { SceneActions } from "./scene-actions";
import { ChimneySmoke, HighlightRing, ObjectCard } from "./scene-extras";
import { useScene, type SceneStore } from "./scene-store";
import { useDisposable } from "./use-disposable";
import { buildVillageAtlas, type VillageAtlas } from "./village-atlas";
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
};

declare global {
  interface Window {
    /** Render-Statistik der letzten Frame (für Performance-Tests). */
    __hubDome?: { calls: number; triangles: number; houses: number; artifacts: number };
  }
}

function PerfProbe({ houses, artifacts }: { houses: number; artifacts: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const original = gl.render.bind(gl);
    // Bewusst: Render-Aufruf umhüllen, um Statistik zu erfassen (ausserhalb von React-State).
    // eslint-disable-next-line react-hooks/immutability
    gl.render = (scene, camera) => {
      original(scene, camera);
      window.__hubDome = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        houses,
        artifacts,
      };
    };
    return () => {
      gl.render = original;
    };
  }, [gl, houses, artifacts]);
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
  const geometry = useDisposable(() => buildMapGeometry(model), [model]);
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
    villageId,
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
  } = props;
  const { layout } = model;

  const time = useScene(store, (s) => s.time);
  const view = useScene(store, (s) => s.view);
  const map = view === "karte";
  const [hour] = useState(() => new Date().getHours());
  const timeKey = resolveTime(time, hour);

  const env = useMemo(
    () => computeEnvironment(layout.extent, villageId),
    [layout.extent, villageId],
  );
  const height = useMemo(() => makeHeightFn(layout.extent, env), [layout.extent, env]);
  const gardens = useDisposable(() => buildVillageGardens(model), [model]);
  const atlas = useAtlas(model, ownerName);
  const glow = timeKey === "abend" ? 2.6 : timeKey === "mittag" ? 0.85 : 0.7;

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
      camera={{ position: overview, fov: 45, near: 0.1, far: 900 }}
      onCreated={({ gl, invalidate }) => {
        // Bei Kontextverlust (z.B. Grafiktreiber-Reset) Wiederherstellung erlauben und neu zeichnen.
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        gl.domElement.addEventListener("webglcontextrestored", () => invalidate());
      }}
      onPointerMissed={() => {
        /* Klick ins Leere ändert nichts (verhindert versehentliches Verlassen) */
      }}
    >
      <Daylight time={timeKey} extent={layout.extent} map={map} lowDetail={lowDetail} />

      {/* Boden, Plätze, Wege und Rasen sind in beiden Ansichten sichtbar */}
      <Ground extent={layout.extent} height={height} />
      <Plazas layout={layout} />
      <Paths layout={layout} />
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
      />

      <group visible={!map}>
        <PlazaDeco layout={layout} />
        <Lamps layout={layout} glow={glow} evening={timeKey === "abend"} lowDetail={lowDetail} />
        <Nature
          layout={layout}
          env={env}
          height={height}
          seed={villageId}
          density={lowDetail ? 0.35 : 1}
          forest={!lowDetail}
        />
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
          />
        )}
        {!lowDetail && !reducedMotion && <ChimneySmoke model={model} />}
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
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => (document.body.style.cursor = "")}
          onClick={(e) => {
            if (!isClick(e)) return;
            e.stopPropagation();
            actions.openQuarter(q.id);
          }}
        >
          <cylinderGeometry args={[q.rp + 0.4, q.rp + 0.4, 0.4, 16]} />
        </mesh>
      ))}

      {map && <MapLayer model={model} atlas={atlas} />}

      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        enableRotate={!map}
        minDistance={5}
        maxDistance={layout.extent * 2.4 + 30}
        maxPolarAngle={map ? 0.001 : Math.PI / 2.15}
        minPolarAngle={map ? 0 : 0.15}
      />
      <CameraRig layout={layout} store={store} reducedMotion={reducedMotion} />
      <PerfProbe
        houses={model.houses.length}
        artifacts={model.houses.reduce((n, h) => n + h.items.length, 0)}
      />
    </Canvas>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { WebGLRenderer } from "three";
import { artifactSlots, computeLayout } from "@/lib/layout";
import type { HouseStyle, ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { Artifact3D } from "./artifact-3d";
import { House3D, Zentrale3D } from "./buildings";
import { CameraRig, housePose, overviewPose } from "./camera-rig";
import { computeEnvironment } from "@/lib/environment";
import { Ground, Nature, Paths, SkyBackground } from "./decor";
import { Life } from "./life";

export type SceneProps = {
  villageId: string;
  ownerName: string;
  avatarSeed: string;
  houseStyle: HouseStyle;
  zentraleStyle: ZentraleStyle;
  customModelUrl: string | null;
  houses: House[];
  artifacts: Artifact[];
  selectedHouseId: string | null;
  selectedArtifactId: string | null;
  onSelectHouse: (id: string | null) => void;
  onSelectArtifact: (id: string) => void;
  lowDetail: boolean;
  reducedMotion: boolean;
};

declare global {
  interface Window {
    /** Render-Statistik der letzten Frame (für Performance-Tests). */
    __hubDome?: { calls: number; triangles: number; houses: number; artifacts: number };
  }
}

/** Schreibt die Statistik der letzten Frame nach `window.__hubDome` (für Performance-Tests). */
function publishStats(gl: WebGLRenderer, houses: number, artifacts: number) {
  window.__hubDome = {
    calls: gl.info.render.calls,
    triangles: gl.info.render.triangles,
    houses,
    artifacts,
  };
}

function PerfProbe({ houses, artifacts }: { houses: number; artifacts: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const original = gl.render.bind(gl);
    // Bewusst: Render-Aufruf umhüllen, um Statistik zu erfassen (ausserhalb von React-State).
    // eslint-disable-next-line react-hooks/immutability
    gl.render = (scene, camera) => {
      original(scene, camera);
      publishStats(gl, houses, artifacts);
    };
    return () => {
      gl.render = original;
    };
  }, [gl, houses, artifacts]);
  return null;
}

export default function VillageScene(props: SceneProps) {
  const {
    villageId,
    ownerName,
    avatarSeed,
    houseStyle,
    zentraleStyle,
    customModelUrl,
    houses,
    artifacts,
    selectedHouseId,
    selectedArtifactId,
    onSelectHouse,
    onSelectArtifact,
    lowDetail,
    reducedMotion,
  } = props;

  const byHouse = useMemo(() => {
    const map: Record<string, Artifact[]> = {};
    for (const a of artifacts) (map[a.house_id] ??= []).push(a);
    return map;
  }, [artifacts]);

  const layout = useMemo(
    () =>
      computeLayout(
        houses,
        Object.fromEntries(houses.map((h) => [h.id, byHouse[h.id]?.length ?? 0])),
      ),
    [houses, byHouse],
  );

  const env = useMemo(
    () => computeEnvironment(layout.extent, villageId),
    [layout.extent, villageId],
  );

  const pose = useMemo(() => {
    const sel = selectedHouseId ? layout.houses[selectedHouseId] : null;
    return sel ? housePose(sel) : overviewPose(layout.extent);
  }, [selectedHouseId, layout]);

  const start = useMemo(() => overviewPose(layout.extent), [layout.extent]);

  return (
    <Canvas
      frameloop="demand"
      shadows={lowDetail ? false : "soft"}
      dpr={lowDetail ? [1, 1.25] : [1, 2]}
      gl={{ antialias: !lowDetail, powerPreference: "high-performance" }}
      camera={{
        position: start.position.toArray(),
        fov: 45,
        near: 0.1,
        far: 500,
      }}
      onCreated={({ gl, invalidate }) => {
        // Bei Kontextverlust (z.B. Grafiktreiber-Reset) Wiederherstellung erlauben und neu zeichnen.
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        gl.domElement.addEventListener("webglcontextrestored", () => invalidate());
      }}
      onPointerMissed={() => {
        /* Klick ins Leere ändert nichts (verhindert versehentliches Verlassen) */
      }}
    >
      <SkyBackground />
      <fog attach="fog" args={["#d9ebf8", layout.extent * 1.6, layout.extent * 4.5]} />
      <hemisphereLight args={["#fff7ea", "#7fa56a", 1.0]} />
      <directionalLight
        position={[layout.extent * 0.7, layout.extent * 1.2, layout.extent * 0.9]}
        intensity={2.1}
        color="#fff3dc"
        castShadow={!lowDetail}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={layout.extent * 4}
        shadow-camera-left={-(layout.extent + 14)}
        shadow-camera-right={layout.extent + 14}
        shadow-camera-top={layout.extent + 14}
        shadow-camera-bottom={-(layout.extent + 14)}
      />

      <Ground extent={layout.extent} plaza={layout.plazaRadius} />
      <Paths layout={layout} />
      <Life layout={layout} env={env} lowDetail={lowDetail} reducedMotion={reducedMotion} />
      <Nature layout={layout} env={env} seed={villageId} density={lowDetail ? 0.35 : 1} />

      {houses.map((house) => {
        const l = layout.houses[house.id];
        if (!l) return null;
        const items = byHouse[house.id] ?? [];
        const slots = artifactSlots(items.length, l.footprint);
        const objects = items.map((a, i) => (
          <Artifact3D
            key={a.id}
            artifact={a}
            position={[slots[i].x, slots[i].y, slots[i].z]}
            selected={a.id === selectedArtifactId}
            onSelect={onSelectArtifact}
          />
        ));
        return (
          <group key={house.id} position={[l.x, 0, l.z]} rotation={[0, l.angle, 0]}>
            {house.kind === "zentrale" ? (
              <Zentrale3D
                style={zentraleStyle}
                modelUrl={customModelUrl}
                name={ownerName}
                avatarSeed={avatarSeed}
                footprint={l.footprint}
                onSelect={() => onSelectHouse(house.id)}
              >
                {objects}
              </Zentrale3D>
            ) : (
              <House3D
                id={house.id}
                style={houseStyle}
                title={house.title}
                color={house.color}
                tier={l.tier}
                footprint={l.footprint}
                artifactCount={items.length}
                onSelect={() => onSelectHouse(house.id)}
              >
                {objects}
              </House3D>
            )}
          </group>
        );
      })}

      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        minDistance={5}
        maxDistance={layout.extent * 2.4 + 20}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={0.15}
      />
      <CameraRig pose={pose} reducedMotion={reducedMotion} extent={layout.extent} />
      <PerfProbe houses={houses.length} artifacts={artifacts.length} />
    </Canvas>
  );
}

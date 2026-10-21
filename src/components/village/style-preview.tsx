"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TIER_FOOTPRINT, ZENTRALE_FOOTPRINT, type Tier } from "@/lib/layout";
import type { HouseStyle, ZentraleStyle } from "@/lib/styles";
import { ModelMesh } from "./buildings";
import { SkyBackground } from "./decor";
import {
  constructionModel,
  houseModel,
  roofColorFor,
  zentraleModel,
  zentraleTopFactor,
} from "./models";

type Props = {
  mode: "haeuser" | "zentrale";
  houseStyle: HouseStyle;
  zentraleStyle: ZentraleStyle;
  wall?: string;
};

const TIERS: Tier[] = [1, 2, 3];

/** Kleine Live-Vorschau der gewählten Stile (Baustelle und drei Grössenstufen bzw. die Zentrale). */
export default function StylePreview({ mode, houseStyle, zentraleStyle, wall = "#8fb3ff" }: Props) {
  const houses = useMemo(
    () => [
      { x: -10.5, model: constructionModel(houseStyle, TIER_FOOTPRINT[1]) },
      ...TIERS.map((t, i) => ({
        x: -3.5 + i * 7 + (t === 3 ? 1.5 : 0),
        model: houseModel(houseStyle, TIER_FOOTPRINT[t], t, wall, roofColorFor(`preview${t}`)),
      })),
    ],
    [houseStyle, wall],
  );
  const zentrale = useMemo(() => zentraleModel(zentraleStyle, ZENTRALE_FOOTPRINT), [zentraleStyle]);
  const house = mode === "haeuser";
  // Kamera so wählen, dass auch hohe Zentralen (Hochhaus, Leuchtturm) komplett sichtbar sind.
  const height = zentraleTopFactor(zentraleStyle) * ZENTRALE_FOOTPRINT;
  const camZ = Math.max(16, height * 1.9);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: house ? [3, 8, 27] : [0, height * 0.55, camZ], fov: 40 }}
    >
      <SkyBackground />
      <hemisphereLight args={["#fff7ea", "#7fa56a", 1.0]} />
      <directionalLight position={[12, 20, 14]} intensity={2} color="#fff3dc" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[house ? 30 : 16, 48]} />
        <meshStandardMaterial color="#86bf6c" />
      </mesh>
      {house ? (
        houses.map((h, i) => (
          <group key={i} position={[h.x, 0, 0]}>
            <ModelMesh model={h.model} />
          </group>
        ))
      ) : (
        <ModelMesh model={zentrale} />
      )}
      <OrbitControls
        enablePan={false}
        target={house ? [0.5, 1.5, 0] : [0, height * 0.35, 0]}
        minDistance={6}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}

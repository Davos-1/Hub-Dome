"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FACHBEREICHE, type FachbereichId } from "@/lib/fachbereiche";
import { TIER_FOOTPRINT, ZENTRALE_FOOTPRINT, type Tier } from "@/lib/layout";
import type { ZentraleStyle } from "@/lib/styles";
import { ModelMesh } from "./buildings";
import { Daylight } from "./daylight";
import { constructionModel, houseModel, zentraleModel, zentraleTopFactor } from "./models";

type Props =
  { mode: "zentrale"; zentraleStyle: ZentraleStyle } | { mode: "haus"; fach: FachbereichId };

const TIERS: Tier[] = [1, 2, 3];
/** Leuchtstärke der Fenster in der Vorschau (Tageszeit Mittag). */
const GLOW = 0.85;

/**
 * Kleine Vorschau: die Zentrale in einem Stil oder der Haustyp eines Fachbereichs
 * (Baustelle und drei Grössenstufen, von links nach rechts).
 */
export default function StylePreview(props: Props) {
  const house = props.mode === "haus";
  const fach = props.mode === "haus" ? props.fach : "weitere";
  const zentraleStyle = props.mode === "zentrale" ? props.zentraleStyle : "rathaus";

  const houses = useMemo(() => {
    const s = FACHBEREICHE[fach].style;
    return [
      { x: -10.5, model: constructionModel(TIER_FOOTPRINT[1]) },
      ...TIERS.map((t, i) => ({
        x: -3.5 + i * 7 + (t === 3 ? 1.5 : 0),
        model: houseModel(s.type, TIER_FOOTPRINT[t], t, s.wall, s.roof, s.accent),
      })),
    ];
  }, [fach]);
  const zentrale = useMemo(() => zentraleModel(zentraleStyle, ZENTRALE_FOOTPRINT), [zentraleStyle]);
  // Kamera so wählen, dass auch hohe Zentralen (Hochhaus, Leuchtturm) komplett sichtbar sind.
  const height = zentraleTopFactor(zentraleStyle) * ZENTRALE_FOOTPRINT;
  const camZ = Math.max(16, height * 1.9);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: house ? [3, 8, 27] : [0, height * 0.55, camZ], fov: 40 }}
    >
      <Daylight time="mittag" extent={30} map lowDetail />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[house ? 30 : 16, 48]} />
        <meshStandardMaterial color="#86bf6c" />
      </mesh>
      {house ? (
        houses.map((h, i) => (
          <group key={i} position={[h.x, 0, 0]}>
            <ModelMesh model={h.model} glow={GLOW} />
          </group>
        ))
      ) : (
        <ModelMesh model={zentrale} glow={GLOW} />
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

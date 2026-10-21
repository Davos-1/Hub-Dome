"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Tier } from "@/lib/layout";
import { avatarColor } from "./colors";
import type { HouseStyle, ZentraleStyle } from "@/lib/styles";
import {
  constructionModel,
  figureModel,
  houseModel,
  houseTopFactor,
  roofColorFor,
  zentraleModel,
  zentraleTopFactor,
  type Model,
} from "./models";
import { CustomModel, type ModelStatus } from "./custom-model";
import { Label3D } from "./label3d";

/** Zeichnet ein Modell: farbige Karosserie plus leuchtende Teile (Fenster, Laternen). */
export function ModelMesh({ model, hovered = false }: { model: Model; hovered?: boolean }) {
  // Geometrien gehören dieser Komponente, nicht dem Cache: beim Entfernen freigeben.
  useEffect(
    () => () => {
      model.body.dispose();
      model.glow.dispose();
    },
    [model],
  );
  return (
    <group>
      <mesh geometry={model.body} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.78}
          emissive="#ffffff"
          emissiveIntensity={hovered ? 0.14 : 0}
        />
      </mesh>
      <mesh geometry={model.glow}>
        <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={0.85} />
      </mesh>
    </group>
  );
}

/** Interaktive Hülle: Hover-Cursor und Klick wählen das Haus. */
function Clickable({
  onSelect,
  onHover,
  children,
}: {
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  children: ReactNode;
}) {
  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(false);
        document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {children}
    </group>
  );
}

type HouseProps = {
  id: string;
  style: HouseStyle;
  title: string;
  color: string;
  tier: Tier;
  footprint: number;
  artifactCount: number;
  onSelect: () => void;
  children?: ReactNode;
};

export function House3D({
  id,
  style,
  title,
  color,
  tier,
  footprint: fp,
  artifactCount,
  onSelect,
  children,
}: HouseProps) {
  const [hovered, setHovered] = useState(false);
  const empty = artifactCount === 0;
  const model = useMemo(
    () =>
      empty ? constructionModel(style, fp) : houseModel(style, fp, tier, color, roofColorFor(id)),
    [empty, style, fp, tier, color, id],
  );
  const top = houseTopFactor(style, tier, empty);
  const labelY = fp * top + 1;

  return (
    <group>
      <Clickable onSelect={onSelect} onHover={setHovered}>
        <ModelMesh model={model} hovered={hovered} />
        {/* unsichtbare, etwas grössere Trefferfläche */}
        <mesh position={[0, (fp * top) / 2, 0]} visible={false}>
          <boxGeometry args={[fp * 3.2, fp * top, fp * 3.2]} />
        </mesh>
      </Clickable>
      <Label3D text={title} sub={String(artifactCount)} position={[0, labelY, 0]} height={0.04} />
      {children}
    </group>
  );
}

export function Zentrale3D({
  style,
  modelUrl,
  name,
  avatarSeed,
  footprint: fp,
  onSelect,
  children,
}: {
  style: ZentraleStyle;
  /** Signierte URL des hochgeladenen Modells (nur bei Stil `custom`). */
  modelUrl?: string | null;
  name: string;
  avatarSeed: string;
  footprint: number;
  onSelect: () => void;
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const model = useMemo(() => zentraleModel(style, fp), [style, fp]);
  const top = zentraleTopFactor(style);
  // Eigenes Modell: bis es geladen ist (oder bei einem Fehler) zeigt die Szene das Rathaus.
  const [status, setStatus] = useState<ModelStatus>("loading");
  const custom = style === "custom" && Boolean(modelUrl);
  const showDefault = !custom || status !== "ready";
  const figure = useMemo(() => figureModel(avatarColor(avatarSeed)), [avatarSeed]);
  useEffect(() => () => figure.dispose(), [figure]);

  return (
    <group>
      <Clickable onSelect={onSelect} onHover={setHovered}>
        {showDefault && <ModelMesh model={model} hovered={hovered} />}
        {custom && <CustomModel url={modelUrl!} onStatus={setStatus} />}
        <mesh position={[0, (fp * top) / 2, 0]} visible={false}>
          <boxGeometry args={[fp * 2.8, fp * top, fp * 2.8]} />
        </mesh>
      </Clickable>

      {/* Figur vor der Zentrale */}
      <mesh
        geometry={figure}
        position={[fp * 1.35, 0, fp * 1.9]}
        rotation={[0, -0.4, 0]}
        castShadow
      >
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>

      <Label3D text={name} position={[0, fp * top + 1, 0]} height={0.05} />
      {children}
    </group>
  );
}

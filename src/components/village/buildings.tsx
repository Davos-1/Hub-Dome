"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Tier } from "@/lib/layout";
import { avatarColor } from "./colors";
import {
  constructionModel,
  figureModel,
  houseModel,
  roofColorFor,
  zentraleModel,
  type Model,
} from "./house-models";
import { Label3D } from "./label3d";

/** Zeichnet ein Modell: farbige Karosserie plus leuchtende Teile (Fenster, Laternen). */
function ModelMesh({ model, hovered = false }: { model: Model; hovered?: boolean }) {
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
    () => (empty ? constructionModel(fp) : houseModel(fp, tier, color, roofColorFor(id))),
    [empty, fp, tier, color, id],
  );
  const labelY = empty ? fp * 3.3 + 1 : tier >= 3 ? fp * 3.9 + 1 : fp * 2.8 + 1.2;

  return (
    <group>
      <Clickable onSelect={onSelect} onHover={setHovered}>
        <ModelMesh model={model} hovered={hovered} />
        {/* unsichtbare, etwas grössere Trefferfläche */}
        <mesh position={[0, fp * 1.2, 0]} visible={false}>
          <boxGeometry args={[fp * 2.8, fp * 2.8, fp * 2.8]} />
        </mesh>
      </Clickable>
      <Label3D text={title} sub={String(artifactCount)} position={[0, labelY, 0]} height={0.04} />
      {children}
    </group>
  );
}

export function Zentrale3D({
  name,
  avatarSeed,
  footprint: fp,
  onSelect,
  children,
}: {
  name: string;
  avatarSeed: string;
  footprint: number;
  onSelect: () => void;
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const model = useMemo(() => zentraleModel(fp), [fp]);
  const figure = useMemo(() => figureModel(avatarColor(avatarSeed)), [avatarSeed]);
  useEffect(() => () => figure.dispose(), [figure]);

  return (
    <group>
      <Clickable onSelect={onSelect} onHover={setHovered}>
        <ModelMesh model={model} hovered={hovered} />
        <mesh position={[0, fp * 1.8, 0]} visible={false}>
          <boxGeometry args={[fp * 2.6, fp * 3.6, fp * 2.6]} />
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

      <Label3D text={name} position={[0, fp * 5.2 + 1, 0]} height={0.05} />
      {children}
    </group>
  );
}

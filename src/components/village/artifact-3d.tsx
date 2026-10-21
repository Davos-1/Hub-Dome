"use client";

import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { ITEM_TYPE_LABELS } from "@/lib/item-types";
import type { Artifact } from "@/lib/types";
import { KIND_COLORS } from "./colors";
import { Label3D } from "./label3d";
import { objectModel } from "./object-models";

type Props = {
  artifact: Artifact;
  position: [number, number, number];
  selected: boolean;
  onSelect: (id: string) => void;
};

/**
 * Objekt auf einem Sockel. Form nach Objekttyp, Ringfarbe nach Inhaltskategorie
 * (PLAN-ERWEITERUNG.md, Anpassung Phase 4). Modelle werden pro Typ/Farbe geteilt.
 */
export function Artifact3D({ artifact, position, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState(false);
  const color = KIND_COLORS[artifact.kind];
  const model = objectModel(artifact.item_type, color);
  const active = hovered || selected;
  const green = artifact.item_type === "gist";

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHovered(false);
    document.body.style.cursor = "";
  };

  return (
    <group
      position={position}
      scale={active ? 1.18 : 1}
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(artifact.id);
      }}
    >
      <mesh geometry={model.body} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.65}
          emissive="#ffffff"
          emissiveIntensity={active ? 0.05 : 0}
        />
      </mesh>
      <mesh geometry={model.glow}>
        <meshStandardMaterial
          color={green ? "#4ade80" : color}
          emissive={green ? "#4ade80" : color}
          emissiveIntensity={active ? 1 : 0.55}
          roughness={0.35}
        />
      </mesh>
      {hovered && (
        <Label3D
          text={artifact.title}
          sub={ITEM_TYPE_LABELS[artifact.item_type]}
          position={[0, 2.2, 0]}
          height={0.032}
          dark
        />
      )}
    </group>
  );
}

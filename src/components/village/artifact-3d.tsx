"use client";

import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM_TYPE_LABELS, type ItemType } from "@/lib/item-types";
import type { Artifact } from "@/lib/types";
import { KIND_COLORS } from "./colors";
import { Label3D } from "./label3d";

// Geometrien werden von allen Objekten geteilt (weniger Speicher, schnelleres Laden).
const G = {
  crystal: new THREE.OctahedronGeometry(0.42, 0),
  gear: new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10),
  tooth: new THREE.BoxGeometry(0.13, 0.14, 0.13),
  cube: new THREE.BoxGeometry(0.55, 0.55, 0.55),
  screen: new THREE.BoxGeometry(0.4, 0.3, 0.02),
  chest: new THREE.BoxGeometry(0.62, 0.3, 0.4),
  lid: new THREE.CylinderGeometry(0.2, 0.2, 0.62, 12, 1, false, 0, Math.PI),
  pole: new THREE.BoxGeometry(0.06, 0.8, 0.06),
  board: new THREE.BoxGeometry(0.56, 0.22, 0.05),
  crate: new THREE.BoxGeometry(0.5, 0.4, 0.5),
  crateLid: new THREE.BoxGeometry(0.56, 0.08, 0.56),
  book: new THREE.BoxGeometry(0.46, 0.1, 0.6),
};

const TEETH = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2;
  return [Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34, a] as const;
});

type MatProps = { color: string; emissive: string; intensity: number };

function Mat({ color, emissive, intensity }: MatProps) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={intensity}
      roughness={0.5}
      metalness={0.1}
    />
  );
}

/** Form pro Objekttyp (PLAN-ERWEITERUNG.md, Anpassung Phase 4). */
function Shape({ type, color, glow }: { type: ItemType; color: string; glow: number }) {
  const m = { color, emissive: color, intensity: glow };
  switch (type) {
    case "github_repo":
      return (
        <group rotation={[Math.PI / 2.4, 0, 0]}>
          <mesh geometry={G.gear}>
            <Mat {...m} />
          </mesh>
          {TEETH.map(([x, y, z, a], i) => (
            <mesh key={i} geometry={G.tooth} position={[x, y, z]} rotation={[0, -a, 0]}>
              <Mat {...m} />
            </mesh>
          ))}
        </group>
      );
    case "gist":
      return (
        <group>
          <mesh geometry={G.cube}>
            <Mat color="#1f2937" emissive={color} intensity={glow * 0.3} />
          </mesh>
          <mesh geometry={G.screen} position={[0, 0.02, 0.29]}>
            <meshBasicMaterial color="#4ade80" />
          </mesh>
        </group>
      );
    case "cloud_ordner":
      return (
        <group>
          <mesh geometry={G.chest}>
            <Mat color="#92400e" emissive={color} intensity={glow * 0.5} />
          </mesh>
          <mesh geometry={G.lid} position={[0, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
            <Mat color="#b45309" emissive={color} intensity={glow * 0.5} />
          </mesh>
        </group>
      );
    case "link":
      return (
        <group>
          <mesh geometry={G.pole} position={[0, -0.05, 0]}>
            <Mat color="#78350f" emissive={color} intensity={glow * 0.3} />
          </mesh>
          <mesh geometry={G.board} position={[0.08, 0.22, 0]}>
            <Mat {...m} />
          </mesh>
        </group>
      );
    case "datei":
      return (
        <mesh geometry={G.book} rotation={[0.4, 0, 0]}>
          <Mat {...m} />
        </mesh>
      );
    case "paket":
      return (
        <group>
          <mesh geometry={G.crate}>
            <Mat color="#a16207" emissive={color} intensity={glow * 0.4} />
          </mesh>
          <mesh geometry={G.crateLid} position={[0, 0.24, 0]}>
            <Mat {...m} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh geometry={G.crystal} scale={[0.8, 1.2, 0.8]}>
          <Mat {...m} />
        </mesh>
      );
  }
}

type Props = {
  artifact: Artifact;
  position: [number, number, number];
  selected: boolean;
  onSelect: (id: string) => void;
};

export function Artifact3D({ artifact, position, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState(false);
  const color = KIND_COLORS[artifact.kind];
  const active = hovered || selected;

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
      scale={active ? 1.3 : 1}
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(artifact.id);
      }}
    >
      <Shape type={artifact.item_type} color={color} glow={active ? 0.9 : 0.35} />
      {hovered && (
        <Label3D
          text={artifact.title}
          sub={ITEM_TYPE_LABELS[artifact.item_type]}
          position={[0, 0.9, 0]}
          height={0.5}
          dark
        />
      )}
    </group>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Tier } from "@/lib/layout";
import { avatarColor } from "./colors";
import { Label3D } from "./label3d";

const ROOF = "#b4533a";
const WOOD = "#7c4a2d";
const GLASS = "#bfe3ff";

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

/** Baustelle für Häuser ohne Objekte. */
function ConstructionSite({ fp }: { fp: number }) {
  const poles: [number, number][] = [
    [-0.8, -0.8],
    [0.8, -0.8],
    [-0.8, 0.8],
    [0.8, 0.8],
  ];
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[fp * 2, 0.12, fp * 2]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      {poles.map(([x, z], i) => (
        <mesh key={i} position={[x * fp, 0.9, z * fp]}>
          <boxGeometry args={[0.1, 1.7, 0.1]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      ))}
      <mesh position={[0, 1.7, fp * 0.8]}>
        <boxGeometry args={[fp * 1.7, 0.08, 0.08]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      <mesh position={[0.4 * fp, 0.3, 0.2 * fp]}>
        <boxGeometry args={[0.6, 0.45, 0.6]} />
        <meshStandardMaterial color="#a16207" />
      </mesh>
      <mesh position={[-0.5 * fp, 0.35, 0.4 * fp]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.2, 0.5, 8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

function HouseBody({
  fp,
  tier,
  color,
  glow,
}: {
  fp: number;
  tier: Tier;
  color: string;
  glow: number;
}) {
  const h = fp * 1.6;
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[fp * 2, h, fp * 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, h + fp * 0.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[fp * 1.55, fp * 0.8, 4]} />
        <meshStandardMaterial color={ROOF} />
      </mesh>
      <mesh position={[0, fp * 0.4, fp + 0.02]}>
        <boxGeometry args={[fp * 0.5, fp * 0.8, 0.06]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x * fp, h * 0.62, fp + 0.02]}>
          <boxGeometry args={[fp * 0.38, fp * 0.38, 0.06]} />
          <meshStandardMaterial color={GLASS} />
        </mesh>
      ))}
      {tier >= 2 && (
        <mesh position={[fp * 0.55, h + fp * 0.6, -fp * 0.4]}>
          <boxGeometry args={[fp * 0.3, fp * 0.8, fp * 0.3]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      )}
      {tier >= 3 && (
        <group position={[fp * 1.7, 0, -fp * 0.2]}>
          <mesh position={[0, fp * 0.55, 0]}>
            <boxGeometry args={[fp * 1.2, fp * 1.1, fp * 1.4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} />
          </mesh>
          <mesh position={[0, fp * 1.3, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[fp * 1.05, fp * 0.6, 4]} />
            <meshStandardMaterial color={ROOF} />
          </mesh>
        </group>
      )}
    </group>
  );
}

type HouseProps = {
  title: string;
  color: string;
  tier: Tier;
  footprint: number;
  artifactCount: number;
  onSelect: () => void;
  children?: ReactNode;
};

export function House3D({
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
  return (
    <group>
      <Clickable onSelect={onSelect} onHover={setHovered}>
        {empty ? (
          <ConstructionSite fp={fp} />
        ) : (
          <HouseBody fp={fp} tier={tier} color={color} glow={hovered ? 0.25 : 0} />
        )}
        {/* unsichtbare, etwas grössere Trefferfläche */}
        <mesh position={[0, fp * 0.9, 0]} visible={false}>
          <boxGeometry args={[fp * 2.4, fp * 2.2, fp * 2.4]} />
        </mesh>
      </Clickable>
      <Label3D
        text={title}
        sub={String(artifactCount)}
        position={[0, fp * 2.9 + 1.2, 0]}
        height={1.3}
      />
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
  const h = fp * 1.5;
  const color = "#e8d9b5";
  return (
    <group>
      <Clickable onSelect={onSelect} onHover={setHovered}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[fp * 2, h, fp * 1.6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={hovered ? 0.25 : 0}
          />
        </mesh>
        <mesh position={[0, h + fp * 0.35, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.25, 1, 1]}>
          <coneGeometry args={[fp * 1.2, fp * 0.7, 4]} />
          <meshStandardMaterial color={ROOF} />
        </mesh>
        {/* Turm mit Fahne */}
        <mesh position={[-fp * 0.75, h + fp * 0.9, -fp * 0.2]}>
          <boxGeometry args={[fp * 0.55, fp * 1.8, fp * 0.55]} />
          <meshStandardMaterial color="#d6c49a" />
        </mesh>
        <mesh position={[-fp * 0.75, h + fp * 2.1, -fp * 0.2]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[fp * 0.5, fp * 0.6, 4]} />
          <meshStandardMaterial color={ROOF} />
        </mesh>
        <mesh position={[-fp * 0.75, h + fp * 2.9, -fp * 0.2]}>
          <cylinderGeometry args={[0.03, 0.03, fp * 0.8, 6]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh position={[-fp * 0.75 + 0.25, h + fp * 3.1, -fp * 0.2]}>
          <boxGeometry args={[0.5, 0.3, 0.02]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        {/* Tür und Fenster */}
        <mesh position={[0, fp * 0.5, fp * 0.8 + 0.02]}>
          <boxGeometry args={[fp * 0.6, fp * 1, 0.06]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x * fp, h * 0.6, fp * 0.8 + 0.02]}>
            <boxGeometry args={[fp * 0.4, fp * 0.45, 0.06]} />
            <meshStandardMaterial color={GLASS} />
          </mesh>
        ))}
        <mesh position={[0, h / 2, 0]} visible={false}>
          <boxGeometry args={[fp * 2.4, h * 1.6, fp * 2.2]} />
        </mesh>
      </Clickable>

      {/* Figur vor der Zentrale */}
      <group position={[fp * 0.9, 0, fp * 1.2]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.9, 10]} />
          <meshStandardMaterial color={avatarColor(avatarSeed)} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[0.2, 12, 10]} />
          <meshStandardMaterial color="#f3c9a4" />
        </mesh>
      </group>

      <Label3D text={name} position={[0, h + fp * 3.6 + 1.2, 0]} height={1.6} />
      {children}
    </group>
  );
}

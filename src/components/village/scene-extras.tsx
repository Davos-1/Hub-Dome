"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { HouseLayout } from "@/lib/layout";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "./colors";
import { drawObjCard } from "./label-atlas";
import { chimneyTop } from "./models";
import { SmokeStack } from "./label-sprite";
import { useScene, type SceneStore } from "./scene-store";

/** Weltposition eines lokalen Punkts im Haus (Drehung um Y). */
export function toWorld(l: Pick<HouseLayout, "x" | "z" | "angle">, lx: number, lz: number) {
  const c = Math.cos(l.angle);
  const s = Math.sin(l.angle);
  return { x: l.x + lx * c + lz * s, z: l.z - lx * s + lz * c };
}

/** Weltposition eines Objekts (Platz im Grundstück). */
export function objectWorld(model: VillageModel, objId: string) {
  for (const h of model.houses) {
    const l = model.layout.houses[h.id];
    const slot = (l?.plot?.slots ?? l?.ring)?.find((s) => s.id === objId);
    if (l && slot) return { house: h, ...toWorld(l, slot.x, slot.z) };
  }
  return null;
}

/** Karte über dem Objekt bei Hover; ein angeheftetes Objekt (Suche, Klick) behält seine Karte. */
export function ObjectCard({ model, store }: { model: VillageModel; store: SceneStore }) {
  const id = useScene(store, (s) => s.hoverObjId ?? s.pinnedObjId);
  const view = useScene(store, (s) => s.view);
  const data = useMemo(() => {
    if (!id) return null;
    const at = objectWorld(model, id);
    const obj = at?.house.items.find((o) => o.id === id);
    if (!at || !obj) return null;
    const entry = drawObjCard(obj, at.house);
    const texture = new THREE.CanvasTexture(entry.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { x: at.x, z: at.z, aspect: entry.aspect, texture };
  }, [id, model]);
  useEffect(() => () => data?.texture.dispose(), [data]);
  if (!data || view !== "3d") return null;
  return (
    <sprite
      position={[data.x, 1.6, data.z]}
      center={new THREE.Vector2(0.5, 0)}
      scale={[0.052 * data.aspect, 0.052, 1]}
      renderOrder={30}
    >
      <spriteMaterial
        map={data.texture}
        transparent
        depthTest={false}
        sizeAttenuation={false}
        toneMapped={false}
      />
    </sprite>
  );
}

/** Pulsierender Ring am Boden um ein Objekt oder Haus (7 s), danach verschwindet er. */
export function HighlightRing({ model, store }: { model: VillageModel; store: SceneStore }) {
  const hl = useScene(store, (s) => s.highlight);
  const ref = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  const spec = useMemo(() => {
    if (!hl) return null;
    if (hl.kind === "obj") {
      const at = objectWorld(model, hl.id);
      const obj = at?.house.items.find((o) => o.id === hl.id);
      return at && obj ? { x: at.x, z: at.z, r: 0.62, color: KIND_COLORS[obj.kind] } : null;
    }
    const l = model.layout.houses[hl.id];
    if (!l) return null;
    return {
      x: l.x,
      z: l.z,
      r: l.plot ? Math.max(l.plot.hw, l.footprint * 2) : model.layout.terrace + 0.6,
      color: "#1c1b19",
    };
  }, [hl, model]);

  useEffect(() => {
    if (!hl) return;
    const id = window.setTimeout(() => {
      if (store.get().highlight === hl) store.set({ highlight: null });
    }, 7000);
    invalidate();
    return () => window.clearTimeout(id);
  }, [hl, store, invalidate]);

  useFrame(() => {
    const m = ref.current;
    if (!m || !hl) return;
    const dt = (performance.now() - hl.t0) / 1000;
    const k = 1 + 0.12 * Math.sin(dt * 5);
    m.scale.set(k, k, k);
    (m.material as THREE.MeshBasicMaterial).opacity = dt > 6 ? Math.max(0, 1 - (dt - 6)) : 0.9;
  });

  if (!spec) return null;
  return (
    <mesh
      ref={ref}
      position={[spec.x, 0.05, spec.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={5}
    >
      <ringGeometry args={[spec.r * 0.86, spec.r, 48]} />
      <meshBasicMaterial
        color={spec.color}
        transparent
        opacity={0.9}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const WIND = { x: 0.7, z: -0.7 };
const PUFFS = 6;

/** Kaminrauch bei Häusern mit neuen Objekten: sechs weiche Sprites, die 2.4 m aufsteigen. */
export function ChimneySmoke({ houses, model }: { houses: HouseInfo[]; model: VillageModel }) {
  const texture = useMemo(() => smokeTexture(), []);
  // Stapel und Gruppe in einem Zug bauen (die Fabrik darf nicht zweimal verschiedene Gruppen füllen)
  const { stacks, group } = useMemo(() => {
    const list = houses.flatMap((h) => {
      const l = model.layout.houses[h.id];
      if (!l || h.items.length === 0 || h.newCount === 0) return [];
      const top = chimneyTop(h.style.type, l.footprint);
      if (!top) return [];
      const w = toWorld(l, top[0], top[2]);
      return [new SmokeStack(texture, w.x, top[1], w.z, PUFFS)];
    });
    const g = new THREE.Group();
    list.forEach((st) => g.add(st.group));
    return { stacks: list, group: g };
  }, [houses, model, texture]);
  useEffect(
    () => () => {
      stacks.forEach((st) => st.dispose());
      texture.dispose();
    },
    [stacks, texture],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    for (const st of stacks) st.update(t, WIND);
  });
  return <primitive object={group} />;
}

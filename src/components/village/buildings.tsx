"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { HouseLayout, PlotSlot } from "@/lib/layout";
import type { ZentraleStyle } from "@/lib/styles";
import type { HouseInfo } from "@/lib/village-model";
import { avatarColor } from "./colors";
import {
  constructionModel,
  figureModel,
  houseModel,
  zentraleModel,
  zentraleTopFactor,
  type Model,
} from "./models";
import type { SceneActions } from "./scene-actions";
import { useScene, type SceneStore } from "./scene-store";
import { zentraleRingGeometry } from "./zentrale-objects";

/** Höhe der Zentrale auf ihrer Terrasse. */
export const ZENTRALE_LIFT = 0.22;

/** Modell eines Modulhauses nach Fachbereich, Stufe und Wandfarbe; leere Häuser sind Baustellen. */
export function modelOfHouse(info: HouseInfo, l: HouseLayout): Model {
  return info.items.length === 0
    ? constructionModel(l.footprint)
    : houseModel(
        info.style.type,
        l.footprint,
        l.tier,
        info.style.wall,
        info.style.roof,
        info.style.accent,
        info.newCount > 0,
      );
}

/** Zeichnet ein Modell: farbige Karosserie plus leuchtende Teile (Fenster, Laternen). */
function ModelMesh({
  model,
  glow,
  emphasis = 0,
  tint = "#ffffff",
  owned = false,
}: {
  model: Model;
  glow: number;
  emphasis?: number;
  tint?: string;
  /** Geometrie gehört dieser Komponente (nicht dem gemeinsamen Zwischenspeicher): beim Entfernen freigeben. */
  owned?: boolean;
}) {
  useEffect(
    () => () => {
      if (!owned) return;
      model.body.dispose();
      model.glow.dispose();
    },
    [model, owned],
  );
  return (
    <group>
      <mesh geometry={model.body} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          color={tint}
          roughness={0.78}
          emissive="#ffffff"
          emissiveIntensity={emphasis}
        />
      </mesh>
      <mesh geometry={model.glow}>
        <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

const isClick = (e: ThreeEvent<MouseEvent>) => e.delta <= 5;

/** Ein Modulhaus: Modell, Trefferflächen für Haus und Objekte. */
export function House3D({
  info,
  layout: l,
  glow,
  store,
  actions,
}: {
  info: HouseInfo;
  layout: HouseLayout;
  glow: number;
  store: SceneStore;
  actions: SceneActions;
}) {
  const model = useMemo(() => modelOfHouse(info, l), [info, l]);
  const hovered = useScene(store, (s) => s.hoverHouseId === info.id);
  const dim = useScene(
    store,
    (s) => s.filter !== "" && !info.items.some((i) => i.kind === s.filter),
  );
  const fp = l.footprint;
  const top = Math.max(model.top, 1);

  return (
    <group position={[l.x, 0, l.z]} rotation={[0, l.angle, 0]}>
      <ModelMesh
        model={model}
        glow={glow}
        emphasis={hovered ? 0.14 : 0}
        tint={dim ? "#8d8d8d" : "#ffffff"}
      />
      {/* unsichtbare, etwas grössere Trefferfläche */}
      <mesh
        position={[0, top / 2, 0]}
        visible={false}
        onPointerOver={(e) => {
          if (store.get().building) return;
          e.stopPropagation();
          store.set({ hoverHouseId: info.id });
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (store.get().hoverHouseId === info.id) store.set({ hoverHouseId: null });
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          if (store.get().building || !isClick(e)) return;
          e.stopPropagation();
          actions.openHouse(info.id);
        }}
      >
        <boxGeometry args={[fp * 3.2, top, fp * 3.2]} />
      </mesh>
      <SlotHits slots={l.plot?.slots} houseId={info.id} store={store} actions={actions} />
    </group>
  );
}

/** Unsichtbare Trefferflächen der Objekt-Plätze (Hover-Karte, Klick springt zum Objekt). */
function SlotHits({
  slots,
  houseId,
  store,
  actions,
}: {
  slots: PlotSlot[] | null | undefined;
  houseId: string;
  store: SceneStore;
  actions: SceneActions;
}) {
  return slots?.map((s) => (
    <mesh
      key={s.id}
      position={[s.x, 0.6, s.z]}
      visible={false}
      onPointerOver={(e) => {
          if (store.get().building) return;
        e.stopPropagation();
        store.set({ hoverObjId: s.id, hoverHouseId: null });
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (store.get().hoverObjId === s.id) store.set({ hoverObjId: null });
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        if (store.get().building || !isClick(e)) return;
        e.stopPropagation();
        actions.goToObject(houseId, s.id);
      }}
    >
      <boxGeometry args={[0.7, 1.2, 0.7]} />
    </mesh>
  ));
}

/** Die Zentrale auf ihrer Terrasse, in dem Stil, den der Besitzer gewählt hat. */
export function Zentrale3D({
  info,
  layout: l,
  style,
  avatarSeed,
  glow,
  store,
  actions,
  children,
}: {
  info: HouseInfo;
  layout: HouseLayout;
  style: ZentraleStyle;
  avatarSeed: string;
  glow: number;
  store: SceneStore;
  actions: SceneActions;
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const fp = l.footprint;
  const model = useMemo(() => zentraleModel(style, fp), [style, fp]);
  const top = zentraleTopFactor(style) * fp;
  const figure = useMemo(() => figureModel(avatarColor(avatarSeed)), [avatarSeed]);
  useEffect(() => () => figure.dispose(), [figure]);
  const ring = useMemo(
    () =>
      zentraleRingGeometry(
        style,
        l.ring ?? [],
        new Map(info.items.map((o) => [o.id, { isNew: o.isNew, isCopy: o.isCopy }])),
      ),
    [style, l.ring, info.items],
  );
  useEffect(() => () => ring?.dispose(), [ring]);

  return (
    <group position={[l.x, ZENTRALE_LIFT, l.z]}>
      {/* Objekte im Ring um die Zentrale */}
      {ring && (
        <mesh geometry={ring} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.75} />
        </mesh>
      )}
      <SlotHits slots={l.ring} houseId={info.id} store={store} actions={actions} />
      <group
        onPointerOver={(e) => {
          if (store.get().building) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          if (store.get().building || !isClick(e)) return;
          e.stopPropagation();
          actions.openHouse(info.id);
        }}
      >
        <ModelMesh model={model} glow={glow} emphasis={hovered ? 0.14 : 0} owned />
        <mesh position={[0, top / 2, 0]} visible={false}>
          <boxGeometry args={[fp * 2.8, top, fp * 2.8]} />
        </mesh>
      </group>

      {/* Figur vor der Zentrale */}
      <mesh
        geometry={figure}
        position={[fp * 1.35, 0, fp * 1.9]}
        rotation={[0, -0.4, 0]}
        castShadow
      >
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {children}
    </group>
  );
}

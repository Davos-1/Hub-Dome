"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { HouseStyle, ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { VillagePanel } from "./village-panel";

const VillageScene = dynamic(() => import("./village-scene"), {
  ssr: false,
  loading: () => <p className="p-6 text-zinc-500">3D-Dorf wird geladen…</p>,
});

type Props = {
  villageId: string;
  villageName: string;
  ownerUsername: string;
  ownerName: string;
  avatarSeed: string;
  isOwner: boolean;
  houseStyle: HouseStyle;
  zentraleStyle: ZentraleStyle;
  /** Signierte URL des eigenen Zentrale-Modells (nur bei Stil custom). */
  customModelUrl?: string | null;
  houses: House[];
  artifacts: Artifact[];
  previews: Record<string, ReactNode>;
};

/** Media-Query als Hook (Server: false). */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function VillageView(props: Props) {
  const { houses, artifacts, ownerUsername } = props;
  const [houseId, setHouseId] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);

  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  // Mobile bzw. Touch-Geräte: reduzierte Details (weniger Pixel, kein Antialiasing, weniger Bäume).
  const lowDetail = useMedia("(pointer: coarse), (max-width: 767px)");

  // WebGL-Unterstützung ist auf dem Server unbekannt (null) und wird im Browser einmal geprüft.
  const webgl = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => null,
  );

  const selectHouse = useCallback((id: string | null) => {
    setHouseId(id);
    setArtifactId(null);
  }, []);

  const selectArtifact = useCallback(
    (id: string | null) => {
      setArtifactId(id);
      if (id) {
        const a = artifacts.find((x) => x.id === id);
        if (a) setHouseId(a.house_id);
      }
    },
    [artifacts],
  );

  // Escape: eine Ebene zurück.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (artifactId) setArtifactId(null);
      else if (houseId) setHouseId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [artifactId, houseId]);

  const house = houses.find((h) => h.id === houseId) ?? null;
  const artifact = artifacts.find((a) => a.id === artifactId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <div
        className="relative min-h-[55vh] flex-1 overflow-hidden rounded-xl border border-zinc-300 md:min-h-[70vh]"
        role="img"
        aria-label="3D-Ansicht des Dorfs. Alle Inhalte sind auch in der Listenansicht und im Seitenbereich erreichbar."
      >
        {webgl === false ? (
          <p className="p-6">
            Dein Browser unterstützt keine 3D-Grafik. Nutze die{" "}
            <Link className="underline" href={`/dorf/${ownerUsername}/liste`}>
              Listenansicht
            </Link>
            .
          </p>
        ) : webgl ? (
          <VillageScene
            villageId={props.villageId}
            ownerName={props.ownerName}
            avatarSeed={props.avatarSeed}
            houseStyle={props.houseStyle}
            zentraleStyle={props.zentraleStyle}
            customModelUrl={props.customModelUrl ?? null}
            houses={houses}
            artifacts={artifacts}
            selectedHouseId={houseId}
            selectedArtifactId={artifactId}
            onSelectHouse={selectHouse}
            onSelectArtifact={selectArtifact}
            lowDetail={lowDetail}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {houseId && (
          <button
            type="button"
            onClick={() => selectHouse(null)}
            className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-1 text-sm font-medium shadow"
          >
            ← Zurück
          </button>
        )}
      </div>

      <aside aria-label="Details" className="w-full shrink-0 md:w-96">
        <div className="mb-3 flex gap-3 text-sm">
          <Link
            href={`/dorf/${ownerUsername}/liste`}
            className="rounded-lg border border-zinc-300 px-3 py-1 font-medium"
          >
            Zur Listenansicht
          </Link>
        </div>
        <VillagePanel
          villageName={props.villageName}
          ownerUsername={ownerUsername}
          isOwner={props.isOwner}
          houses={houses}
          artifacts={artifacts}
          house={house}
          artifact={artifact}
          previews={props.previews}
          onSelectHouse={selectHouse}
          onSelectArtifact={selectArtifact}
        />
      </aside>
    </div>
  );
}

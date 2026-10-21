"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { buildVillageModel } from "@/lib/village-model";
import { BottomBar } from "./hud/bottom-bar";
import { Breadcrumb } from "./hud/breadcrumb";
import { SearchBox } from "./hud/search-box";
import { SideWindow, useSideWindowOpen } from "./hud/side-window";
import { makeActions } from "./scene-actions";
import { createSceneStore, loadSettings, saveSettings } from "./scene-store";

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

/** Vollbild-3D: Dorf, schwebende Leiste unten, Brotkrumen, Suche und Fenster rechts. */
export function VillageView(props: Props) {
  const { houses, artifacts, ownerUsername } = props;
  const router = useRouter();

  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  // Mobile bzw. Touch-Geräte: reduzierte Details (weniger Pixel, kein Antialiasing, weniger Bäume).
  const lowDetail = useMedia("(pointer: coarse), (max-width: 767px)");

  // WebGL-Unterstützung ist auf dem Server unbekannt (null) und wird im Browser einmal geprüft.
  const webgl = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => null,
  );

  const [now] = useState(() => Date.now());
  const model = useMemo(() => buildVillageModel(houses, artifacts, now), [houses, artifacts, now]);
  const [store] = useState(() => createSceneStore());
  const actions = useMemo(() => makeActions(store, model), [store, model]);
  const windowOpen = useSideWindowOpen(store);

  // Gespeicherte Einstellungen laden, danach jede Änderung speichern.
  useEffect(() => {
    store.set(loadSettings());
    return store.subscribe(() => {
      const s = store.get();
      saveSettings({ view: s.view, time: s.time, filter: s.filter });
    });
  }, [store]);

  // Esc schliesst zuerst offene Popups und Fenster, sonst geht es eine Ebene zurück (auch ohne Fokus im Canvas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "Escape" && store.get().panel) {
        store.set({ panel: null });
        e.stopPropagation();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
        // Enter auf Knöpfen und Links nicht abfangen
        if (e.key === "Enter" && target && /^(BUTTON|A)$/.test(target.tagName)) return;
        if (actions.onKey(e.key)) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [store, actions]);

  return (
    <div
      className="hubdome-ui fixed inset-0 overflow-hidden bg-[#cfe4f4] text-[#1c1b19]"
      role="application"
      aria-label={`3D-Ansicht des Dorfs ${props.villageName}. Alle Inhalte sind auch in der Listenansicht erreichbar.`}
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
        <div className="absolute inset-0" tabIndex={-1}>
          <VillageScene
            villageId={props.villageId}
            ownerName={props.ownerName}
            avatarSeed={props.avatarSeed}
            zentraleStyle={props.zentraleStyle}
            customModelUrl={props.customModelUrl ?? null}
            model={model}
            store={store}
            actions={actions}
            isOwner={props.isOwner}
            onConstruction={(houseId) => router.push(`/dorf/${ownerUsername}/liste#h-${houseId}`)}
            lowDetail={lowDetail}
            reducedMotion={reducedMotion}
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0">
        <Breadcrumb model={model} store={store} actions={actions} />
        <SearchBox model={model} actions={actions} />
        <SideWindow
          model={model}
          store={store}
          actions={actions}
          artifacts={artifacts}
          previews={props.previews}
          isOwner={props.isOwner}
          ownerUsername={ownerUsername}
        />
        <BottomBar store={store} actions={actions} windowOpen={windowOpen} />
        {model.houses.length <= 1 && (
          <p className="pointer-events-auto absolute top-16 left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 shadow">
            {props.isOwner ? (
              <>
                Lege dein erstes Modulhaus an – in der{" "}
                <Link href={`/dorf/${ownerUsername}/liste`} className="underline">
                  Listenansicht
                </Link>
                .
              </>
            ) : (
              "Hier gibt es noch keine Häuser."
            )}
          </p>
        )}
        <Link
          href={`/dorf/${ownerUsername}/liste`}
          className="pointer-events-auto absolute bottom-3 left-3 rounded-lg bg-[#fffdf8]/90 px-3 py-1.5 text-[12.5px] font-medium text-[#2f5d4a] shadow-[0_1px_3px_rgba(0,0,0,.15)] hover:bg-[#fffdf8]"
        >
          Zur Listenansicht
        </Link>
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ShellData } from "@/lib/shell-data";
import type { ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { buildVillageModel } from "@/lib/village-model";
import { useDialog } from "../world/use-dialog";
import { WelcomeBanner } from "../world/welcome-banner";
import { WorldDialogs } from "../world/world-dialogs";
import { BottomBar } from "./hud/bottom-bar";
import { Breadcrumb } from "./hud/breadcrumb";
import { SearchBox } from "./hud/search-box";
import { SideWindow, useSideWindowOpen } from "./hud/side-window";
import { makeActions } from "./scene-actions";
import { createSceneStore, loadSettings, saveSettings } from "./scene-store";

const VillageScene = dynamic(() => import("./village-scene"), {
  ssr: false,
  loading: () => null,
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
  /** Daten für die Dialoge (Start, Reise, Einstellungen, Hinzufügen). */
  shell: ShellData;
  /** Einladungslink: zeigt den Annehmen-Dialog über der Welt. */
  inviteToken?: string;
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

const hint =
  "pointer-events-auto absolute top-16 left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 shadow";

/** Vollbild-3D: Dorf, schwebende Leiste unten, Brotkrumen, Suche, Fenster rechts und Dialoge der Welt-Shell. */
export function VillageView(props: Props) {
  const { houses, artifacts, ownerUsername, shell } = props;
  const dialog = useDialog();
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

  // Welcher Dialog ist offen? Start, Hinzufügen und Einladung gelten nur in den passenden Fällen.
  const ownerOnly = dialog.id === "start" || dialog.id === "objekt" || dialog.id === "haus";
  const active =
    props.inviteToken !== undefined
      ? ("einladung" as const)
      : ownerOnly && !props.isOwner
        ? null
        : dialog.id;

  const [now] = useState(() => Date.now());
  const model = useMemo(() => buildVillageModel(houses, artifacts, now), [houses, artifacts, now]);
  // Einstieg: beim Start-Dialog steht die Kamera zuerst weit draussen
  const [store] = useState(() => createSceneStore({ intro: dialog.id === "start" }));
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

  // Sobald der Start-Dialog nicht mehr offen ist, fliegt die Kamera zur Übersicht ein.
  useEffect(() => {
    if (active !== "start") store.set({ intro: false });
  }, [active, store]);

  // Esc schliesst zuerst offene Popups, sonst geht es eine Ebene zurück (nicht bei offenem Dialog:
  // der Dialog behandelt Esc selbst).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[data-hd-dialog]")) return;
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

  const ownVillage = shell.villages.find((v) => v.mine);
  const empty = model.houses.length <= 1;

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
        <div
          className="hd-fade-in absolute inset-0"
          tabIndex={-1}
          inert={active !== null}
          aria-hidden={active !== null || undefined}
        >
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
            onConstruction={(houseId) => dialog.open("objekt", { houseId })}
            lowDetail={lowDetail}
            reducedMotion={reducedMotion}
          />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0"
        inert={active !== null}
        aria-hidden={active !== null || undefined}
      >
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
          onAddObject={(houseId) => dialog.open("objekt", { houseId })}
        />
        <BottomBar
          store={store}
          actions={actions}
          windowOpen={windowOpen}
          onTravel={() => dialog.open("reise")}
          onSettings={() => dialog.open("einstellungen", { tab: "anzeige" })}
          onAddHouse={props.isOwner ? () => dialog.open("haus") : undefined}
        />
        {empty && props.isOwner && (
          <p className={hint}>
            Lege dein erstes Modulhaus an –{" "}
            <button type="button" onClick={() => dialog.open("haus")} className="underline">
              Haus anlegen
            </button>{" "}
            oder in der{" "}
            <Link href={`/dorf/${ownerUsername}/liste`} className="underline">
              Listenansicht
            </Link>
            .
          </p>
        )}
        {empty && !props.isOwner && <p className={hint}>Hier gibt es noch keine Häuser.</p>}
        {!props.isOwner && active === null && (
          <WelcomeBanner
            villageName={props.villageName}
            ownerName={props.ownerName}
            ownerUsername={ownerUsername}
            onHome={() => {
              router.push(ownVillage ? `/dorf/${ownVillage.ownerUsername}` : "/start");
            }}
          />
        )}
        <Link
          href={`/dorf/${ownerUsername}/liste`}
          className="pointer-events-auto absolute bottom-3 left-3 rounded-lg bg-[#fffdf8]/90 px-3 py-1.5 text-[12.5px] font-medium text-[#2f5d4a] shadow-[0_1px_3px_rgba(0,0,0,.15)] hover:bg-[#fffdf8]"
        >
          Zur Listenansicht
        </Link>
      </div>

      <WorldDialogs
        active={active}
        dialog={dialog}
        inviteToken={props.inviteToken}
        shell={shell}
        model={model}
        store={store}
        actions={actions}
        isOwner={props.isOwner}
        villageName={props.villageName}
        ownerUsername={ownerUsername}
        lowDetail={lowDetail}
        onEnter={dialog.close}
      />
    </div>
  );
}

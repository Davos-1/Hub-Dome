"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ShellData } from "@/lib/shell-data";
import type { ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { buildVillageModel, type VillageModel } from "@/lib/village-model";
import { useDialog } from "../world/use-dialog";
import { WelcomeBanner } from "../world/welcome-banner";
import { WorldDialogs } from "../world/world-dialogs";
import { BottomBar } from "./hud/bottom-bar";
import { Breadcrumb } from "./hud/breadcrumb";
import { DisplayPopup } from "./hud/display-popup";
import { SearchBox } from "./hud/search-box";
import { SideWindow, useSideWindowOpen } from "./hud/side-window";
import { makeActions, type SceneActions } from "./scene-actions";
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
  houses: House[];
  artifacts: Artifact[];
  previews: Record<string, ReactNode>;
  /** Daten für die Dialoge (Start, Reise und Freunde, Einstellungen, Hinzufügen). */
  shell: ShellData;
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
  "pointer-events-auto absolute top-16 left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border-2 border-[#e6c870] bg-[#fff3cf] p-3 text-sm text-[#6b4e00] shadow";

/** Ersatz ohne WebGL: alle Häuser nach Quartier als Liste; die Auswahl öffnet das Fenster rechts. */
function FallbackList({ model, actions }: { model: VillageModel; actions: SceneActions }) {
  const zentrale = model.houses.find((h) => h.kind === "zentrale");
  return (
    <div className="absolute inset-0 overflow-y-auto p-4 pt-20 pb-28">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className="hd-card text-[14px]">
          Dein Browser unterstützt keine 3D-Grafik. Hier ist das Dorf als Liste; wähle ein Haus, um
          die Objekte zu sehen.
        </p>
        {zentrale && (
          <button
            type="button"
            className="hd-btn hd-btn-ghost"
            onClick={() => actions.openHouse(zentrale.id)}
          >
            Zentrale ({zentrale.items.length})
          </button>
        )}
        {model.layout.quarters.map((q) => (
          <section key={q.id} className="hd-card flex flex-col gap-2">
            <h2 className="hd-label">{q.name}</h2>
            <ul className="flex flex-col gap-1.5">
              {q.houseIds.map((id) => {
                const h = model.byId[id];
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => actions.openHouse(id)}
                      className="hd-btn hd-btn-ghost w-full !justify-between"
                    >
                      <span className="truncate">{h.title}</span>
                      <span className="hd-note">
                        {h.items.length === 0 ? "Baustelle" : `${h.items.length} Objekte`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

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

  // Welcher Dialog ist offen? Start und Bearbeiten-Dialoge gelten nur im eigenen Dorf.
  const ownerOnly = ["start", "objekt", "objektedit", "haus", "hausedit"].includes(dialog.id ?? "");
  const active = ownerOnly && !props.isOwner ? null : dialog.id;

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
  const friendRequests = shell.friends.filter((f) => f.status === "eingehend").length;

  return (
    <div
      className="hubdome-ui fixed inset-0 overflow-hidden bg-[#cfe4f4] text-[#1c1b19]"
      role="application"
      aria-label={`3D-Ansicht des Dorfs ${props.villageName}. Alle Häuser und Objekte sind auch über die Suche und die Fenster erreichbar.`}
    >
      {webgl === false ? (
        <div inert={active !== null} aria-hidden={active !== null || undefined}>
          <FallbackList model={model} actions={actions} />
        </div>
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
          onAddObject={(houseId) => dialog.open("objekt", { houseId })}
          onEditHouse={(houseId) => dialog.open("hausedit", { houseId })}
          onEditObject={(objectId) => dialog.open("objektedit", { objectId })}
        />
        <DisplayPopup store={store} actions={actions} />
        <BottomBar
          store={store}
          actions={actions}
          windowOpen={windowOpen}
          friendRequests={friendRequests}
          onTravel={() => dialog.open("reise")}
          onSettings={() => dialog.open("einstellungen", { tab: "profil" })}
          onAddHouse={props.isOwner ? () => dialog.open("haus") : undefined}
        />
        {empty && props.isOwner && (
          <p className={hint}>
            Lege dein erstes Modulhaus an –{" "}
            <button
              type="button"
              onClick={() => dialog.open("haus")}
              className="font-semibold underline"
            >
              Haus anlegen
            </button>
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
      </div>

      <WorldDialogs
        active={active}
        dialog={dialog}
        shell={shell}
        model={model}
        houses={houses}
        artifacts={artifacts}
        isOwner={props.isOwner}
        villageName={props.villageName}
        ownerUsername={ownerUsername}
        lowDetail={lowDetail}
        onEnter={dialog.close}
      />
    </div>
  );
}

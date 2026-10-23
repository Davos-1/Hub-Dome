"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ItemExtras } from "@/lib/item-extras";
import type { ShellData } from "@/lib/shell-data";
import type { ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { devPose } from "@/lib/camera-poses";
import type { TimeKey } from "@/lib/daytime";
import { buildVillageModel, type VillageModel, type WorldParams } from "@/lib/village-model";
import { GENERATOR_VERSION } from "@/lib/world/seed";
import { rerollWorld, saveWorld } from "@/app/dorf/welt-actions";
import type { WorldActions } from "@/lib/world/types";
import { docForSave, draftDoc } from "@/lib/world/build";
import { RerollBanner } from "../world/reroll-banner";
import { randomSeed } from "../world/world-settings";
import type { FriendLinkInfo } from "../world/friend-link-dialog";
import { useDialog } from "../world/use-dialog";
import { ItemExtrasProvider } from "../world/item-extras";
import { WelcomeBanner } from "../world/welcome-banner";
import { WorldDialogs } from "../world/world-dialogs";
import { BottomBar } from "./hud/bottom-bar";
import { Breadcrumb } from "./hud/breadcrumb";
import { DisplayPopup } from "./hud/display-popup";
import { SearchBox } from "./hud/search-box";
import { SideWindow, useSideWindowOpen } from "./hud/side-window";
import { makeActions, type SceneActions } from "./scene-actions";
import { BuildPanel } from "./build/build-panel";
import { createBuildStore, useBuild } from "./build/build-store";
import { createSceneStore, loadSettings, saveSettings } from "./scene-store";

const VillageScene = dynamic(() => import("./village-scene"), {
  ssr: false,
  // Während die 3D-Szene lädt: ruhiger Hinweis statt leerer Fläche
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" role="status">
      <p className="hd-card text-[14px] text-[#3a3732]">Das Dorf wird aufgebaut …</p>
    </div>
  ),
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
  /** Übernehmen, Herkunft und Nutzungszahlen (Phase 5b). */
  extras: ItemExtras;
  /** Daten für die Dialoge (Start, Reise und Freunde, Einstellungen, Hinzufügen). */
  shell: ShellData;
  /** Geöffneter Freundschaftslink: zeigt den Annehmen-Dialog über der Welt. */
  friendLink?: FriendLinkInfo;
  /** Seed, Generator-Version und Platzierungen des Dorfs (`stored`: Zeile in der Datenbank vorhanden). */
  world: WorldParams & { stored?: boolean };
  /** Speichern und neu würfeln (Server Actions; die Entwickler-Vorschau übergibt Attrappen). */
  worldActions?: WorldActions;
  /** Nur Entwickler-Vorschau: feste Kamera, Tageszeit, eingefrorene Bewegung. */
  dev?: { kamera?: string; zeit?: TimeKey; bewegung?: boolean };
};

const DEFAULT_WORLD_ACTIONS: WorldActions = { save: saveWorld, reroll: rerollWorld };

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

  const reducedMotion =
    useMedia("(prefers-reduced-motion: reduce)") || props.dev?.bewegung === false;
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
  const active = props.friendLink
    ? ("freund" as const)
    : ownerOnly && !props.isOwner
      ? null
      : dialog.id;

  const [now] = useState(() => Date.now());
  // «Welt neu würfeln»: Vorschau mit neuem Seed (Fixierungen entfallen; Deko bleibt, ausser «zurücksetzen»)
  const [preview, setPreview] = useState<string | null>(null);
  const [resetPlacements, setResetPlacements] = useState(false);
  const worldActions = props.worldActions ?? DEFAULT_WORLD_ACTIONS;
  // Bau-Modus: Entwurf (eigene Deko, Varianten) ersetzt die gespeicherten Werte, bis gespeichert wird
  const [build] = useState(() => createBuildStore(props.world.doc));
  const building = useBuild(build, (s) => s.active);
  const draft = useBuild(build, (s) => s.history.present);
  const worldParams = useMemo<WorldParams>(() => {
    if (building && !preview) return { ...props.world, doc: draftDoc(draft) };
    if (!preview) return props.world;
    const d = props.world.doc;
    return {
      seed: preview,
      version: GENERATOR_VERSION,
      doc: resetPlacements ? { v: 1 } : { v: 1, deko: d.deko, varianten: d.varianten },
    };
  }, [preview, resetPlacements, props.world, building, draft]);
  const devZeit = props.dev?.zeit;
  const devKamera = props.dev?.kamera;
  const model = useMemo(
    () => buildVillageModel(houses, artifacts, now, worldParams, { lowDetail }),
    [houses, artifacts, now, worldParams, lowDetail],
  );
  // Einstieg: beim Start-Dialog steht die Kamera zuerst weit draussen
  const [store] = useState(() => createSceneStore({ intro: dialog.id === "start" }));
  const actions = useMemo(() => makeActions(store, model), [store, model]);
  // Die Live-Prüfung rechnet gegen die aktuelle (Entwurfs-)Welt
  useEffect(() => build.setWorld(model.world), [build, model]);
  useEffect(() => store.set({ building }), [store, building]);

  const startBuild = () => {
    store.set({ panel: null, nav: { level: "dorf" } });
    build.start(props.world.doc);
  };
  const saveBuild = async () => {
    const doc = docForSave(build.get().history.present, model.world.settlement);
    build.saving(true);
    const res = await worldActions.save(doc);
    if ("error" in res) {
      const list = res.abgewiesen?.map((a) => a.grund).join(" ") ?? "";
      build.saving(false, `${res.error}${list ? ` ${list}` : ""}`);
      return;
    }
    build.saving(false);
    build.stop();
    router.refresh();
  };
  const windowOpen = useSideWindowOpen(store);

  // Gespeicherte Einstellungen laden, danach jede Änderung speichern.
  useEffect(() => {
    if (devZeit) {
      // Entwickler-Vorschau: feste Tageszeit, nichts im Browser speichern
      store.set({ time: devZeit });
      return;
    }
    store.set(loadSettings());
    return store.subscribe(() => {
      const s = store.get();
      saveSettings({ view: s.view, time: s.time, filter: s.filter });
    });
  }, [store, devZeit]);

  // Entwickler-Vorschau: feste Kamerapose (Übersicht, Vogel, Strasse, Quartier, Haus eines Typs)
  useEffect(() => {
    if (!devKamera) return;
    const typ = devKamera.startsWith("haus-") ? devKamera.slice(5) : null;
    const house = typ
      ? model.houses.find(
          (h) =>
            h.kind !== "zentrale" &&
            (typ === "baustelle"
              ? h.items.length === 0
              : h.items.length > 0 && h.style.type === typ),
        )
      : undefined;
    if (devKamera === "ufer") {
      // Ufer: Brücke, sonst See oder Teich, schräg von oben
      const m = model.world.map;
      const t = m.bridge ?? m.lake ?? m.pond;
      if (t) {
        const a = Math.atan2(t.x, t.z);
        const d = m.bridge ? 13 : "r" in t ? t.r + 10 : 12;
        store.set({
          devPose: {
            position: [t.x - Math.sin(a + 0.5) * d, 7, t.z - Math.cos(a + 0.5) * d],
            target: [t.x, 0, t.z],
          },
        });
        return;
      }
    }
    store.set({ devPose: devPose(model.layout, devKamera, house?.id) });
  }, [store, devKamera, model]);

  // Zurück im Tab (z.B. nach dem Platzieren in claude.ai): Dorfdaten neu laden, höchstens alle 10 s.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 10_000) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  // Sobald der Start-Dialog nicht mehr offen ist, fliegt die Kamera zur Übersicht ein.
  useEffect(() => {
    if (active !== "start") store.set({ intro: false });
  }, [active, store]);

  // Esc schliesst zuerst offene Popups, sonst geht es eine Ebene zurück (nicht bei offenem Dialog:
  // der Dialog behandelt Esc selbst).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[data-hd-dialog]")) return;
      // Im Bau-Modus gehören Pfeile, Enter und Esc der Werkzeugleiste
      if (store.get().building) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      // Tastenkürzel L: Liste öffnen
      if ((e.key === "l" || e.key === "L") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dialog.open("liste");
        return;
      }
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
  }, [store, actions, dialog]);

  const ownVillage = shell.villages.find((v) => v.mine);
  const empty = model.houses.length <= 1;
  const friendRequests = shell.friends.filter((f) => f.status === "eingehend").length;
  const extras = useMemo(
    () => ({
      ...props.extras,
      isOwner: props.isOwner,
      houses: Object.fromEntries(houses.map((h) => [h.id, h])),
    }),
    [props.extras, props.isOwner, houses],
  );

  return (
    <ItemExtrasProvider value={extras}>
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
              build={props.isOwner ? build : undefined}
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
          {building ? (
            <BuildPanel
              build={build}
              model={model}
              onSave={saveBuild}
              onCancel={() => build.stop()}
            />
          ) : (
            <BottomBar
              store={store}
              actions={actions}
              windowOpen={windowOpen}
              friendRequests={friendRequests}
              onTravel={() => dialog.open("reise")}
              onList={() => dialog.open("liste")}
              onSettings={() => dialog.open("einstellungen", { tab: "profil" })}
              onAddHouse={props.isOwner ? () => dialog.open("haus") : undefined}
              onBuild={props.isOwner && !preview ? startBuild : undefined}
            />
          )}
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
          {preview && props.isOwner && active === null && (
            <RerollBanner
              model={model}
              reset={resetPlacements}
              onReset={setResetPlacements}
              onAgain={() => setPreview(randomSeed())}
              reroll={worldActions.reroll}
              onCancel={() => setPreview(null)}
              onDone={() => {
                setPreview(null);
                router.refresh();
              }}
            />
          )}
          {/* Begrüssung für Besucher (nicht in fixen Entwickler-Ansichten, sie verdeckt die Szene) */}
          {!props.isOwner && active === null && !devKamera && (
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
          friendLink={props.friendLink}
          model={model}
          houses={houses}
          artifacts={artifacts}
          isOwner={props.isOwner}
          villageName={props.villageName}
          ownerUsername={ownerUsername}
          lowDetail={lowDetail}
          actions={actions}
          onEnter={dialog.close}
          onPreviewSeed={setPreview}
        />
      </div>
    </ItemExtrasProvider>
  );
}

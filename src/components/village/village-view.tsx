"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { signOut } from "@/app/doerfer/actions";
import { setTimeMode } from "@/app/einstellungen/actions";
import type { ItemExtras } from "@/lib/item-extras";
import type { ShellData } from "@/lib/shell-data";
import type { ZentraleStyle } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { devPose } from "@/lib/camera-poses";
import { resolveTime, zurichHour, type TimeKey } from "@/lib/daytime";
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
import { WorldDialogs } from "../world/world-dialogs";
import { BottomBar } from "./hud/bottom-bar";
import { Breadcrumb } from "./hud/breadcrumb";
import { CommandPalette, type Command } from "./hud/command-palette";
import { HintCard } from "./hud/hint-card";
import { ListGrip, ListPanel, listWidth } from "./hud/list-panel";
import { Selection } from "./hud/selection";
import { TafelHost } from "./hud/tafel-host";
import { Inventory } from "./hud/inventory";
import { HouseTooltip } from "./hud/tooltip";
import { TravelLoader, VisitBand } from "./hud/visit-band";
import { TopRight } from "./hud/top-right";
import { ToastView, UiProvider, useUi } from "./hud/ui-context";
import { ZOOM_END, ZoomSlider } from "./hud/zoom-slider";
import { createOverlayStore } from "./overlay-store";
import { makeActions, type SceneActions } from "./scene-actions";
import { BuildHud } from "./build/build-hud";
import { createBuildStore, useBuild } from "./build/build-store";
import { createSceneStore, loadSettings, saveSettings, useScene } from "./scene-store";

const VillageScene = dynamic(() => import("./village-scene"), {
  ssr: false,
  // Während die 3D-Szene lädt: ruhiger Hinweis statt leerer Fläche
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" role="status">
      <p className="hd-card text-[14px] text-hd-ink-2">Das Dorf wird aufgebaut …</p>
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
  /** Daten für Dialoge und Bereiche (Start, Reise und Freunde, Einstellungen, Haus anlegen). */
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

/** Ersatz ohne WebGL: alle Häuser nach Quartier als Liste; die Auswahl öffnet die Tafel. */
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
            onClick={() => actions.openTafel(zentrale.id, "haus")}
          >
            Zentrale ({zentrale.items.length})
          </button>
        )}
        {model.layout.quarters.map((q) => (
          <section key={q.id} className="hd-card flex flex-col gap-2">
            <h2 className="text-[14px] font-bold">{q.name}</h2>
            <ul className="flex flex-col gap-1.5">
              {q.houseIds.map((id) => {
                const h = model.byId[id];
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => actions.openTafel(id, "haus")}
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

/** Vollbild-3D mit der Oberfläche «Werkbank» (Phase 4h): Tafeln am Ort, Liste, Leiste, Dialoge. */
export function VillageView(props: Props) {
  return (
    <UiProvider>
      <VillageShell {...props} />
    </UiProvider>
  );
}

function VillageShell(props: Props) {
  const { ownerUsername, shell } = props;
  const ui = useUi();
  const dialog = useDialog();
  const router = useRouter();

  // Gelöschtes (noch nicht an den Server geschickt) ist sofort weg; «Rückgängig» holt es zurück
  const houses = useMemo(
    () => props.houses.filter((h) => !ui.hidden.has(h.id)),
    [props.houses, ui.hidden],
  );
  const artifacts = useMemo(
    () => props.artifacts.filter((a) => !ui.hidden.has(a.id) && !ui.hidden.has(a.house_id)),
    [props.artifacts, ui.hidden],
  );

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

  // Welcher Dialog ist offen? Start gilt nur im eigenen Dorf; Bearbeiten-Adressen öffnen Tafeln (siehe unten).
  const legacy = ["objekt", "objektedit", "haus", "hausedit", "liste"].includes(dialog.id ?? "");
  const active = props.friendLink
    ? ("freund" as const)
    : legacy || (dialog.id === "start" && !props.isOwner)
      ? null
      : dialog.id;

  // Einstellungen und Reise sind Vollbild-Bereiche: die Oberfläche der Welt tritt zurück
  const screen = active === "einstellungen" || active === "reise" ? active : null;
  const [now] = useState(() => Date.now());
  const [hour] = useState(() => zurichHour());
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
    // Aktualisieren (gleicher Seed, neue Version): Hausplätze und Quartiere werden mitgenommen
    const upgrade = preview === props.world.seed;
    return {
      seed: preview,
      version: GENERATOR_VERSION,
      doc: resetPlacements
        ? { v: 1 }
        : {
            v: 1,
            deko: d.deko,
            varianten: d.varianten,
            ...(upgrade ? { quartiere: d.quartiere, haeuser: d.haeuser } : {}),
          },
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
  const [overlay] = useState(createOverlayStore);
  const actions = useMemo(() => makeActions(store, model), [store, model]);
  const tafelOpen = useScene(store, (s) => s.tafel !== null);
  const listW = useScene(store, (s) => s.listW);
  const inv = useScene(store, (s) => s.inv);
  const time = useScene(store, (s) => s.time);
  const navLevel = useScene(store, (s) => s.nav.level);
  const [palette, setPalette] = useState(false);
  const [timeMode, setMode] = useState(shell.me.timeMode);
  const [traveling, startTravel] = useTransition();
  const [travelTo, setTravelTo] = useState("");
  const [over, setOver] = useState(0);
  const overTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  // Neues Haus angelegt: wird gewählt, sobald es in den Daten ist (Kamera fliegt hin)
  const pendingHouse = useRef<string | null>(null);

  // Die Live-Prüfung rechnet gegen die aktuelle (Entwurfs-)Welt
  useEffect(() => build.setWorld(model.world, model.input, model.byId), [build, model]);
  // Nur Entwickler-Vorschau: Welt und Bau-Store für E2E-Tests (Wege, Bäume, Eckpunkte finden)
  const isDev = !!props.dev;
  useEffect(() => {
    if (isDev) window.__hubDomeDev = { world: model.world, build };
  }, [isDev, model, build]);
  useEffect(() => store.set({ building, buildFocus: null }), [store, building]);
  // Bau-Modus beendet (Speichern, Abbrechen): Fokus zurück auf «Bauen». Der Knopf entsteht erst mit diesem
  // Wechsel neu (oben rechts wird nur ausserhalb des Bau-Modus gezeichnet), darum fokussiert ihn die Ansicht
  // und nicht `BuildHud`. Nur wenn der Fokus verloren ging (Knopf «Speichern» ist weg), nichts wegnehmen.
  const wasBuilding = useRef(false);
  useEffect(() => {
    if (wasBuilding.current && !building) {
      const a = document.activeElement;
      if (!a || a === document.body)
        document
          .querySelector<HTMLElement>('[aria-keyshortcuts="B"]')
          ?.focus({ preventScroll: true });
    }
    wasBuilding.current = building;
  }, [building]);
  // Bau-Modus: Haus oder Quartier gewählt → Kamera zum Quartier (beim Abwählen bleibt sie dort)
  useEffect(() => {
    const off = build.subscribe(() => {
      const s = build.get();
      // Während des Ziehens bleibt die Kamera stehen (sonst wandert der Punkt unter dem Zeiger); eine schon
      // laufende Fahrt beendet `CameraRig`, sobald die Steuerung fürs Ziehen gesperrt wird
      if (s.drag || s.point) return;
      const q =
        s.quarter ?? (s.house ? (model.world.settlement.houses[s.house]?.quarterId ?? null) : null);
      if (q && q !== store.get().buildFocus) store.set({ buildFocus: q });
    });
    return () => {
      off();
    };
  }, [build, store, model]);

  useEffect(() => {
    const id = pendingHouse.current;
    if (id && model.byId[id]) {
      pendingHouse.current = null;
      actions.openHouse(id);
    }
  }, [model, actions]);

  const toggleList = useCallback(() => {
    const s = store.get();
    store.set(s.listW ? { listW: 0 } : { listW: listWidth(), inv: false });
  }, [store]);
  const openInv = useCallback(() => {
    store.set({ inv: true, listW: 0, tafel: null, nav: { level: "dorf" }, camHold: false });
    setOver(0);
  }, [store]);
  const closeInv = useCallback(() => store.set({ inv: false }), [store]);
  const toggleInv = useCallback(
    () => (store.get().inv ? closeInv() : openInv()),
    [store, openInv, closeInv],
  );

  const startBuild = useCallback(() => {
    store.set({ nav: { level: "dorf" }, tafel: null, listW: 0, inv: false });
    build.start(props.world.doc);
  }, [store, build, props.world.doc]);
  const saveBuild = async () => {
    const doc = docForSave(
      build.get().history.present,
      model.world.settlement,
      model.world.invalidTreeMoves,
    );
    build.saving(true);
    const res = await worldActions.save(doc);
    if ("error" in res) {
      const list = res.abgewiesen?.map((a) => a.grund).join(" ") ?? "";
      build.saving(false, `${res.error}${list ? ` ${list}` : ""}`);
      return;
    }
    build.saving(false);
    build.stop();
    ui.say("Dorf gespeichert");
    router.refresh();
  };

  // Alte Adressen (`?d=objekt&h=…`, `?d=liste` …) öffnen die neuen Tafeln bzw. die Liste
  useEffect(() => {
    const id = dialog.id;
    if (!id || !["objekt", "objektedit", "haus", "hausedit", "liste"].includes(id)) return;
    if (id === "liste") store.set({ listW: listWidth() });
    else if (props.isOwner) {
      if (id === "haus") actions.openLooseTafel("hausneu");
      if (id === "objekt") {
        const h =
          dialog.houseId && model.byId[dialog.houseId] ? dialog.houseId : actions.zentraleId;
        if (h) actions.openTafel(h, "neu");
      }
      if (id === "objektedit") {
        const a = artifacts.find((x) => x.id === dialog.objectId);
        if (a) actions.openTafel(a.house_id, "objektedit", a.id);
      }
      if (id === "hausedit" && dialog.houseId && model.byId[dialog.houseId])
        actions.openTafel(dialog.houseId, "hausedit");
    }
    dialog.close();
    // Nur beim Wechsel der Adresse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog.id]);

  // Gespeicherte Einstellungen laden, danach jede Änderung speichern.
  useEffect(() => {
    if (devZeit) {
      // Entwickler-Vorschau: feste Tageszeit, nichts im Browser speichern
      store.set({ time: devZeit });
      return;
    }
    // Tageszeit: «Auto» (Profil) folgt Zürich; «Fest» behält die zuletzt gewählte Zeit dieses Browsers
    const loaded = loadSettings();
    if (shell.me.timeMode === "auto") loaded.time = "auto";
    else if (!loaded.time || loaded.time === "auto")
      loaded.time = resolveTime("auto", zurichHour());
    store.set(loaded);
    return store.subscribe(() => {
      const s = store.get();
      saveSettings({ view: s.view, time: s.time, filter: s.filter });
    });
    // Nur beim Laden: der Modus kommt aus dem Profil
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, devZeit]);

  // Einstellungen offen: Welt als Streifen oben (wie im Inventar)
  useEffect(() => store.set({ strip: active === "einstellungen" }), [store, active]);

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
            position: [t.x - Math.sin(a + 0.5) * d, 11, t.z - Math.cos(a + 0.5) * d],
            target: [t.x, 0, t.z],
          },
        });
        return;
      }
    }
    // Zentrale und Häuser wie nach einem Klick auf «Öffnen» (Tafel offen, Kamera eingepasst)
    const zentrale = model.houses.find((h) => h.kind === "zentrale");
    const target = devKamera === "zentrale" ? zentrale : house;
    if (target) {
      store.set({ devPose: null });
      actions.openTafel(target.id, "haus");
      return;
    }
    store.set({ devPose: devPose(model.layout, devKamera) });
  }, [store, devKamera, model, actions]);

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

  // Tastatur: Strg/⌘+K bzw. «/» Suche, L Liste, I Inventar, B Bauen; Esc von innen nach aussen
  // (Tafel → Auswahl → Liste → Inventar); Pfeile und Enter wählen Quartiere und Häuser.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[data-hd-dialog]")) return;
      // Vollbild-Bereiche: Esc schliesst, alles andere gehört dem Bereich
      if (screen) {
        if (e.key === "Escape") {
          e.preventDefault();
          dialog.close();
        }
        return;
      }
      // Im Bau-Modus gehören Pfeile, Enter und Esc der Werkzeugleiste
      if (store.get().building) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (e.key === "Escape") {
        if (typing) target!.blur();
        const s = store.get();
        e.preventDefault();
        if (s.inv) return closeInv();
        if (s.tafel || s.nav.level !== "dorf") {
          actions.onKey("Escape");
          return;
        }
        if (s.listW) store.set({ listW: 0 });
        return;
      }
      if (typing || mod || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "l") {
        e.preventDefault();
        toggleList();
        return;
      }
      if (k === "i" && props.isOwner) {
        e.preventDefault();
        toggleInv();
        return;
      }
      if (k === "b" && props.isOwner && !preview) {
        e.preventDefault();
        startBuild();
        return;
      }
      // Pfeile und Enter nicht abfangen, wenn der Fokus in Liste, Tafel oder Inventar liegt
      if (target?.closest("[data-hd-ui]")) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
        if (e.key === "Enter" && target && /^(BUTTON|A)$/.test(target.tagName)) return;
        if (actions.onKey(e.key)) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    store,
    actions,
    toggleList,
    toggleInv,
    closeInv,
    startBuild,
    props.isOwner,
    preview,
    screen,
    dialog,
  ]);

  // Weiter herauszoomen am Anschlag füllt den Hinweis; voll = Inventar (nur Besitzer)
  const onWheel = (e: React.WheelEvent) => {
    // Inventar offen: Hereinzoomen über dem Welt-Streifen schliesst es (im Inventar selbst wird gescrollt)
    if (store.get().inv) {
      if (e.deltaY < 0 && !(e.target as HTMLElement).closest("[data-hd-inv]")) closeInv();
      return;
    }
    if (!props.isOwner || store.get().building || e.deltaY <= 0) return;
    if (overlay.get().zoom < ZOOM_END) return;
    const next = over + Math.min(40, Math.abs(e.deltaY) / 3);
    if (overTimer.current) clearTimeout(overTimer.current);
    if (next >= 100) {
      openInv();
      return;
    }
    setOver(next);
    overTimer.current = setTimeout(() => setOver(0), 1100);
  };

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
  const timeKey = resolveTime(time, hour);
  /** Tageszeit-Modus wechseln (Einstellungen) und im Profil speichern (nicht in der Entwickler-Vorschau). */
  const changeMode = (m: "auto" | "fest") => {
    setMode(m);
    store.set({ time: m === "auto" ? "auto" : resolveTime(store.get().time, zurichHour()) });
    if (!props.dev) void setTimeMode(m).then((r) => r.error && ui.say(r.error, { error: true }));
  };
  const travel = (username: string) => {
    setTravelTo(username);
    startTravel(() => router.push(`/dorf/${encodeURIComponent(username)}`));
  };
  const openSettings = (tab = "profil") => dialog.open("einstellungen", { tab });
  const openTravel = () => dialog.open("reise");
  const addHouse = props.isOwner ? () => actions.openLooseTafel("hausneu") : undefined;

  const commands: Command[] = [
    { id: "liste", label: "Liste öffnen", hint: "L", run: toggleList },
    ...(props.isOwner
      ? [
          { id: "inventar", label: "Inventar öffnen", hint: "I", run: openInv },
          { id: "bauen", label: "Bauen", hint: "B", run: startBuild },
          { id: "haus", label: "Haus anlegen", run: () => actions.openLooseTafel("hausneu") },
        ]
      : []),
    { id: "reise", label: "Reise und Freunde", run: openTravel },
    { id: "einstellungen", label: "Einstellungen", run: () => openSettings() },
    {
      id: "ansicht",
      label: "Ansicht wechseln (3D/Karte)",
      run: () => actions.setView(store.get().view === "3d" ? "karte" : "3d"),
    },
    { id: "dorf", label: "Zur Übersicht", run: actions.goHome },
  ];

  const hudHidden = active !== null;
  const paused = active !== null || inv;

  return (
    <ItemExtrasProvider value={extras}>
      <div
        className="hubdome-ui fixed inset-0 overflow-hidden bg-hd-surface text-hd-ink"
        role="application"
        aria-label={`3D-Ansicht des Dorfs ${props.villageName}. Alle Häuser und Objekte sind auch über die Liste und die Suche (Strg+K) erreichbar.`}
        onPointerDown={(e) => (pointerDown.current = { x: e.clientX, y: e.clientY })}
        onWheel={onWheel}
      >
        {webgl === false ? (
          <div inert={hudHidden} aria-hidden={hudHidden || undefined}>
            <FallbackList model={model} actions={actions} />
          </div>
        ) : webgl ? (
          <div
            className="hd-fade-in absolute inset-0"
            tabIndex={-1}
            inert={hudHidden}
            aria-hidden={hudHidden || undefined}
          >
            <VillageScene
              villageId={props.villageId}
              ownerName={props.ownerName}
              avatarSeed={props.avatarSeed}
              zentraleStyle={props.zentraleStyle}
              model={model}
              store={store}
              overlay={overlay}
              actions={actions}
              isOwner={props.isOwner}
              onMissed={(e) => {
                // Klick auf den Rasen (nicht nach dem Ziehen der Kamera): Auswahl aufheben
                const p = pointerDown.current;
                if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) return;
                if (!store.get().building) actions.clearSelection();
              }}
              onConstruction={(houseId) => actions.openTafel(houseId, "neu")}
              lowDetail={lowDetail}
              reducedMotion={reducedMotion}
              build={props.isOwner ? build : undefined}
              paused={paused}
            />
          </div>
        ) : null}

        <div
          className="pointer-events-none absolute inset-0"
          inert={hudHidden}
          aria-hidden={hudHidden || undefined}
        >
          {!building && !screen && (
            <>
              <ListPanel
                model={model}
                store={store}
                actions={actions}
                artifacts={artifacts}
                isOwner={props.isOwner}
              />
              {!inv && <ListGrip store={store} />}
              {props.isOwner && (
                <Inventory
                  model={model}
                  store={store}
                  actions={actions}
                  artifacts={artifacts}
                  onClose={closeInv}
                />
              )}
              <Breadcrumb
                model={model}
                store={store}
                actions={actions}
                villageName={props.villageName}
              />
              <TopRight
                isOwner={props.isOwner}
                listOpen={listW > 0}
                invOpen={inv}
                initial={(shell.me.displayName || shell.me.username).slice(0, 1).toUpperCase()}
                username={shell.me.username}
                onBuild={props.isOwner && !preview ? startBuild : undefined}
                onList={toggleList}
                onInv={toggleInv}
                onSearch={() => setPalette(true)}
                onSettings={() => openSettings()}
                logout={() => void signOut()}
              />
              <Selection
                model={model}
                store={store}
                overlay={overlay}
                actions={actions}
                isOwner={props.isOwner}
                reducedMotion={reducedMotion}
                onList={() => store.set({ listW: listW || listWidth(), inv: false })}
                onEditZentrale={() => openSettings("dorf")}
              />
              <HouseTooltip model={model} store={store} overlay={overlay} />
              <TafelHost
                model={model}
                store={store}
                actions={actions}
                houses={houses}
                artifacts={artifacts}
                previews={props.previews}
                isOwner={props.isOwner}
                modules={shell.own?.modules ?? []}
                onNewHouse={(id) => {
                  pendingHouse.current = id;
                  if (model.byId[id]) actions.openHouse(id);
                }}
              />
              {!tafelOpen && !inv && (
                <BottomBar
                  store={store}
                  actions={actions}
                  timeKey={timeKey}
                  timeAuto={time === "auto"}
                  onTime={(next) => {
                    store.set({ time: next });
                    // Ein Klick auf die Tageszeit heisst «Fest»
                    if (timeMode === "auto") {
                      setMode("fest");
                      if (!props.dev)
                        void setTimeMode("fest").then(
                          (r) => r.error && ui.say(r.error, { error: true }),
                        );
                    }
                  }}
                  friendRequests={friendRequests}
                  onTravel={openTravel}
                  onSettings={() => openSettings()}
                  onAddHouse={addHouse}
                />
              )}
              {inv && (
                <button
                  type="button"
                  onClick={closeInv}
                  className="hd-rise pointer-events-auto absolute top-[96px] left-1/2 -translate-x-1/2 cursor-pointer rounded-full border border-hd-line bg-hd-surface px-3.5 py-[7px] text-[12.5px] font-semibold whitespace-nowrap"
                >
                  ↑ Hereinzoomen oder Esc · zurück ins Dorf
                </button>
              )}
              {!inv && (
                <ZoomSlider
                  overlay={overlay}
                  over={over}
                  onInventory={props.isOwner ? openInv : undefined}
                />
              )}
              <HintCard
                left={listW}
                hidden={tafelOpen || inv || !props.isOwner || empty || navLevel !== "dorf"}
              />
            </>
          )}
          {building && (
            <BuildHud
              build={build}
              model={model}
              onSave={saveBuild}
              onCancel={() => {
                build.stop();
                ui.say("Änderungen verworfen");
              }}
            />
          )}
          {empty && props.isOwner && !tafelOpen && !building && (
            <div className="hd-box hd-rise pointer-events-auto absolute top-16 left-4 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 px-5 py-4">
              <span className="hd-kicker">Leeres Dorf</span>
              <span className="text-[15px] font-bold">Lege dein erstes Haus an</span>
              <span className="text-[13px] text-hd-muted">
                Ein Haus pro Modul oder Thema; darin hängst du deine Objekte auf.
              </span>
              <button
                type="button"
                onClick={() => actions.openLooseTafel("hausneu")}
                className="hd-btn hd-btn-primary self-start"
              >
                Haus anlegen
              </button>
            </div>
          )}
          {empty && !props.isOwner && (
            <p className="hd-box pointer-events-auto absolute top-16 left-1/2 -translate-x-1/2 px-4 py-3 text-[13px]">
              Hier gibt es noch keine Häuser.
            </p>
          )}
          {preview && props.isOwner && active === null && (
            <RerollBanner
              upgrade={preview === props.world.seed}
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
          {/* Besuchsband (nicht in fixen Entwickler-Ansichten, es verdeckt die Szene) */}
          {!props.isOwner && !screen && !devKamera && (
            <VisitBand
              villageName={props.villageName}
              ownerName={props.ownerName}
              onHome={() => travel(ownVillage?.ownerUsername ?? shell.me.username)}
            />
          )}
          <ToastView />
        </div>

        {palette && (
          <CommandPalette
            model={model}
            commands={commands}
            onHouse={(id) => actions.openHouse(id)}
            onObject={(houseId, id) => actions.goToObject(houseId, id)}
            onClose={() => setPalette(false)}
          />
        )}

        <WorldDialogs
          active={active}
          dialog={dialog}
          shell={shell}
          friendLink={props.friendLink}
          model={model}
          isOwner={props.isOwner}
          villageName={props.villageName}
          ownerUsername={ownerUsername}
          lowDetail={lowDetail}
          onEnter={dialog.close}
          onAddHouse={() => {
            dialog.close();
            actions.openLooseTafel("hausneu");
          }}
          onPreviewSeed={setPreview}
          timeMode={timeMode}
          onTimeMode={changeMode}
          onTravel={travel}
        />
        {traveling && <TravelLoader to={travelTo} />}
      </div>
    </ItemExtrasProvider>
  );
}

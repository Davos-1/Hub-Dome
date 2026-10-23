import { useSyncExternalStore } from "react";
import type { Nav, Pose, ViewMode } from "@/lib/camera-poses";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { TimeSetting } from "@/lib/daytime";
import type { ArtifactKind } from "@/lib/types";

/** Zustand der 3D-Ansicht, geteilt zwischen Szene (Canvas) und Oberfläche (Leiste, Fenster, Suche). */
export type SceneState = {
  nav: Nav;
  view: ViewMode;
  time: TimeSetting;
  filter: ArtifactKind | "";
  hoverHouseId: string | null;
  hoverObjId: string | null;
  /** Angeheftetes Objekt (Suche, Anschlagbrett, Klick): Karte bleibt sichtbar, Ring pulsiert. */
  pinnedObjId: string | null;
  /** Pulsierender Ring am Boden (7 s), `t0` in Millisekunden (performance.now). */
  highlight: { kind: "obj" | "house"; id: string; t0: number } | null;
  kbdQuarter: FachbereichId | null;
  kbdHouse: string | null;
  /** Kleines Anzeige-Fenster (Tageszeit, Ansicht, Filter); Einstellungen und Co. sind Dialoge der Welt-Shell. */
  panel: null | "anzeige";
  /** Einstiegsbild: die Kamera steht weit weg, bis der Start-Dialog geschlossen wird. */
  intro: boolean;
  /** Feste Kamerapose (nur Entwickler-Vorschau und Screenshot-Matrix). */
  devPose: Pose | null;
  /** Bau-Modus aktiv: Klicks in der Szene wählen und setzen statt zu navigieren. */
  building: boolean;
};

export const initialSceneState: SceneState = {
  nav: { level: "dorf" },
  view: "3d",
  time: "mittag",
  filter: "",
  hoverHouseId: null,
  hoverObjId: null,
  pinnedObjId: null,
  highlight: null,
  kbdQuarter: null,
  kbdHouse: null,
  panel: null,
  intro: false,
  devPose: null,
  building: false,
};

export type SceneStore = {
  get: () => SceneState;
  set: (patch: Partial<SceneState>) => void;
  subscribe: (fn: () => void) => () => void;
};

export function createSceneStore(initial: Partial<SceneState> = {}): SceneStore {
  let state: SceneState = { ...initialSceneState, ...initial };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      let changed = false;
      for (const k of Object.keys(patch) as (keyof SceneState)[]) {
        if (state[k] !== patch[k]) changed = true;
      }
      if (!changed) return;
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Liest einen Teil des Zustands (die Auswahl muss einen stabilen Wert liefern, z.B. Primitive oder Teilobjekt). */
export function useScene<T>(store: SceneStore, select: (s: SceneState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(initialSceneState),
  );
}

const STORAGE_KEY = "hubdome-dorf3d-settings";

/** Nutzereinstellungen (Ansicht, Tageszeit, Filter) im Browser merken. */
export function loadSettings(): Partial<Pick<SceneState, "view" | "time" | "filter">> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const out: Partial<Pick<SceneState, "view" | "time" | "filter">> = {};
    if (raw.view === "3d" || raw.view === "karte") out.view = raw.view;
    if (["morgen", "mittag", "abend", "nacht", "auto"].includes(raw.time)) out.time = raw.time;
    if (typeof raw.filter === "string") out.filter = raw.filter as ArtifactKind | "";
    return out;
  } catch {
    return {};
  }
}

export function saveSettings(s: Pick<SceneState, "view" | "time" | "filter">) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ view: s.view, time: s.time, filter: s.filter }),
    );
  } catch {
    /* Speicher nicht verfügbar: Einstellungen gelten nur für diese Sitzung */
  }
}

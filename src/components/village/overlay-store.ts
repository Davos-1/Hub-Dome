import { useSyncExternalStore } from "react";
import type { Rect } from "./hud/layout";

/**
 * Bildschirmlage der Szene für die Oberfläche (Phase 4h): Hülle des gewählten und des überfahrenen Hauses in
 * Pixeln, Kamerafahrt, Zoomstufe. Eigener kleiner Store, damit die Projektion (bei jeder Kamerabewegung) nur
 * Sucher, Kacheln, Tooltip und Zoomregler neu zeichnet, nicht die ganze Oberfläche.
 */
export type OverlayState = {
  /** Hülle des gewählten Hauses (Ebene «haus») auf dem Bildschirm. */
  sel: Rect | null;
  /** Hülle des überfahrenen Hauses (Tooltip). */
  hover: Rect | null;
  /** Haus, zu dem die erste Fahrt fertig ist: erst dann erscheinen Sucher und Kacheln. */
  arrived: string | null;
  /** Kamera fährt gerade. */
  flying: boolean;
  /** Zoomstufe 0 (ganz nah) bis 1 (ganz weit). */
  zoom: number;
};

export type OverlayStore = {
  get: () => OverlayState;
  set: (patch: Partial<OverlayState>) => void;
  subscribe: (fn: () => void) => () => void;
  /** Von der Szene gesetzt: Kamera um den Faktor näher (< 1) bzw. weiter weg (> 1). */
  zoomBy: (factor: number) => void;
  registerZoom: (fn: ((factor: number) => void) | null) => void;
};

const INITIAL: OverlayState = { sel: null, hover: null, arrived: null, flying: false, zoom: 0.5 };

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5);

export function createOverlayStore(): OverlayStore {
  let state = INITIAL;
  let zoomFn: ((factor: number) => void) | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      let changed = false;
      for (const k of Object.keys(patch) as (keyof OverlayState)[]) {
        const a = state[k];
        const b = patch[k];
        const same =
          k === "sel" || k === "hover"
            ? sameRect(a as Rect | null, b as Rect | null)
            : k === "zoom"
              ? Math.abs((a as number) - (b as number)) < 0.002
              : a === b;
        if (!same) changed = true;
      }
      if (!changed) return;
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    zoomBy: (factor) => zoomFn?.(factor),
    registerZoom: (fn) => {
      zoomFn = fn;
    },
  };
}

export function useOverlay<T>(store: OverlayStore, select: (s: OverlayState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(INITIAL),
  );
}

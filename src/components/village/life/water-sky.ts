import { useSyncExternalStore } from "react";
import type * as THREE from "three";

/**
 * Himmel als Umgebung für Wasserflächen (Spiegelung, Glanz): `Daylight` erzeugt ihn je Tageszeit, Fluss, See
 * und Teich lesen ihn. Nur das Wasser nutzt ihn, der Rest der Szene bleibt unverändert beleuchtet.
 */
let current: THREE.Texture | null = null;
const listeners = new Set<() => void>();

export function setWaterSky(t: THREE.Texture | null) {
  current = t;
  listeners.forEach((fn) => fn());
}

export function useWaterSky(): THREE.Texture | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
}

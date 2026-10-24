import { useSyncExternalStore } from "react";

let cached = { width: 1280, height: 800 };

function read() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== cached.width || h !== cached.height) cached = { width: w, height: h };
  return cached;
}

/** Grösse des Fensters (die Welt füllt es ganz); auf dem Server 1280 × 800. */
export function useViewport() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("resize", cb);
      return () => window.removeEventListener("resize", cb);
    },
    read,
    () => cached,
  );
}

"use client";

import { useEffect } from "react";

/** Stilvariante der Oberfläche (Phase 4g, Etappe 5) zur Ansicht: setzt `data-hd-theme` am Wurzelelement. */
export function ThemeAttr({ thema }: { thema: string | undefined }) {
  useEffect(() => {
    if (!thema) return;
    const root = document.documentElement;
    root.dataset.hdTheme = thema;
    return () => {
      delete root.dataset.hdTheme;
    };
  }, [thema]);
  return null;
}

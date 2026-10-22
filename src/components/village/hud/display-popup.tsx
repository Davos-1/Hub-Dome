"use client";

import { useEffect } from "react";
import { TIME_LABELS, type TimeSetting } from "@/lib/daytime";
import { ARTIFACT_KIND_LABELS, type ArtifactKind } from "@/lib/types";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";
import { FILTER_KINDS, Segments, TIME_ORDER } from "./side-window";

/**
 * Kleines Fenster in der Ecke mit den Anzeige-Optionen: Tageszeit, Ansicht, Kategorie-Filter.
 * Änderungen gelten sofort; das Fenster lässt die Welt dahinter sichtbar.
 */
export function DisplayPopup({ store, actions }: { store: SceneStore; actions: SceneActions }) {
  const open = useScene(store, (s) => s.panel === "anzeige");
  const time = useScene(store, (s) => s.time);
  const view = useScene(store, (s) => s.view);
  const filter = useScene(store, (s) => s.filter);

  // Esc schliesst das kleine Fenster (der Dialog-Handler greift hier nicht, es ist kein Dialog)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.set({ panel: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, store]);

  if (!open) return null;
  return (
    <aside
      aria-label="Anzeige"
      className="hd-pop-in pointer-events-auto absolute left-3 bottom-[88px] z-20 flex w-[min(320px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border-[3px] border-[#5e3c22] bg-[#fbf6ea] shadow-[0_12px_40px_rgba(28,27,25,.3)]"
    >
      <div className="hd-plank flex items-center justify-between px-4 py-2.5">
        <div>
          <div className="hd-kicker">Hub Dome</div>
          <h2 className="text-[16px] leading-tight font-bold">Anzeige</h2>
        </div>
        <button
          type="button"
          onClick={() => store.set({ panel: null })}
          aria-label="Anzeige schliessen"
          className="h-7 w-7 cursor-pointer rounded-full bg-[#fbf3e4] text-[12px] font-bold text-[#5e3c22] shadow-[0_2px_0_#3e2814]"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <Segments
          label="Tageszeit"
          value={time}
          options={TIME_ORDER.map((t) => [t, TIME_LABELS[t]] as [TimeSetting, string])}
          onPick={(t) => store.set({ time: t })}
        />
        <Segments
          label="Ansicht"
          value={view}
          options={[
            ["3d", "3D"],
            ["karte", "Karte"],
          ]}
          onPick={(v) => actions.setView(v)}
        />
        <Segments
          label="Nach Kategorie filtern"
          value={filter}
          options={[
            ["", "Alle"],
            ...FILTER_KINDS.map((k) => [k, ARTIFACT_KIND_LABELS[k]] as [ArtifactKind, string]),
          ]}
          onPick={(k) => store.set({ filter: k })}
        />
      </div>
    </aside>
  );
}

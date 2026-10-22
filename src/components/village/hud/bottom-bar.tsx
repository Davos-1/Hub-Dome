"use client";

import { TIME_DOTS, TIME_LABELS } from "@/lib/daytime";
import { ARTIFACT_KIND_LABELS } from "@/lib/types";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

const seg = (on: boolean) => (on ? "bg-[#5e3c22] text-[#fbf3e4]" : "bg-transparent text-[#4a3a26]");
const flat =
  "cursor-pointer rounded-[9px] px-3 py-2 text-[13px] font-semibold text-[#1c1b19] hover:bg-[#f0e6cf]";

/** Schwebende Leiste unten: Ansicht 3D/Karte, Anzeige-Fenster, Reise, Haus anlegen, Einstellungen. */
export function BottomBar({
  store,
  actions,
  windowOpen,
  friendRequests,
  onTravel,
  onSettings,
  onAddHouse,
}: {
  store: SceneStore;
  actions: SceneActions;
  /** Rechtes Fenster offen: die Leiste rückt in die freie Fläche links davon. */
  windowOpen: boolean;
  /** Anzahl offener Freundschaftsanfragen (Hinweispunkt an «Reise»). */
  friendRequests: number;
  /** Dialog «Reise und Freunde» öffnen. */
  onTravel: () => void;
  /** Dialog «Einstellungen» öffnen. */
  onSettings: () => void;
  /** Dialog «Haus anlegen» (nur Besitzer). */
  onAddHouse?: () => void;
}) {
  const view = useScene(store, (s) => s.view);
  const time = useScene(store, (s) => s.time);
  const filter = useScene(store, (s) => s.filter);
  const panel = useScene(store, (s) => s.panel);

  return (
    <div
      className="pointer-events-none absolute bottom-[18px] flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-col items-center transition-[left] duration-[250ms] ease-out"
      style={{ left: windowOpen ? "max(calc(50% - 196px), 268px)" : "50%" }}
    >
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-[16px] border-[3px] border-[#5e3c22] bg-[#fbf6ea]/96 p-1.5 shadow-[0_6px_24px_rgba(28,27,25,.25)]">
        <div
          className="flex gap-0.5 rounded-[11px] bg-[#efe6d0] p-[3px]"
          role="group"
          aria-label="Ansicht"
        >
          {(
            [
              ["3d", "3D"],
              ["karte", "Karte"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => actions.setView(v)}
              className={`cursor-pointer rounded-lg px-3.5 py-[7px] text-[13px] font-bold ${seg(view === v)}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => store.set({ panel: panel === "anzeige" ? null : "anzeige" })}
          aria-expanded={panel === "anzeige"}
          className={`${flat} flex items-center gap-[7px] ${panel === "anzeige" ? "bg-[#f0e6cf]" : ""}`}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIME_DOTS[time] }} />
          {TIME_LABELS[time]}
          {filter && (
            <span className="flex items-center gap-1 text-[#4a3a26]">
              ·
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: KIND_COLORS[filter] }}
              />
              {ARTIFACT_KIND_LABELS[filter]}
            </span>
          )}
        </button>
        <div className="h-6 w-px bg-[#e4d9c0]" />
        <button type="button" onClick={onTravel} className={`${flat} relative`}>
          Reise
          {friendRequests > 0 && (
            <span
              aria-label={`${friendRequests} offene Freundschaftsanfragen`}
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#facc15] px-1 text-[10px] font-bold"
            >
              {friendRequests}
            </span>
          )}
        </button>
        {onAddHouse && (
          <button type="button" onClick={onAddHouse} className={flat}>
            + Haus
          </button>
        )}
        <button
          type="button"
          onClick={onSettings}
          className="hd-btn hd-btn-primary !rounded-[9px] !px-3.5 !py-2 !text-[13px]"
        >
          Einstellungen
        </button>
      </div>
    </div>
  );
}

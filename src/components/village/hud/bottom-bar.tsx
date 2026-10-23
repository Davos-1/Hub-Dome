"use client";

import { useState } from "react";
import { TIME_DOTS, TIME_LABELS } from "@/lib/daytime";
import { ARTIFACT_KIND_LABELS } from "@/lib/types";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

const seg = (on: boolean) => (on ? "bg-[#5e3c22] text-[#fbf3e4]" : "bg-transparent text-[#4a3a26]");
const flat =
  "cursor-pointer rounded-[9px] px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap text-[#1c1b19] hover:bg-[#f0e6cf] md:px-3";

/** Schwebende Leiste unten: Ansicht 3D/Karte, Anzeige-Fenster, Reise, Haus anlegen, Einstellungen. */
export function BottomBar({
  store,
  actions,
  windowOpen,
  friendRequests,
  onTravel,
  onList,
  onSettings,
  onAddHouse,
  onBuild,
}: {
  store: SceneStore;
  actions: SceneActions;
  /** Rechtes Fenster offen: die Leiste rückt in die freie Fläche links davon. */
  windowOpen: boolean;
  /** Anzahl offener Freundschaftsanfragen (Hinweispunkt an «Reise»). */
  friendRequests: number;
  /** Dialog «Reise und Freunde» öffnen. */
  onTravel: () => void;
  /** Dialog «Liste» öffnen (Tastenkürzel L). */
  onList: () => void;
  /** Dialog «Einstellungen» öffnen. */
  onSettings: () => void;
  /** Dialog «Haus anlegen» (nur Besitzer). */
  onAddHouse?: () => void;
  /** Bau-Modus starten (nur Besitzer). */
  onBuild?: () => void;
}) {
  const view = useScene(store, (s) => s.view);
  const time = useScene(store, (s) => s.time);
  const filter = useScene(store, (s) => s.filter);
  const panel = useScene(store, (s) => s.panel);
  const [more, setMore] = useState(false);
  const secondary: [string, () => void][] = [
    ...(onBuild ? ([["Bauen", onBuild]] as [string, () => void][]) : []),
    ...(onAddHouse ? ([["+ Haus anlegen", onAddHouse]] as [string, () => void][]) : []),
    ["Einstellungen", onSettings],
  ];

  return (
    <div
      className="pointer-events-none absolute bottom-[18px] flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-col items-center transition-[left] duration-[250ms] ease-out"
      style={{ left: windowOpen ? "max(calc(50% - 196px), 268px)" : "50%" }}
    >
      {/* Handy: selten gebrauchte Aktionen im Menü «Mehr» (die Leiste bleibt einzeilig) */}
      {more && (
        <div
          role="menu"
          aria-label="Mehr"
          className="hd-pop-in pointer-events-auto mb-2 flex flex-col gap-1 rounded-[14px] border-[3px] border-[#5e3c22] bg-[#fbf6ea] p-1.5 shadow-[0_6px_24px_rgba(28,27,25,.25)] md:hidden"
        >
          {secondary.map(([label, fn]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={`${flat} text-left`}
              onClick={() => {
                setMore(false);
                fn();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="pointer-events-auto flex items-center justify-center gap-1 rounded-[16px] border-[3px] border-[#5e3c22] bg-[#fbf6ea]/96 p-1 shadow-[0_6px_24px_rgba(28,27,25,.25)] md:flex-wrap md:gap-1.5 md:p-1.5">
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
              className={`cursor-pointer rounded-lg px-2.5 py-[7px] text-[13px] font-bold md:px-3.5 ${seg(view === v)}`}
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
        <div className="hidden h-6 w-px bg-[#e4d9c0] md:block" />
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
        <button type="button" onClick={onList} className={flat} aria-keyshortcuts="L">
          Liste
        </button>
        {onAddHouse && (
          <button type="button" onClick={onAddHouse} className={`${flat} hidden md:block`}>
            + Haus
          </button>
        )}
        {onBuild && (
          <button type="button" onClick={onBuild} className={`${flat} hidden md:block`}>
            Bauen
          </button>
        )}
        <button
          type="button"
          onClick={onSettings}
          className="hd-btn hd-btn-primary !hidden !rounded-[9px] !px-3.5 !py-2 !text-[13px] md:!inline-flex"
        >
          Einstellungen
        </button>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          className="hd-btn hd-btn-primary !rounded-[9px] !px-3 !py-2 !text-[13px] md:!hidden"
        >
          Mehr
        </button>
      </div>
    </div>
  );
}

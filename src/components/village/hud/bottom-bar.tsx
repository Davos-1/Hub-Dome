"use client";

import { TIME_DOTS, TIME_LABELS, type TimeSetting } from "@/lib/daytime";
import { ARTIFACT_KIND_LABELS, type ArtifactKind } from "@/lib/types";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

const TIME_ORDER: TimeSetting[] = ["morgen", "mittag", "abend", "auto"];
/** Filterbare Kategorien (ohne «Sonstiges»). */
const FILTER_KINDS: ArtifactKind[] = [
  "rechner",
  "quiz",
  "zusammenfassung",
  "cheatsheet",
  "tool",
  "visualisierung",
];

const seg = (on: boolean) => (on ? "bg-[#1c1b19] text-[#fffdf8]" : "bg-transparent text-[#3a3732]");

/** Schwebende Leiste unten: Ansicht 3D/Karte, Tageszeit, Kategorie-Filter, Einstellungen. */
export function BottomBar({
  store,
  actions,
  windowOpen,
  onTravel,
  onSettings,
  onAddHouse,
}: {
  store: SceneStore;
  actions: SceneActions;
  /** Dialog «Dörfer besuchen» öffnen. */
  onTravel: () => void;
  /** Dialog «Einstellungen» öffnen. */
  onSettings: () => void;
  /** Dialog «Haus anlegen» (nur Besitzer). */
  onAddHouse?: () => void;
  /** Rechtes Fenster offen: die Leiste rückt in die freie Fläche links davon. */
  windowOpen: boolean;
}) {
  const view = useScene(store, (s) => s.view);
  const time = useScene(store, (s) => s.time);
  const filter = useScene(store, (s) => s.filter);
  const panel = useScene(store, (s) => s.panel);

  const toggle = (p: "filter" | "time") => store.set({ panel: panel === p ? null : p });

  return (
    <>
      {(panel === "filter" || panel === "time") && (
        <div
          className="pointer-events-auto absolute inset-0"
          onClick={() => store.set({ panel: null })}
          aria-hidden
        />
      )}
      <div
        className="pointer-events-none absolute bottom-[18px] flex -translate-x-1/2 flex-col items-center gap-2.5 transition-[left] duration-[250ms] ease-out"
        style={{ left: windowOpen ? "max(calc(50% - 196px), 268px)" : "50%" }}
      >
        {panel === "filter" && (
          <div className="pointer-events-auto flex w-[min(520px,calc(100vw-32px))] flex-col gap-2 rounded-[14px] bg-[#fffdf8]/97 p-3 shadow-[0_8px_28px_rgba(28,27,25,.18)]">
            <div className="font-mono text-[12px] font-semibold tracking-[.06em] text-[#7a766d] uppercase">
              Nach Kategorie filtern
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["", ...FILTER_KINDS] as (ArtifactKind | "")[]).map((k) => {
                const on = filter === k;
                return (
                  <button
                    key={k || "alle"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      store.set({ filter: k });
                      store.set({ panel: null });
                    }}
                    className={`flex cursor-pointer items-center gap-[7px] rounded-full border px-3 py-[7px] text-[13px] font-medium ${
                      on
                        ? "border-[#1c1b19] bg-[#1c1b19] text-[#fffdf8]"
                        : "border-[#d9d4c9] bg-[#fffdf8] text-[#3a3732]"
                    }`}
                  >
                    <span
                      className="h-[9px] w-[9px] rounded-[2px]"
                      style={{ background: k ? KIND_COLORS[k] : "#1c1b19" }}
                    />
                    {k ? ARTIFACT_KIND_LABELS[k] : "Alle"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {panel === "time" && (
          <div className="pointer-events-auto flex gap-1 rounded-xl bg-[#fffdf8]/97 p-1.5 shadow-[0_8px_28px_rgba(28,27,25,.18)]">
            {TIME_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={time === t}
                onClick={() => store.set({ time: t, panel: null })}
                className={`cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium ${seg(time === t)}`}
              >
                {TIME_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-[14px] bg-[#fffdf8]/95 p-1.5 shadow-[0_6px_24px_rgba(28,27,25,.2)]">
          <div
            className="flex gap-0.5 rounded-[10px] bg-[#efeae0] p-[3px]"
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
                className={`cursor-pointer rounded-lg px-3.5 py-[7px] text-[13px] font-semibold ${seg(view === v)}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-[#e2ddd2]" />
          <button
            type="button"
            onClick={() => toggle("time")}
            aria-expanded={panel === "time"}
            className={`flex cursor-pointer items-center gap-[7px] rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#1c1b19] ${panel === "time" ? "bg-[#efeae0]" : ""}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIME_DOTS[time] }} />
            {TIME_LABELS[time]}
          </button>
          <button
            type="button"
            onClick={() => toggle("filter")}
            aria-expanded={panel === "filter"}
            className={`flex cursor-pointer items-center gap-[7px] rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#1c1b19] ${panel === "filter" || filter ? "bg-[#efeae0]" : ""}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: filter ? KIND_COLORS[filter] : "#d9d4c9" }}
            />
            {filter ? ARTIFACT_KIND_LABELS[filter] : "Filter"}
          </button>
          <div className="h-6 w-px bg-[#e2ddd2]" />
          <button
            type="button"
            onClick={onTravel}
            className="cursor-pointer rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#1c1b19] hover:bg-[#efeae0]"
          >
            Reise
          </button>
          {onAddHouse && (
            <button
              type="button"
              onClick={onAddHouse}
              className="cursor-pointer rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#1c1b19] hover:bg-[#efeae0]"
            >
              + Haus
            </button>
          )}
          <button
            type="button"
            onClick={onSettings}
            className="cursor-pointer rounded-[9px] bg-[#2f5d4a] px-3.5 py-2 text-[13px] font-semibold text-[#fffdf8]"
          >
            Einstellungen
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { Icons, IconButton } from "@/components/ui/controls";
import { TIME_LABELS, type TimeKey } from "@/lib/daytime";
import { ARTIFACT_KINDS, ARTIFACT_KIND_LABELS } from "@/lib/types";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

const ORDER: TimeKey[] = ["morgen", "mittag", "abend", "nacht"];
/** Hintergrund und Schrift des Tageszeit-Knopfs (Tokens `--hd-time-*`). */
const TIME_STYLE: Record<TimeKey, { bg: string; ink: string }> = {
  morgen: { bg: "var(--hd-time-morgen)", ink: "var(--hd-time-ink)" },
  mittag: { bg: "var(--hd-time-mittag)", ink: "var(--hd-time-ink)" },
  abend: { bg: "var(--hd-time-abend)", ink: "var(--hd-time-ink)" },
  nacht: { bg: "var(--hd-time-nacht)", ink: "var(--hd-time-nacht-ink)" },
};

/**
 * Leiste unten «Schalter» (Phase 4h): 3D/Karte als Kippschalter, Tageszeit als farbiger Knopf (Hintergrund =
 * Tageszeitfarbe, ein Klick schaltet weiter und setzt «Fest»), Kategorie-Filter, dann Symbol-Knöpfe Reise
 * (Kompass, Zähler der Anfragen), Haus anlegen und Einstellungen (Regler). Ausgeblendet, solange eine Tafel
 * offen ist; steht mittig in der Fläche rechts der Liste.
 */
export function BottomBar({
  store,
  actions,
  timeKey,
  timeAuto,
  onTime,
  friendRequests,
  onTravel,
  onSettings,
  onAddHouse,
}: {
  store: SceneStore;
  actions: SceneActions;
  /** Angezeigte Tageszeit (bei «Auto» die aus der Uhrzeit). */
  timeKey: TimeKey;
  timeAuto: boolean;
  /** Nächste Tageszeit wählen (setzt «Fest»). */
  onTime: (next: TimeKey) => void;
  friendRequests: number;
  onTravel: () => void;
  onSettings: () => void;
  onAddHouse?: () => void;
}) {
  const view = useScene(store, (s) => s.view);
  const filter = useScene(store, (s) => s.filter);
  const listW = useScene(store, (s) => s.listW);
  const [chips, setChips] = useState(false);
  const t = TIME_STYLE[timeKey];
  const next = ORDER[(ORDER.indexOf(timeKey) + 1) % ORDER.length];

  return (
    <div
      className="pointer-events-none absolute bottom-4 flex -translate-x-1/2 flex-col items-center gap-2 transition-[left] duration-300"
      style={{ left: `calc(${listW}px + (100vw - ${listW}px) / 2)` }}
    >
      {chips && (
        <div
          role="group"
          aria-label="Kategorie zeigen"
          className="hd-rise pointer-events-auto flex max-w-[calc(100vw-24px)] flex-wrap justify-center gap-1.5 rounded-hd-panel border border-hd-line bg-hd-surface p-1.5 shadow-hd-panel"
        >
          {(["", ...ARTIFACT_KINDS] as const).map((k) => {
            const on = filter === k;
            return (
              <button
                key={k || "alle"}
                type="button"
                aria-pressed={on}
                onClick={() => store.set({ filter: k })}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-[11px] py-1.5 text-[12.5px] font-semibold ${
                  on
                    ? "border-hd-accent-line bg-hd-accent-soft text-hd-ink"
                    : "border-hd-line text-hd-ink-2 hover:bg-hd-raised"
                }`}
              >
                {k && (
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: KIND_COLORS[k] }}
                  />
                )}
                {k ? ARTIFACT_KIND_LABELS[k] : "Alle"}
              </button>
            );
          })}
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-[3px] rounded-hd-panel border border-hd-line bg-hd-surface py-1 pr-1 pl-0.5 text-[12.5px] font-semibold whitespace-nowrap">
        <button
          type="button"
          role="switch"
          aria-checked={view === "karte"}
          aria-label="Karte statt 3D"
          onClick={() => actions.setView(view === "3d" ? "karte" : "3d")}
          className="flex cursor-pointer items-center gap-[9px] px-2.5 py-1.5"
        >
          <span className={view === "3d" ? "text-hd-ink" : "text-hd-muted"}>3D</span>
          <span aria-hidden className="relative h-[19px] w-[34px] rounded-[10px] bg-hd-chip">
            <span
              className="absolute top-[2px] h-[15px] w-[15px] rounded-full bg-hd-accent-line transition-[left] duration-200"
              style={{ left: view === "3d" ? 2 : 17 }}
            />
          </span>
          <span className={view === "karte" ? "text-hd-ink" : "text-hd-muted"}>Karte</span>
        </button>
        <span aria-hidden className="mx-[3px] h-[22px] w-px bg-hd-line" />
        <button
          type="button"
          title="Tageszeit wechseln"
          aria-label={`Tageszeit: ${timeAuto ? "Auto, " : ""}${TIME_LABELS[timeKey]}. Weiter zu ${TIME_LABELS[next]}`}
          onClick={() => onTime(next)}
          className="cursor-pointer rounded-hd-ctl px-[13px] py-1.5 font-bold transition-[background-color,color] duration-300"
          style={{ background: t.bg, color: t.ink }}
        >
          {timeAuto ? "Auto · " : ""}
          {TIME_LABELS[timeKey]}
        </button>
        <span aria-hidden className="mx-[3px] h-[22px] w-px bg-hd-line" />
        <div className="flex gap-0.5">
          <IconButton
            label={filter ? `Kategorie: ${ARTIFACT_KIND_LABELS[filter]}` : "Kategorie zeigen"}
            onClick={() => setChips((c) => !c)}
            pressed={chips || filter !== ""}
          >
            {filter ? (
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: KIND_COLORS[filter] }}
              />
            ) : (
              Icons.filter
            )}
          </IconButton>
          <IconButton
            label="Reise und Freunde"
            onClick={onTravel}
            badge={friendRequests || undefined}
          >
            {Icons.compass}
          </IconButton>
          {onAddHouse && (
            <IconButton label="Haus anlegen" onClick={onAddHouse}>
              {Icons.plusHouse}
            </IconButton>
          )}
          <IconButton label="Einstellungen" onClick={onSettings}>
            {Icons.sliders}
          </IconButton>
        </div>
      </div>
    </div>
  );
}

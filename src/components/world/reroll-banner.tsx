"use client";

import { useState, useTransition } from "react";
import { describeMap } from "@/lib/world/map";
import type { VillageModel } from "@/lib/village-model";
import type { WorldActions } from "@/lib/world/types";

/**
 * Vorschau «Welt neu würfeln»: Die Szene zeigt schon die neue Welt. Übernehmen erst nach einer zweiten
 * Bestätigung; was in der neuen Landschaft nicht mehr passt, wird vorher genannt (nie stillschweigend).
 */
export function RerollBanner({
  model,
  reset,
  onReset,
  onAgain,
  onCancel,
  onDone,
  reroll,
}: {
  /** Server Action «neu würfeln» (in der Entwickler-Vorschau eine Attrappe). */
  reroll: WorldActions["reroll"];
  /** Modell der Vorschau (neuer Seed). */
  model: VillageModel;
  /** Eigene Platzierungen ebenfalls zurücksetzen. */
  reset: boolean;
  onReset: (v: boolean) => void;
  onAgain: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lost = reset ? 0 : model.world.rejected.length;

  const apply = () =>
    start(async () => {
      setError(null);
      const r = await reroll({
        seed: model.world.seed,
        resetPlacements: reset,
        dropInvalid: true,
      });
      if ("error" in r) setError(r.error);
      else onDone();
    });

  return (
    <div
      role="dialog"
      aria-label="Vorschau: neue Welt"
      className="hd-pop-in pointer-events-auto absolute top-16 left-1/2 z-30 flex w-[min(560px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 rounded-2xl border-[3px] border-[#5e3c22] bg-[#fbf6ea] p-4 shadow-[0_12px_40px_rgba(28,27,25,.3)]"
    >
      <div className="hd-kicker !text-[#7a766d]">Vorschau · noch nicht gespeichert</div>
      <div className="text-[17px] font-bold text-[#1c1b19]">
        Neue Landschaft: {describeMap(model.world.map)}
      </div>
      <label className="flex items-center gap-2 text-[13.5px] text-[#3a3732]">
        <input
          type="checkbox"
          checked={reset}
          onChange={(e) => onReset(e.target.checked)}
          className="accent-[#2f5d4a]"
        />
        Auch eigene Deko und Hausvarianten zurücksetzen
      </label>
      {lost > 0 && (
        <p className="rounded-lg bg-[#fff3cf] px-3 py-2 text-[13px] text-[#6b4e00]">
          {lost === 1 ? "1 eigenes Element passt" : `${lost} eigene Elemente passen`} nicht in die
          neue Landschaft und
          {lost === 1 ? " wird" : " werden"} beim Übernehmen entfernt.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-[#fde2dd] px-3 py-2 text-[13px] text-[#8a2414]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {confirm ? (
          <button
            type="button"
            className="hd-btn hd-btn-primary"
            disabled={pending}
            onClick={apply}
          >
            {pending ? "Wird übernommen…" : "Ja, diese Welt übernehmen"}
          </button>
        ) : (
          <button type="button" className="hd-btn hd-btn-primary" onClick={() => setConfirm(true)}>
            Übernehmen …
          </button>
        )}
        <button
          type="button"
          className="hd-btn hd-btn-ghost"
          disabled={pending}
          onClick={() => (setConfirm(false), onAgain())}
        >
          Nochmals würfeln
        </button>
        <button type="button" className="hd-btn hd-btn-ghost" disabled={pending} onClick={onCancel}>
          Verwerfen
        </button>
      </div>
    </div>
  );
}

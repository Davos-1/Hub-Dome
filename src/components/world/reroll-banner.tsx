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
  upgrade = false,
  model,
  reset,
  onReset,
  onAgain,
  onCancel,
  onDone,
  reroll,
}: {
  /** «Auf neue Welt-Version aktualisieren» (gleicher Seed) statt neu würfeln. */
  upgrade?: boolean;
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
      aria-label={upgrade ? "Vorschau: neue Welt-Version" : "Vorschau: neue Welt"}
      className="hd-pop-in hd-box pointer-events-auto absolute top-16 left-1/2 z-30 flex w-[min(540px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2.5 p-4"
    >
      <div className="hd-kicker">Vorschau · noch nicht gespeichert</div>
      <div className="text-[17px] font-bold text-hd-ink">
        {upgrade ? "Neue Welt-Version" : "Neue Landschaft"}: {describeMap(model.world.map)}
      </div>
      <p className="text-[12.5px] text-hd-muted">
        Bäume und Gelände sind neu, deine Häuser behalten ihre Plätze, wo es passt.
      </p>
      <label className="flex items-center gap-2 text-[13.5px] text-hd-ink-2">
        <input
          type="checkbox"
          checked={reset}
          onChange={(e) => onReset(e.target.checked)}
          className="accent-hd-accent"
        />
        Auch eigene Deko und Hausvarianten zurücksetzen
      </label>
      {lost > 0 && (
        <p className="rounded-hd-ctl bg-hd-accent-soft px-3 py-2 text-[13px] text-hd-ink">
          {lost === 1 ? "1 eigenes Element passt" : `${lost} eigene Elemente passen`} nicht in die
          neue Landschaft und
          {lost === 1 ? " wird" : " werden"} beim Übernehmen entfernt.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-hd-ctl bg-hd-danger-soft px-3 py-2 text-[13px] text-hd-danger"
        >
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
        {!upgrade && (
          <button
            type="button"
            className="hd-btn hd-btn-ghost"
            disabled={pending}
            onClick={() => (setConfirm(false), onAgain())}
          >
            Nochmals würfeln
          </button>
        )}
        <button type="button" className="hd-btn hd-btn-ghost" disabled={pending} onClick={onCancel}>
          Verwerfen
        </button>
      </div>
    </div>
  );
}

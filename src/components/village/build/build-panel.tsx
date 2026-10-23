"use client";

import { useEffect, useState } from "react";
import { DEKO, DEKO_GRUPPEN, DEKO_TYPEN, type DekoGruppe, type DekoTyp } from "@/lib/world/catalog";
import { ANBAUTEN, GAERTEN, type Anbau, type Garten } from "@/lib/world/doc";
import {
  ANBAU_LABELS,
  DACH_SETS,
  FARB_SETS,
  GARTEN_LABELS,
  kitFits,
  withVariante,
} from "@/lib/world/kit";
import { FACHBEREICHE } from "@/lib/fachbereiche";
import type { VillageModel } from "@/lib/village-model";
import { useBuild, type BuildStore } from "./build-store";

const GRUPPEN = Object.keys(DEKO_GRUPPEN) as DekoGruppe[];
const LEGEND = "mb-1 text-[12px] font-bold tracking-wide text-[#5e4a33] uppercase";

const chip = (on: boolean) =>
  `cursor-pointer rounded-lg border-2 px-2.5 py-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
    on
      ? "border-[#2f5d4a] bg-[#2f5d4a] text-white"
      : "border-[#e4d9c0] bg-white text-[#3a3732] hover:border-[#c9b98f]"
  }`;

/** Farbmuster eines Hauses (Wand, Dach, Akzent) für die Auswahl. */
function Swatch({ wall, roof, accent }: { wall: string; roof: string; accent: string }) {
  return (
    <span className="flex h-4 overflow-hidden rounded border border-black/15" aria-hidden>
      <span className="w-3" style={{ background: roof }} />
      <span className="w-4" style={{ background: wall }} />
      <span className="w-2" style={{ background: accent }} />
    </span>
  );
}

/** Varianten des gewählten Hauses: Farbe, Dach, Anbau, Garten (je eine Auswahl, sofort sichtbar). */
function HouseKit({
  build,
  model,
  houseId,
}: {
  build: BuildStore;
  model: VillageModel;
  houseId: string;
}) {
  const v = useBuild(build, (s) => s.history.present.varianten[houseId]);
  const slots = useBuild(build, (s) => s.houseSlots);
  const info = model.byId[houseId];
  if (!info) return null;
  const fachBase = FACHBEREICHE[info.fach].style;
  const fits = kitFits(fachBase.type);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="hd-btn hd-btn-ghost hd-btn-sm"
          onClick={() => build.selectHouse(null)}
          aria-label="Zurück zum Katalog"
        >
          ←
        </button>
        <span className="text-[14px] font-bold">{info.title}</span>
        {info.kind !== "zentrale" &&
          (slots ? (
            <span
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Freie Plätze"
            >
              {slots.map((sl, i) => (
                <button
                  key={`${sl.dir}-${sl.key}`}
                  type="button"
                  className="hd-btn hd-btn-ghost hd-btn-sm"
                  onClick={() => build.placeHouse(sl)}
                >
                  Platz {i + 1}
                </button>
              ))}
              <button
                type="button"
                className="hd-btn hd-btn-ghost hd-btn-sm"
                onClick={() => build.escape()}
              >
                Abbrechen
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="hd-btn hd-btn-ghost hd-btn-sm"
              onClick={() => build.showHouseSlots()}
            >
              Umsetzen …
            </button>
          ))}
      </div>
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className={LEGEND}>Farbe</legend>
        {FARB_SETS.map((f, i) => {
          const c = withVariante(fachBase, { farbe: i, dach: v?.dach });
          return (
            <button
              key={f.label}
              type="button"
              aria-pressed={(v?.farbe ?? 0) === i}
              className={`${chip((v?.farbe ?? 0) === i)} flex items-center gap-1.5`}
              onClick={() => build.variante(houseId, { farbe: i === 0 ? undefined : i })}
            >
              <Swatch {...c} />
              {f.label}
            </button>
          );
        })}
      </fieldset>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className={LEGEND}>Dach</legend>
        {DACH_SETS.map((d, i) => (
          <button
            key={d.label}
            type="button"
            aria-pressed={(v?.dach ?? 0) === i}
            className={chip((v?.dach ?? 0) === i)}
            onClick={() => build.variante(houseId, { dach: i === 0 ? undefined : i })}
          >
            {d.label}
          </button>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className={LEGEND}>Anbau</legend>
        {ANBAUTEN.map((a: Anbau) => (
          <button
            key={a}
            type="button"
            disabled={a !== "keiner" && !fits.anbau}
            title={
              a !== "keiner" && !fits.anbau
                ? "Neben diesem Haus ist kein Platz für einen Anbau."
                : undefined
            }
            aria-pressed={(v?.anbau ?? "keiner") === a}
            className={chip((v?.anbau ?? "keiner") === a)}
            onClick={() => build.variante(houseId, { anbau: a === "keiner" ? undefined : a })}
          >
            {ANBAU_LABELS[a]}
          </button>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className={LEGEND}>Garten</legend>
        <button
          type="button"
          aria-pressed={!v?.garten}
          className={chip(!v?.garten)}
          onClick={() => build.variante(houseId, { garten: undefined })}
        >
          Keiner
        </button>
        {GAERTEN.map((g: Garten) => (
          <button
            key={g}
            type="button"
            disabled={!fits.garten}
            title={
              !fits.garten ? "Neben diesem Haus ist kein Platz für ein Gartenfeld." : undefined
            }
            aria-pressed={v?.garten === g}
            className={chip(v?.garten === g)}
            onClick={() => build.variante(houseId, { garten: g })}
          >
            {GARTEN_LABELS[g]}
          </button>
        ))}
      </fieldset>
      {(!fits.anbau || !fits.garten) && (
        <p className="hd-note">
          {!fits.anbau && !fits.garten
            ? "Neben diesem Haustyp ist kein Platz für Anbau oder Gartenfeld (er braucht die Fläche selbst, wenn er wächst)."
            : !fits.anbau
              ? "Neben diesem Haustyp ist kein Platz für einen Anbau."
              : "Neben diesem Haustyp ist kein Platz für ein Gartenfeld."}
        </p>
      )}
    </div>
  );
}

/**
 * Werkzeugleiste des Bau-Modus: Katalog nach Gruppen, Aktionen für das gewählte Element oder Haus,
 * Rückgängig/Wiederholen und Speichern. Tastatur: Pfeile (0.5 m), Q/E (15°), Enter, Entf, Esc,
 * Strg+Z / Strg+Y.
 */
export function BuildPanel({
  build,
  model,
  onSave,
  onCancel,
}: {
  build: BuildStore;
  model: VillageModel;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [gruppe, setGruppe] = useState<DekoGruppe>("sitzen");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const tool = useBuild(build, (s) => s.tool);
  const selected = useBuild(build, (s) => s.selected);
  const house = useBuild(build, (s) => s.house);
  const message = useBuild(build, (s) => s.message);
  const saving = useBuild(build, (s) => s.saving);
  const error = useBuild(build, (s) => s.error);
  const canUndo = useBuild(build, (s) => s.history.past.length > 0);
  const canRedo = useBuild(build, (s) => s.history.future.length > 0);
  const count = useBuild(build, (s) => s.history.present.deko.length);
  const ghostBad = useBuild(build, (s) => (s.ghost && !s.ghost.ok ? s.ghost.grund : null));

  // Tastatur (vor den Kürzeln der Szene, die im Bau-Modus ruhen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[data-hd-dialog]")) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      const step = 0.5;
      const handled = (() => {
        if (mod && (e.key === "z" || e.key === "Z"))
          return (e.shiftKey ? build.redo() : build.undo(), true);
        if (mod && (e.key === "y" || e.key === "Y")) return (build.redo(), true);
        if (mod) return false;
        switch (e.key) {
          case "ArrowLeft":
            return (build.arrow(-step, 0), true);
          case "ArrowRight":
            return (build.arrow(step, 0), true);
          case "ArrowUp":
            return (build.arrow(0, -step), true);
          case "ArrowDown":
            return (build.arrow(0, step), true);
          case "q":
          case "Q":
            return (build.nudge(0, 0, -15), true);
          case "e":
          case "E":
            return (build.nudge(0, 0, 15), true);
          case "Enter":
            // Enter auf dem gewählten Werkzeug setzt das Element; andere Knöpfe behalten ihr Verhalten
            if (
              t &&
              /^(BUTTON|A)$/.test(t.tagName) &&
              t.getAttribute("data-bau-tool") !== build.get().tool
            )
              return false;
            return (build.enter(), true);
          case "Delete":
          case "Backspace":
            return (build.remove(), true);
          case "Escape":
            return build.escape();
        }
        return false;
      })();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [build]);

  const sel = selected ? model.world.deko.find((d) => d.id === selected) : undefined;

  return (
    <section
      aria-label="Bau-Modus"
      className="hd-pop-in pointer-events-auto absolute inset-x-2 bottom-2 z-20 flex max-h-[52vh] flex-col gap-2 overflow-y-auto rounded-2xl border-[3px] border-[#5e3c22] bg-[#fbf6ea]/97 p-3 shadow-[0_10px_36px_rgba(28,27,25,.3)] md:inset-x-auto md:top-16 md:right-3 md:bottom-3 md:max-h-none md:w-[380px]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-bold">Bauen</h2>
        <span className="hd-note">{count} / 120 eigene Elemente</span>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            disabled={!canUndo}
            onClick={() => build.undo()}
            aria-keyshortcuts="Control+Z"
          >
            Rückgängig
          </button>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            disabled={!canRedo}
            onClick={() => build.redo()}
            aria-keyshortcuts="Control+Y"
          >
            Wiederholen
          </button>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="bau-ansage"
        className={`min-h-[20px] text-[13px] ${ghostBad ? "text-[#8a2414]" : "text-[#3a3732]"}`}
      >
        {ghostBad && tool ? `Hier nicht möglich: ${ghostBad}` : message}
      </p>

      {house ? (
        <HouseKit build={build} model={model} houseId={house} />
      ) : sel ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[14px] font-bold">{DEKO[sel.typ].label}</span>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            onClick={() => build.startMove()}
          >
            Versetzen
          </button>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            onClick={() => build.nudge(0, 0, -15)}
            aria-keyshortcuts="Q"
          >
            ⟲ Drehen
          </button>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            onClick={() => build.nudge(0, 0, 15)}
            aria-keyshortcuts="E"
          >
            Drehen ⟳
          </button>
          <button
            type="button"
            className="hd-btn hd-btn-danger hd-btn-sm"
            onClick={() => build.remove()}
            aria-keyshortcuts="Delete"
          >
            Entfernen
          </button>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-[13px]">
            <span className={LEGEND}>Haus anpassen</span>
            <select
              className="min-w-0 flex-1 rounded-lg border-2 border-[#e4d9c0] bg-white px-2 py-1 text-[13px]"
              value=""
              onChange={(e) => build.selectHouse(e.target.value || null)}
            >
              <option value="">Haus wählen … (oder in der Szene anklicken)</option>
              {model.houses
                .filter((h) => h.kind !== "zentrale" && model.layout.houses[h.id]?.plot)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Katalog">
            {GRUPPEN.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={gruppe === g}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-bold ${
                  gruppe === g ? "bg-[#5e3c22] text-white" : "bg-[#efe6d0] text-[#4a3a26]"
                }`}
                onClick={() => setGruppe(g)}
              >
                {DEKO_GRUPPEN[g]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="tabpanel">
            {DEKO_TYPEN.filter((t: DekoTyp) => DEKO[t].gruppe === gruppe).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tool === t}
                title={DEKO[t].hinweis}
                className={chip(tool === t)}
                data-bau-tool={t}
                onClick={() => build.chooseTool(t)}
              >
                {DEKO[t].label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-[#fde2dd] px-3 py-2 text-[13px] text-[#8a2414]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[#e4d9c0] pt-2">
        {confirmReset ? (
          <>
            <span className="text-[13px]">Alle eigene Deko und Hausvarianten entfernen?</span>
            <button
              type="button"
              className="hd-btn hd-btn-danger hd-btn-sm"
              onClick={() => {
                build.resetAll();
                setConfirmReset(false);
              }}
            >
              Ja, entfernen
            </button>
            <button
              type="button"
              className="hd-btn hd-btn-ghost hd-btn-sm"
              onClick={() => setConfirmReset(false)}
            >
              Nein
            </button>
          </>
        ) : (
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            onClick={() => setConfirmReset(true)}
          >
            Zurücksetzen auf Automatik …
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {confirmCancel ? (
            <>
              <span className="text-[13px]">Änderungen verwerfen?</span>
              <button type="button" className="hd-btn hd-btn-danger" onClick={onCancel}>
                Verwerfen
              </button>
              <button
                type="button"
                className="hd-btn hd-btn-ghost"
                onClick={() => setConfirmCancel(false)}
              >
                Weiterbauen
              </button>
            </>
          ) : (
            <button
              type="button"
              className="hd-btn hd-btn-ghost"
              disabled={saving}
              onClick={() => (canUndo ? setConfirmCancel(true) : onCancel())}
            >
              Abbrechen
            </button>
          )}
          <button
            type="button"
            className="hd-btn hd-btn-primary"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Wird geprüft…" : "Speichern"}
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { FACHBEREICHE, type FachbereichId } from "@/lib/fachbereiche";
import {
  KURVEN,
  RADIUS,
  WEGFORMEN,
  WEGFORM_LABELS,
  roadCurve,
  roadRadius,
  type QuarterRoad,
} from "@/lib/world/roads";
import type { VillageModel } from "@/lib/village-model";
import { BUILD_HUD } from "../hud/layout";
import {
  BAU_WERKZEUGE,
  quarterColor,
  useBuild,
  WERKZEUG_LABELS,
  type BauWerkzeug,
  type BuildStore,
} from "./build-store";

/**
 * Masse wie `BUILD_HUD` (Leiste 52 px, Werkzeuge links 16/70/58, Panel rechts 16/70/268), damit der Plan
 * (`buildFrame`) genau den freien Ausschnitt nutzt.
 *
 * Bau-Modus als Plan (Prototyp 12a): Leiste oben (Rückgängig, Wiederholen, Abbrechen, Speichern), Werkzeuge
 * links (Wählen, Haus, Quartier, Weg, Deko), Panel rechts (Wegform des Quartiers, Haus, Wege, Bäume, eigene
 * Deko) und Meldung unten. Tastatur: Pfeile (0.5 m), Q/E (15°), Enter, Entf, Esc von innen nach aussen,
 * Strg+Z / Strg+Y.
 */

const GLYPH: Record<BauWerkzeug, string> = {
  waehlen: "↖",
  haus: "⇄",
  quartier: "⬚",
  weg: "〰",
  deko: "✿",
};
const GRUPPEN = Object.keys(DEKO_GRUPPEN) as DekoGruppe[];
const FORM_HINT: Record<QuarterRoad["form"], string> = {
  intelligent:
    "Jeder Weg sucht den kürzesten Weg zum Platz. Kommt er einem anderen Weg nahe, vereinen sie sich.",
  ring: "Häuser hängen mit kurzen Stichwegen am Weg rund ums Quartier.",
  halbkreis: "Häuser hängen mit kurzen Stichwegen am Bogen hinter dem Platz.",
  gasse: "Häuser stehen beidseits einer Gasse, die vom Quartierplatz hinausführt.",
};
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Kicker({ children, faint = false }: { children: ReactNode; faint?: boolean }) {
  return (
    <span
      className={`font-mono text-[10.5px] tracking-[0.1em] uppercase ${faint ? "text-hd-faint" : "text-hd-accent-text"}`}
    >
      {children}
    </span>
  );
}
const Rule = () => <span aria-hidden className="h-px flex-none bg-hd-line" />;
const option = (on: boolean) =>
  `cursor-pointer rounded-hd-ctl border px-1 py-2 text-[12px] font-semibold disabled:cursor-default disabled:opacity-45 ${
    on
      ? "border-hd-accent-line bg-hd-accent-soft text-hd-ink"
      : "border-hd-line bg-transparent text-hd-ink-2 hover:bg-hd-raised"
  }`;

/** −  Balken  +  Wert (Radius bzw. Krümmung). */
function Slider({
  label,
  value,
  min,
  max,
  text,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  text: string;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(((value - min) / Math.max(1, max - min)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <Kicker faint>{label}</Kicker>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-7 w-7 cursor-pointer rounded-hd-ctl bg-hd-chip text-hd-ink disabled:cursor-default disabled:opacity-45"
          aria-label={`${label} kleiner`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span
          role="meter"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={text}
          className="relative h-1 flex-1 overflow-hidden rounded-full bg-hd-chip"
        >
          <span
            className="absolute inset-y-0 left-0 bg-hd-accent-line"
            style={{ width: `${pct}%` }}
          />
        </span>
        <button
          type="button"
          className="h-7 w-7 cursor-pointer rounded-hd-ctl bg-hd-chip text-hd-ink disabled:cursor-default disabled:opacity-45"
          aria-label={`${label} grösser`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
        <span className="w-14 text-right font-mono text-[11.5px] text-hd-ink-2">{text}</span>
      </div>
    </div>
  );
}

/** Farbmuster eines Hauses (Wand, Dach, Akzent) für die Auswahl. */
function Swatch({ wall, roof, accent }: { wall: string; roof: string; accent: string }) {
  return (
    <span
      className="flex h-3.5 overflow-hidden rounded-[3px] border border-hd-line-strong"
      aria-hidden
    >
      <span className="w-2.5" style={{ background: roof }} />
      <span className="w-3" style={{ background: wall }} />
      <span className="w-1.5" style={{ background: accent }} />
    </span>
  );
}

/** Wegform des gewählten Quartiers (v3) und Rücksetzen. */
function QuarterSection({
  build,
  model,
  q,
}: {
  build: BuildStore;
  model: VillageModel;
  q: FachbereichId;
}) {
  const road = useBuild(build, (s) => s.history.present.roads[q]) ?? { form: "gasse" as const };
  const v3 = model.world.version >= 3;
  const n = Object.values(model.world.settlement.houses).filter((h) => h.quarterId === q).length;
  const polarFree = (model.world.map.version ?? 1) >= 2;
  return (
    <section aria-label={`Quartier ${FACHBEREICHE[q].name}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-3 w-3 flex-none rounded-[3px]"
          style={{ background: quarterColor(q) }}
        />
        <h3 className="text-[16px] font-bold">{FACHBEREICHE[q].name}</h3>
      </div>
      <span className="text-[12px] text-hd-muted">
        {count(n, "Haus", "Häuser")}
        {polarFree ? " · Griff in der Mitte verschiebt alles" : ""}
      </span>
      {v3 ? (
        <>
          <Kicker faint>Wegform</Kicker>
          <div role="radiogroup" aria-label="Wegform" className="grid grid-cols-2 gap-1.5">
            {WEGFORMEN.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={road.form === f}
                className={option(road.form === f)}
                onClick={() => road.form !== f && build.setRoad({ form: f })}
              >
                {WEGFORM_LABELS[f]}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] leading-[1.45] text-hd-muted">{FORM_HINT[road.form]}</p>
          {(road.form === "ring" || road.form === "halbkreis") && (
            <Slider
              label="Radius"
              value={roadRadius(road)}
              min={RADIUS.min}
              max={RADIUS.max}
              text={`${roadRadius(road)} m`}
              onChange={(v) => build.setRoad({ radius: v })}
            />
          )}
          {road.form === "intelligent" && (
            <Slider
              label="Kurve"
              value={roadCurve(road)}
              min={0}
              max={KURVEN.length - 1}
              text={KURVEN[roadCurve(road)]}
              onChange={(v) => build.setRoad({ curve: v })}
            />
          )}
          <button
            type="button"
            className="cursor-pointer self-start text-[12.5px] text-hd-muted underline"
            onClick={() => build.resetQuarter()}
          >
            Zurück auf Ausgangslage
          </button>
        </>
      ) : (
        <>
          <p className="hd-note">
            Wegformen gibt es ab Welt-Version 3 (Einstellungen › Dorf › Aktualisieren).
          </p>
          <button
            type="button"
            className="cursor-pointer self-start text-[12.5px] text-hd-muted underline"
            onClick={() => build.unpin()}
          >
            Zurück auf Automatik
          </button>
        </>
      )}
      {polarFree && n > 0 && (
        <button
          type="button"
          className="hd-btn hd-btn-ghost hd-btn-sm self-start"
          onClick={() => build.startGroupDrag(q)}
        >
          Quartier verschieben (Tastatur)
        </button>
      )}
    </section>
  );
}

/** Gewähltes Haus: Varianten (Farbe, Dach, Anbau, Garten) und Platz. */
function HouseSection({
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
  const free = (model.world.map.version ?? 1) >= 2;
  const fachBase = FACHBEREICHE[info.fach].style;
  const fits = kitFits(fachBase.type);
  const pick = (on: boolean) => `${option(on)} px-2`;
  return (
    <section aria-label={`Haus ${info.title}`} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-3 w-3 flex-none rounded-[3px]"
          style={{ background: info.color }}
        />
        <h3 className="min-w-0 truncate text-[15px] font-bold">{info.title}</h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {free && (
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            onClick={() => build.startHouseDrag(houseId)}
          >
            Verschieben (Tastatur)
          </button>
        )}
        {!free &&
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
        <button
          type="button"
          className="hd-btn hd-btn-ghost hd-btn-sm"
          onClick={() => build.unpin()}
          title="Das Haus bekommt wieder den nächsten freien Platz seines Quartiers."
        >
          Automatik
        </button>
      </div>
      <Kicker faint>Farbe</Kicker>
      <div className="grid grid-cols-2 gap-1.5">
        {FARB_SETS.map((f, i) => {
          const c = withVariante(fachBase, { farbe: i, dach: v?.dach });
          return (
            <button
              key={f.label}
              type="button"
              aria-pressed={(v?.farbe ?? 0) === i}
              className={`${pick((v?.farbe ?? 0) === i)} flex items-center gap-1.5`}
              onClick={() => build.variante(houseId, { farbe: i === 0 ? undefined : i })}
            >
              <Swatch {...c} />
              {f.label}
            </button>
          );
        })}
      </div>
      <Kicker faint>Dach</Kicker>
      <div className="grid grid-cols-3 gap-1.5">
        {DACH_SETS.map((d, i) => (
          <button
            key={d.label}
            type="button"
            aria-pressed={(v?.dach ?? 0) === i}
            className={pick((v?.dach ?? 0) === i)}
            onClick={() => build.variante(houseId, { dach: i === 0 ? undefined : i })}
          >
            {d.label}
          </button>
        ))}
      </div>
      <Kicker faint>Anbau</Kicker>
      <div className="grid grid-cols-2 gap-1.5">
        {ANBAUTEN.map((a: Anbau) => (
          <button
            key={a}
            type="button"
            disabled={a !== "keiner" && !fits.anbau}
            aria-pressed={(v?.anbau ?? "keiner") === a}
            className={pick((v?.anbau ?? "keiner") === a)}
            onClick={() => build.variante(houseId, { anbau: a === "keiner" ? undefined : a })}
          >
            {ANBAU_LABELS[a]}
          </button>
        ))}
      </div>
      <Kicker faint>Garten</Kicker>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          aria-pressed={!v?.garten}
          className={pick(!v?.garten)}
          onClick={() => build.variante(houseId, { garten: undefined })}
        >
          Keiner
        </button>
        {GAERTEN.map((g: Garten) => (
          <button
            key={g}
            type="button"
            disabled={!fits.garten}
            aria-pressed={v?.garten === g}
            className={pick(v?.garten === g)}
            onClick={() => build.variante(houseId, { garten: g })}
          >
            {GARTEN_LABELS[g]}
          </button>
        ))}
      </div>
      {(!fits.anbau || !fits.garten) && (
        <p className="hd-note">
          Neben diesem Haustyp ist kein Platz für{" "}
          {!fits.anbau && !fits.garten
            ? "Anbau oder Gartenfeld"
            : !fits.anbau
              ? "einen Anbau"
              : "ein Gartenfeld"}
          .
        </p>
      )}
    </section>
  );
}

/** Auswahl per Tastatur: Quartier und Haus aus einer Liste (die Szene ist nur mit der Maus bedienbar). */
function Picker({ build, model }: { build: BuildStore; model: VillageModel }) {
  const quarter = useBuild(build, (s) => s.quarter);
  const house = useBuild(build, (s) => s.house);
  const quarters = model.layout.quarters;
  const homes = model.houses.filter(
    (h) => h.kind !== "zentrale" && model.layout.houses[h.id]?.plot,
  );
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <label className="flex min-w-0 flex-col gap-1">
        <Kicker faint>Quartier</Kicker>
        <select
          className="hd-input min-w-0 px-2 py-1.5 text-[12.5px]"
          aria-label="Quartier wählen"
          value={quarter ?? ""}
          onChange={(e) => build.selectQuarter((e.target.value || null) as FachbereichId | null)}
        >
          <option value="">–</option>
          {quarters.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <Kicker faint>Haus</Kicker>
        <select
          className="hd-input min-w-0 px-2 py-1.5 text-[12.5px]"
          aria-label="Haus wählen"
          value={house ?? ""}
          onChange={(e) => build.selectHouse(e.target.value || null)}
        >
          <option value="">–</option>
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Deko-Werkzeug: Bäume aus dem Seed (v3) und eigene Deko aus dem Katalog. */
function DekoSection({ build, model }: { build: BuildStore; model: VillageModel }) {
  const [gruppe, setGruppe] = useState<DekoGruppe>("sitzen");
  const moved = useBuild(build, (s) => Object.keys(s.history.present.trees).length);
  const own = useBuild(build, (s) => s.history.present.deko.length);
  const tool = useBuild(build, (s) => s.tool);
  const selected = useBuild(build, (s) => s.selected);
  const sel = selected ? model.world.deko.find((d) => d.id === selected) : undefined;
  const v3 = model.world.version >= 3;
  return (
    <>
      <Kicker>Deko aus dem Seed</Kicker>
      {v3 ? (
        <>
          <p className="text-[13px] leading-normal text-hd-ink-2">
            Bäume ziehen, um sie zu versetzen. Auf Häuser und Wege lassen sie sich nicht stellen.
          </p>
          <span className="text-[12.5px] text-hd-muted">
            {count(moved, "Baum versetzt", "Bäume versetzt")}
          </span>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm self-start"
            disabled={!moved}
            onClick={() => build.resetTrees()}
          >
            Alle zurück an Seed-Platz
          </button>
        </>
      ) : (
        <p className="hd-note">Bäume versetzen gibt es ab Welt-Version 3.</p>
      )}
      <Rule />
      <Kicker>Eigene Deko · {own} / 120</Kicker>
      {sel ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-full text-[14px] font-bold">{DEKO[sel.typ].label}</span>
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
            aria-keyshortcuts="Q"
            onClick={() => build.nudge(0, 0, -15)}
          >
            ⟲ Drehen
          </button>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            aria-keyshortcuts="E"
            onClick={() => build.nudge(0, 0, 15)}
          >
            Drehen ⟳
          </button>
          <button
            type="button"
            className="hd-btn hd-btn-danger hd-btn-sm"
            aria-keyshortcuts="Delete"
            onClick={() => build.remove()}
          >
            Entfernen
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Katalog">
            {GRUPPEN.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={gruppe === g}
                className={`cursor-pointer rounded-hd-ctl px-2.5 py-1 text-[12px] font-semibold ${
                  gruppe === g ? "bg-hd-chip text-hd-ink" : "text-hd-muted hover:text-hd-ink"
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
                data-bau-tool={t}
                className={`${option(tool === t)} px-2.5 py-1.5`}
                onClick={() => build.chooseTool(tool === t ? null : t)}
              >
                {DEKO[t].label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Weg-Werkzeug: Eckpunkte in Stichwegen. */
function WegSection({ build, model }: { build: BuildStore; model: VillageModel }) {
  const n = useBuild(build, (s) => Object.keys(s.history.present.bends).length);
  if (model.world.version < 3)
    return <p className="hd-note">Wege von Hand gibt es ab Welt-Version 3.</p>;
  return (
    <>
      <Kicker>Wege von Hand</Kicker>
      <p className="text-[13px] leading-normal text-hd-ink-2">
        Auf einen Stichweg klicken setzt einen Eckpunkt, ziehen formt den Weg, Doppelklick entfernt
        ihn.
      </p>
      <span className="text-[12.5px] text-hd-muted">
        {count(n, "Weg mit Eckpunkt", "Wege mit Eckpunkt")}
      </span>
      <button
        type="button"
        className="hd-btn hd-btn-ghost hd-btn-sm self-start"
        disabled={!n}
        onClick={() => build.resetBends()}
      >
        Alle Eckpunkte entfernen
      </button>
    </>
  );
}

export function BuildHud({
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  // Fokus beim Öffnen auf das aktive Werkzeug, beim Schliessen zurück zum Auslöser (z.B. «Bauen»)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    rail.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
    // Der Auslöser («Bauen») entsteht erst im selben Wechsel neu und wird von der Ansicht fokussiert; hier nur
    // zurück, wenn das Element noch da ist (sonst landet der Fokus auf dem Seitenanfang)
    return () => {
      if (previous?.isConnected && previous !== document.body)
        previous.focus({ preventScroll: true });
    };
  }, []);
  const btool = useBuild(build, (s) => s.btool);
  const tool = useBuild(build, (s) => s.tool);
  const house = useBuild(build, (s) => s.house);
  const quarter = useBuild(build, (s) => s.quarter);
  const message = useBuild(build, (s) => s.message);
  const bad = useBuild(build, (s) => s.bad);
  const saving = useBuild(build, (s) => s.saving);
  const error = useBuild(build, (s) => s.error);
  const canUndo = useBuild(build, (s) => s.history.past.length > 0);
  const canRedo = useBuild(build, (s) => s.history.future.length > 0);
  const ghostBad = useBuild(build, (s) => (s.ghost && !s.ghost.ok ? s.ghost.grund : null));
  // Ansage beim Ziehen (nur Zeichenketten: stabile Werte für useSyncExternalStore)
  const dragText = useBuild(build, (s) => {
    const d = s.drag;
    if (!d) return null;
    if (d.kind === "haus")
      return d.ghost.ok
        ? d.ghost.snapped
          ? "Passt (eingerastet)"
          : "Passt"
        : `Hier nicht möglich: ${d.ghost.grund}`;
    if (d.ghost.state === "ok") return "Quartier verschieben · passt";
    return d.ghost.state === "grenze"
      ? `Nur bis zur Grenze: ${d.ghost.grund}`
      : `Hier nicht möglich: ${d.ghost.grund}`;
  });

  // Tastatur (vor den Kürzeln der Szene, die im Bau-Modus ruhen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[data-hd-dialog]")) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      // In einer Auswahlliste nur Esc (Auswahl aufheben); Pfeile wählen dort Einträge
      if (t?.tagName === "SELECT" && e.key !== "Escape") return;
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
          case "Enter": {
            // Enter setzt nur, wenn etwas abzulegen ist: ein Haus oder Quartier beim Ziehen, ein Element beim
            // Versetzen oder das gewählte Katalog-Element (dort ist der Fokus auf seinem Knopf). Sonst behalten
            // Knöpfe ihr Verhalten (Wählen, Speichern, Abbrechen, Wegform …).
            const s = build.get();
            const placing =
              !!s.drag || s.moving || (!!s.tool && t?.getAttribute("data-bau-tool") === s.tool);
            if (t && /^(BUTTON|A)$/.test(t.tagName) && !placing) return false;
            return (build.enter(), true);
          }
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

  const homes = model.houses.filter((h) => h.kind !== "zentrale");
  const quarters = new Set(homes.map((h) => model.layout.houses[h.id]?.quarterId).filter(Boolean));
  // Ein Fehler (z.B. beim Speichern) steht für sich als Warnung; die Hinweiszeile schweigt dann
  const text = error
    ? ""
    : (dragText ?? (ghostBad && tool ? `Hier nicht möglich: ${ghostBad}` : message));
  const isBad = dragText !== null ? !/passt/i.test(dragText) : (!!ghostBad && !!tool) || bad;
  const none = !quarter && btool !== "deko" && btool !== "weg";

  return (
    <>
      {/* Leiste oben */}
      <section
        aria-label="Bau-Modus"
        className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2.5 border-b border-hd-line bg-hd-surface px-4"
      >
        <h2 className="text-[15px] font-bold">Bauen</h2>
        <span className="truncate text-[12.5px] text-hd-muted max-sm:hidden">
          {count(homes.length, "Haus", "Häuser")} · {count(quarters.size, "Quartier", "Quartiere")}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="h-8 cursor-pointer rounded-hd-ctl bg-hd-chip px-3 text-hd-ink disabled:cursor-default disabled:opacity-40"
          disabled={!canUndo}
          onClick={() => build.undo()}
          aria-label="Rückgängig"
          title="Rückgängig (Strg+Z)"
          aria-keyshortcuts="Control+Z"
        >
          ↶
        </button>
        <button
          type="button"
          className="h-8 cursor-pointer rounded-hd-ctl bg-hd-chip px-3 text-hd-ink disabled:cursor-default disabled:opacity-40"
          disabled={!canRedo}
          onClick={() => build.redo()}
          aria-label="Wiederholen"
          title="Wiederholen (Strg+Y)"
          aria-keyshortcuts="Control+Y"
        >
          ↷
        </button>
        <span aria-hidden className="h-[22px] w-px bg-hd-line" />
        {confirmCancel ? (
          <>
            <span className="text-[13px] max-sm:hidden">Änderungen verwerfen?</span>
            <button type="button" className="hd-btn hd-btn-danger hd-btn-sm" onClick={onCancel}>
              Verwerfen
            </button>
            <button
              type="button"
              className="hd-btn hd-btn-ghost hd-btn-sm"
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
        <button type="button" className="hd-btn hd-btn-primary" disabled={saving} onClick={onSave}>
          {saving ? "Wird geprüft…" : "Speichern"}
        </button>
      </section>

      {/* Werkzeuge links */}
      <div
        ref={rail}
        role="toolbar"
        aria-label="Werkzeuge"
        aria-orientation="vertical"
        className="pointer-events-auto absolute top-[70px] left-4 z-30 flex w-[58px] flex-col gap-1 rounded-hd-panel border border-hd-line bg-hd-surface p-1.5"
      >
        {BAU_WERKZEUGE.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={btool === w}
            title={WERKZEUG_LABELS[w]}
            onClick={() => build.setTool(w)}
            className={`flex h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[10px] ${
              btool === w
                ? "bg-hd-accent text-hd-accent-ink"
                : "bg-transparent text-hd-ink-2 hover:bg-hd-raised"
            }`}
          >
            <span aria-hidden className="text-[15px] leading-none">
              {GLYPH[w]}
            </span>
            <span className="text-[10px] font-semibold">{WERKZEUG_LABELS[w]}</span>
          </button>
        ))}
      </div>

      {/* Panel rechts (schmale Fenster: unten) */}
      <section
        aria-label="Bau-Einstellungen"
        className="pointer-events-auto absolute z-30 flex flex-col gap-3 overflow-y-auto rounded-hd-panel border border-hd-line bg-hd-surface p-4 max-md:inset-x-2 max-md:bottom-2 max-md:max-h-[42vh] md:top-[70px] md:right-4 md:max-h-[calc(100%-150px)] md:w-[268px]"
      >
        {btool === "deko" && (
          <>
            <DekoSection build={build} model={model} />
          </>
        )}
        {btool === "weg" && (
          <>
            <WegSection build={build} model={model} />
          </>
        )}
        {none && (
          <>
            <Kicker>Anordnen</Kicker>
            <p className="text-[13px] leading-normal text-hd-ink-2">
              Haus ziehen, um es zu versetzen. Den runden Griff in der Mitte ziehen, um ein ganzes
              Quartier zu verschieben. Bäume weichen automatisch aus und kommen zurück, wenn wieder
              Platz ist.
            </p>
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px]">Alles auf Automatik zurücksetzen?</span>
                <button
                  type="button"
                  className="hd-btn hd-btn-danger hd-btn-sm"
                  onClick={() => {
                    build.resetAll();
                    setConfirmReset(false);
                  }}
                >
                  Ja
                </button>
                <button
                  type="button"
                  className="hd-btn hd-btn-ghost hd-btn-sm"
                  onClick={() => setConfirmReset(false)}
                >
                  Nein
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="cursor-pointer self-start text-[12.5px] text-hd-muted underline"
                onClick={() => setConfirmReset(true)}
              >
                Alles auf Automatik …
              </button>
            )}
          </>
        )}
        {btool !== "deko" && btool !== "weg" && <Picker build={build} model={model} />}
        {quarter && btool !== "weg" && btool !== "deko" && (
          <QuarterSection build={build} model={model} q={quarter} />
        )}
        {house && btool !== "weg" && btool !== "deko" && (
          <>
            <Rule />
            <HouseSection build={build} model={model} houseId={house} />
          </>
        )}
        <span className="border-t border-hd-line pt-2.5 text-[11.5px] text-hd-faint">
          Esc hebt die Auswahl auf · Strg+Z rückgängig
        </span>
      </section>

      {/* Meldungen unten (schmale Fenster: über dem Panel). Die Hinweiszeile ist immer da und wechselt nur
          ihren Text: nachträglich eingefügte Live-Regionen sagen Bildschirmleser oft nicht an. */}
      <div
        className="pointer-events-none absolute left-1/2 z-30 flex w-[min(560px,calc(100%-32px))] -translate-x-1/2 flex-col items-center gap-1.5 bottom-[var(--bau-ansage)] max-md:bottom-[calc(42vh+16px)]"
        style={{ "--bau-ansage": `${BUILD_HUD.bottom - 46}px` } as CSSProperties}
      >
        {error && (
          <p
            role="alert"
            data-testid="bau-fehler"
            className="max-w-full rounded-hd-panel border border-hd-danger bg-hd-surface px-3.5 py-2 text-center text-[13px] font-semibold break-words text-hd-danger"
          >
            {error}
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          data-testid="bau-ansage"
          className={
            text
              ? `max-w-full rounded-hd-panel border bg-hd-surface px-3.5 py-2 text-center text-[13px] font-semibold break-words ${
                  isBad ? "border-hd-danger text-hd-danger" : "border-hd-line text-hd-ink"
                }`
              : "sr-only"
          }
        >
          {text}
        </p>
      </div>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { createArtifact, updateArtifact } from "@/app/dorf/actions";
import { Toggle } from "@/components/ui/controls";
import { PanelBody, PanelFooter } from "@/components/ui/panel";
import { detectItemType, hostOf, ITEM_TYPE_LABELS } from "@/lib/item-types";
import {
  ARTIFACT_KINDS,
  ARTIFACT_KIND_LABELS,
  type Artifact,
  type ArtifactKind,
} from "@/lib/types";
import type { HouseInfo } from "@/lib/village-model";
import { KIND_COLORS } from "../../village/colors";
import { chipBtn, dangerBtn, primaryBtn, TafelError } from "./shared";

type Step = 1 | 2 | 3;
type Form = {
  step: Step;
  link: string;
  title: string;
  kind: ArtifactKind;
  houseId: string;
  shared: boolean;
  desc: string;
  allowCopy: boolean;
  topdorf: boolean;
};

const LINK_RE = /^https:\/\/[^\s]+\.[^\s]+/;
const STEPS: [Step, string][] = [
  [1, "Link"],
  [2, "Einordnen"],
  [3, "Freigabe"],
];

/**
 * Tafel «Objekt» (8c + 8e): drei Schritte Link → Einordnen → Freigabe, darüber eine Vorschau-Karte; ein Klick auf
 * Titel, Kategorie, Haus oder Sichtbarkeit springt zum Schritt. Neu: geführt mit Prüfung (https, Titel),
 * gespeichert wird im letzten Schritt. Bearbeiten: startet bei Schritt 2, frei springen, jederzeit speichern,
 * Löschen mit Rückgängig. Bewusst ohne manuellen Objekttyp und Tags (Typ wird aus dem Link erkannt).
 */
export function ObjectSteps({
  artifact,
  houseId,
  houses,
  onSaved,
  onDelete,
}: {
  /** Vorhandenes Objekt (Bearbeiten) oder `undefined` (neu). */
  artifact?: Artifact;
  /** Zielhaus für ein neues Objekt. */
  houseId: string;
  houses: HouseInfo[];
  /** Gespeichert: neue Id (neu) und Haus. */
  onSaved: (res: { id: string | null; houseId: string; isNew: boolean }) => void;
  onDelete?: () => void;
}) {
  const isNew = !artifact;
  const isCopy = artifact?.is_copy ?? false;
  const [f, setF] = useState<Form>(() => ({
    step: isNew ? 1 : 2,
    link: artifact?.url ?? "",
    title: artifact?.title ?? "",
    kind: artifact?.kind ?? "rechner",
    houseId: artifact?.house_id ?? houseId,
    shared: artifact ? artifact.visibility === "shared" : true,
    desc: artifact?.description ?? "",
    allowCopy: artifact?.allow_copy ?? true,
    topdorf: artifact?.topdorf_ok ?? false,
  }));
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const set = (p: Partial<Form>) => {
    setErr("");
    setF((x) => ({ ...x, ...p }));
  };

  const linkOk = LINK_RE.test(f.link.trim());
  const type = f.link.trim() ? detectItemType(f.link.trim()) : null;
  const house = houses.find((h) => h.id === f.houseId);
  const shared = f.shared && !isCopy;

  const check = (): string => {
    if (!linkOk) return "Bitte einen Link mit https:// einfügen.";
    if (!f.title.trim()) return "Der Titel fehlt.";
    return "";
  };
  const go = (step: Step) => {
    // Neu: vorwärts nur mit gültigem Link und Titel
    if (isNew && step > f.step) {
      const e = f.step === 1 ? check() : "";
      if (e) return setErr(e);
    }
    if (isNew && step > f.step + 1) return;
    set({ step });
  };

  const save = () => {
    const e = check();
    if (e) {
      setF((x) => ({ ...x, step: 1 }));
      return setErr(e);
    }
    const fd = new FormData();
    if (artifact) fd.set("id", artifact.id);
    fd.set("houseId", f.houseId);
    fd.set("url", f.link.trim());
    fd.set("itemType", "auto");
    fd.set("title", f.title.trim());
    fd.set("description", f.desc.trim());
    fd.set("kind", f.kind);
    fd.set("tags", artifact?.tags.join(", ") ?? "");
    fd.set("visibility", shared ? "shared" : "private");
    if (f.allowCopy && !isCopy) fd.set("allowCopy", "on");
    if (f.topdorf && shared) fd.set("topdorfOk", "on");
    start(async () => {
      const res = await (artifact ? updateArtifact({}, fd) : createArtifact({}, fd));
      if (res.error) return setErr(res.error);
      onSaved({ id: res.id ?? artifact?.id ?? null, houseId: f.houseId, isNew });
    });
  };

  const titleShown = f.title.trim();
  return (
    <>
      <div
        className="grid grid-cols-3 gap-1 pt-3 pr-[18px] pl-5"
        role="tablist"
        aria-label="Schritte"
      >
        {STEPS.map(([n, l]) => {
          const on = n === f.step;
          const reachable = !isNew || n <= f.step;
          return (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={!reachable}
              onClick={() => go(n)}
              className="flex cursor-pointer flex-col gap-[5px] text-left disabled:cursor-default"
            >
              <span
                className={`h-[3px] rounded-sm ${n <= f.step ? "bg-hd-accent-line" : "bg-hd-line"}`}
              />
              <span
                className={`text-[11.5px] whitespace-nowrap ${on ? "font-bold text-hd-ink" : "font-medium text-hd-muted"}`}
              >
                {n} {l}
                {n < f.step ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vorschau-Karte: Klick springt zum Schritt */}
      <div className="mx-[18px] mt-3 ml-5 grid grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-[12px] border border-hd-line bg-hd-raised">
        <span
          aria-hidden
          className="hd-hatch hd-mono flex items-center justify-center text-[9px] text-hd-faint"
          style={{ borderRight: `3px solid ${KIND_COLORS[f.kind]}` }}
        >
          BILD
        </span>
        <div className="flex min-w-0 flex-col gap-1.5 px-3 py-2.5">
          <button
            type="button"
            onClick={() => go(1)}
            className={`cursor-pointer border-b-[1.5px] border-dashed border-hd-accent-line pb-0.5 text-left text-[15px] leading-tight font-bold ${titleShown ? "text-hd-ink" : "text-hd-faint"}`}
          >
            {titleShown || "Titel folgt"}
          </button>
          <div className="flex flex-wrap gap-[5px]">
            <button type="button" onClick={() => go(2)} className="hd-card-chip">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: KIND_COLORS[f.kind] }}
              />
              {ARTIFACT_KIND_LABELS[f.kind]}
            </button>
            <button type="button" onClick={() => go(2)} className="hd-card-chip">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-[2px]"
                style={{ background: house?.color }}
              />
              {house ? (house.kind === "zentrale" ? "Zentrale" : house.title) : "Haus"}
            </button>
            <button type="button" onClick={() => go(3)} className="hd-card-chip">
              {shared ? "Freunde" : "Nur ich"}
            </button>
          </div>
          <span className="hd-mono truncate text-[10.5px] text-hd-accent-text">
            {linkOk && type
              ? `${hostOf(f.link.trim())} · ${ITEM_TYPE_LABELS[type]}`
              : "Link fehlt noch"}
          </span>
        </div>
      </div>

      <PanelBody>
        {isCopy && (
          <p className="rounded-hd-ctl bg-hd-raised p-3 text-[13px] text-hd-ink-2">
            <strong>Eigene Version verknüpfen:</strong> Passe das Objekt in Claude an (bei geteilten
            Artifacts z.B. über «Remix», falls angeboten) und füge hier den Link deiner Version ein.
          </p>
        )}
        {f.step === 1 && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-hd-muted">Link</span>
              <input
                value={f.link}
                onChange={(e) => set({ link: e.target.value })}
                placeholder="https://claude.ai/public/artifacts/…"
                inputMode="url"
                autoComplete="off"
                data-autofocus
                className="hd-input hd-mono !text-[13px]"
              />
              <span className="text-[12px] text-hd-accent-text">
                {type && linkOk
                  ? `${ITEM_TYPE_LABELS[type]} erkannt`
                  : "Claude-Artifact, GitHub, Gist, Cloud-Ordner oder Link"}
              </span>
              {type === "claude_artifact" && (
                <span className="text-[11.5px] text-hd-faint">
                  In claude.ai «Jeder mit dem Link» wählen, sonst können Freunde es nicht öffnen.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-hd-muted">Titel</span>
              <input
                value={f.title}
                onChange={(e) => set({ title: e.target.value })}
                maxLength={120}
                placeholder="z.B. Momentenrechner Einfeldträger"
                className="hd-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (isNew) go(2);
                    else save();
                  }
                }}
              />
            </label>
          </>
        )}
        {f.step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] text-hd-muted" id="kind-label">
                Was ist es?
              </span>
              <div
                role="radiogroup"
                aria-labelledby="kind-label"
                className="grid grid-cols-2 gap-1.5"
              >
                {ARTIFACT_KINDS.map((k) => {
                  const on = f.kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ kind: k })}
                      className={`flex cursor-pointer items-center gap-[9px] rounded-hd-ctl border px-[11px] py-2.5 text-left text-[13px] font-semibold ${
                        on
                          ? "border-hd-accent-line bg-hd-accent-soft"
                          : "border-hd-line hover:bg-hd-raised"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-[13px] w-[13px] flex-none rounded-[4px]"
                        style={{ background: KIND_COLORS[k] }}
                      />
                      {ARTIFACT_KIND_LABELS[k]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] text-hd-muted" id="house-label">
                In welches Haus? ·{" "}
                <span className="font-semibold text-hd-ink">
                  {house ? (house.kind === "zentrale" ? "Zentrale" : house.title) : ""}
                </span>
              </span>
              <div
                role="radiogroup"
                aria-labelledby="house-label"
                className="flex flex-wrap gap-1.5"
              >
                {houses.map((h) => {
                  const on = h.id === f.houseId;
                  const name = h.kind === "zentrale" ? "Zentrale" : h.title;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={name}
                      title={name}
                      onClick={() => set({ houseId: h.id })}
                      className={`h-6 w-6 cursor-pointer rounded-hd-ctl ${on ? "shadow-[0_0_0_2px_var(--hd-surface),0_0_0_4px_var(--hd-accent-line)]" : ""}`}
                      style={{ background: h.color }}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
        {f.step === 3 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] text-hd-muted" id="vis-label">
                Wer sieht es?
              </span>
              <div
                role="radiogroup"
                aria-labelledby="vis-label"
                className="grid grid-cols-2 gap-1.5"
              >
                {(
                  [
                    [true, "Freunde", "sehen und öffnen"],
                    [false, "Nur ich", "privat"],
                  ] as const
                ).map(([v, l, sub]) => {
                  const on = shared === v;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={isCopy && v}
                      onClick={() => set({ shared: v })}
                      className={`cursor-pointer rounded-hd-ctl border px-3 py-2.5 text-left disabled:cursor-default disabled:opacity-45 ${
                        on
                          ? "border-hd-accent bg-hd-accent-soft"
                          : "border-hd-line hover:bg-hd-raised"
                      }`}
                    >
                      <div className="text-[13.5px] font-semibold">{l}</div>
                      <div className="text-[12px] text-hd-muted">{sub}</div>
                    </button>
                  );
                })}
              </div>
              {isCopy && (
                <span className="text-[12px] text-hd-muted">
                  Übernahmen sind nur für dich sichtbar.
                </span>
              )}
            </div>
            {!isCopy && (
              <>
                <Toggle
                  label="Andere dürfen übernehmen"
                  on={f.allowCopy}
                  onChange={(v) => set({ allowCopy: v })}
                />
                <Toggle
                  label="Im Topdorf zeigen"
                  hint="Für alle angemeldeten Hub-Dome-Nutzer sichtbar, mit deinem Namen."
                  on={f.topdorf}
                  disabled={!shared}
                  onChange={(v) => set({ topdorf: v })}
                />
              </>
            )}
            <textarea
              value={f.desc}
              onChange={(e) => set({ desc: e.target.value })}
              rows={2}
              maxLength={500}
              aria-label="Beschreibung (optional)"
              placeholder="Beschreibung (optional): kurz, wofür es gut ist"
              className="hd-input resize-y"
            />
            <p className="text-[11.5px] text-hd-faint">
              Teile keine Lösungen zu bewerteten Leistungsnachweisen.
            </p>
          </>
        )}
        <TafelError>{err}</TafelError>
      </PanelBody>
      <PanelFooter>
        {!isNew && onDelete && (
          <button type="button" onClick={onDelete} className={dangerBtn}>
            Löschen
          </button>
        )}
        <span className="flex-1" />
        {f.step > 1 && (
          <button
            type="button"
            onClick={() => set({ step: (f.step - 1) as Step })}
            className={chipBtn}
          >
            Zurück
          </button>
        )}
        {f.step < 3 && (
          <button
            type="button"
            onClick={() => go((f.step + 1) as Step)}
            className={isNew ? primaryBtn : chipBtn}
          >
            Weiter
          </button>
        )}
        {(!isNew || f.step === 3) && (
          <button type="button" onClick={save} disabled={pending} className={primaryBtn}>
            {pending ? "Speichere …" : isNew ? "Ans Haus hängen" : "Speichern"}
          </button>
        )}
      </PanelFooter>
    </>
  );
}

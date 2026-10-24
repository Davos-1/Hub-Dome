"use client";

import type { ReactNode } from "react";
import type { TimeSetting } from "@/lib/daytime";
import { FACHBEREICHE } from "@/lib/fachbereiche";
import { hostOf, ITEM_TYPE_ICONS, ITEM_TYPE_LABELS } from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact, type ArtifactKind } from "@/lib/types";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import { CopyControl, ItemMeta, openHref } from "../../world/item-extras";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";
import { EmptyArt } from "@/components/ui/empty-art";

export const TIME_ORDER: TimeSetting[] = ["morgen", "mittag", "abend", "nacht", "auto"];
export const FILTER_KINDS: ArtifactKind[] = [
  "rechner",
  "quiz",
  "zusammenfassung",
  "cheatsheet",
  "tool",
  "visualisierung",
];

const seg = (on: boolean) =>
  on ? "bg-hd-selected text-hd-selected-ink" : "bg-transparent text-hd-ink-2";
/** «neu» als kleiner Aufkleber (leicht schief, richtet sich beim Darüberfahren auf). */
const newBadge = "hd-sticker flex-none px-2 py-0.5 text-[11px] font-semibold";

/** Auswahl aus wenigen Möglichkeiten als Brett-Schalter. */
export function Segments<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="hd-label">{label}</div>
      <div
        className="flex flex-wrap gap-0.5 rounded-[10px] bg-hd-sunken p-[3px]"
        role="group"
        aria-label={label}
      >
        {options.map(([v, text]) => (
          <button
            key={v || "alle"}
            type="button"
            aria-pressed={value === v}
            onClick={() => onPick(v)}
            className={`flex-1 cursor-pointer rounded-[7px] px-1.5 py-[7px] text-[12.5px] font-semibold ${seg(value === v)}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Fenster rechts (Desktop) bzw. Blatt in der unteren Hälfte (Handy); Masse wie `HUD` in `insets.ts`. */
function Shell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-20 flex h-[52%] flex-col md:top-16 md:left-auto md:h-auto md:w-[min(380px,calc(100vw-24px))] hd-panel overflow-hidden"
    >
      <div className="hd-plank flex items-center justify-between gap-3 px-[18px] py-3.5">
        <div className="min-w-0">
          {subtitle && <div className="hd-kicker">{subtitle}</div>}
          <h2 className="truncate text-[18px] leading-tight font-bold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schliessen"
          className="hd-close h-8 w-8 flex-none text-[13px]"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-[18px] pt-4 pb-[18px]">
        {children}
      </div>
    </aside>
  );
}

function ObjectDetail({
  artifact,
  house,
  preview,
  isOwner,
  onBack,
  onEdit,
}: {
  artifact: Artifact;
  house: HouseInfo;
  preview: ReactNode;
  isOwner: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[13px] text-hd-accent-text underline"
      >
        ← Zurück zu {house.kind === "zentrale" ? "Zentrale" : house.title}
      </button>
      <h3 className="text-xl font-bold text-hd-ink">{artifact.title}</h3>
      <p className="hd-note">
        <span aria-hidden>{ITEM_TYPE_ICONS[artifact.item_type]}</span>{" "}
        {ITEM_TYPE_LABELS[artifact.item_type]} · {ARTIFACT_KIND_LABELS[artifact.kind]}
        {artifact.item_type !== "claude_artifact" && ` · ${hostOf(artifact.url)}`}
      </p>
      {artifact.description && <p className="text-[14px]">{artifact.description}</p>}
      {artifact.tags.length > 0 && <p className="hd-note">#{artifact.tags.join(" #")}</p>}
      {artifact.visibility === "private" && <p className="text-xs text-hd-new-ink">Privat</p>}
      <ItemMeta artifact={artifact} />
      <a
        href={openHref(artifact)}
        target="_blank"
        rel="noopener noreferrer"
        className="hd-btn hd-btn-primary"
      >
        Öffnen
      </a>
      <CopyControl artifact={artifact} hotkey />
      {isOwner && (
        <button type="button" onClick={onEdit} className="hd-btn hd-btn-ghost">
          {artifact.is_copy ? "Eigene Version verknüpfen" : "Objekt bearbeiten"}
        </button>
      )}
      {preview}
    </div>
  );
}

function HouseDetail({
  house,
  artifacts,
  isOwner,
  actions,
  onAdd,
  onEdit,
}: {
  house: HouseInfo;
  artifacts: Artifact[];
  isOwner: boolean;
  actions: SceneActions;
  onAdd: (houseId: string) => void;
  onEdit: (houseId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="hd-note">
        {house.kind === "zentrale" ? "Zentrale" : FACHBEREICHE[house.fach].name}
        {house.semester ? ` · ${house.semester}. Semester` : ""} · {artifacts.length}{" "}
        {artifacts.length === 1 ? "Objekt" : "Objekte"}
        {house.newCount > 0 && <span className={`${newBadge} ml-2`}>{house.newCount} neu</span>}
      </p>
      {artifacts.length === 0 ? (
        <p className="flex items-center gap-3 rounded-xl bg-hd-sunken p-3 text-sm text-hd-ink-2">
          <EmptyArt kind="baustelle" />
          <span>
            Baustelle: hier gibt es noch keine Objekte.
            {isOwner && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => onAdd(house.id)}
                  className="font-semibold underline"
                >
                  Erstes Objekt hinzufügen
                </button>
                .
              </>
            )}
          </span>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {artifacts.map((a) => {
            const isNew = house.items.find((o) => o.id === a.id)?.isNew;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => actions.goToObject(house.id, a.id)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-hd-line bg-hd-raised px-3 py-2 text-left hover:bg-hd-hover focus-visible:outline-2 focus-visible:outline-hd-accent-line"
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 flex-none rounded-[3px]"
                    style={{ background: KIND_COLORS[a.kind] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-hd-ink">
                      <span aria-hidden>{ITEM_TYPE_ICONS[a.item_type]}</span> {a.title}
                    </span>
                    <span className="hd-note block">
                      {ITEM_TYPE_LABELS[a.item_type]} · {ARTIFACT_KIND_LABELS[a.kind]}
                    </span>
                  </span>
                  {isNew && <span className={newBadge}>neu</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {isOwner && (
        <div className="flex flex-wrap gap-2">
          {artifacts.length > 0 && (
            <button
              type="button"
              onClick={() => onAdd(house.id)}
              className="hd-btn hd-btn-primary hd-btn-sm"
            >
              Objekt hinzufügen
            </button>
          )}
          {house.kind !== "zentrale" && (
            <button
              type="button"
              onClick={() => onEdit(house.id)}
              className="hd-btn hd-btn-ghost hd-btn-sm"
            >
              Haus bearbeiten
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QuarterDetail({
  model,
  quarterId,
  actions,
}: {
  model: VillageModel;
  quarterId: string;
  actions: SceneActions;
}) {
  const q = model.layout.quarters.find((x) => x.id === quarterId);
  if (!q) return null;
  return (
    <ul className="flex flex-col gap-2">
      {q.houseIds.map((id) => {
        const h = model.byId[id];
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => actions.openHouse(id)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-hd-line bg-hd-raised px-3 py-2 text-left hover:bg-hd-hover"
            >
              <span
                aria-hidden
                className="h-3 w-3 flex-none rounded-full"
                style={{ background: h.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-hd-ink">
                {h.title}
              </span>
              <span className="hd-note flex-none">
                {h.items.length === 0 ? "Baustelle" : `${h.items.length} Obj.`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Fenster rechts: Details des gewählten Quartiers, Hauses oder Objekts.
 * Gibt zurück, ob ein Fenster offen ist (Leiste unten rückt dann nach links).
 */
export function useSideWindowOpen(store: SceneStore): boolean {
  return useScene(store, (s) => s.nav.level !== "dorf");
}

export function SideWindow({
  model,
  store,
  actions,
  artifacts,
  previews,
  isOwner,
  onAddObject,
  onEditHouse,
  onEditObject,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  artifacts: Artifact[];
  previews: Record<string, ReactNode>;
  isOwner: boolean;
  /** Dialog «Objekt hinzufügen» für dieses Haus öffnen. */
  onAddObject: (houseId: string) => void;
  onEditHouse: (houseId: string) => void;
  onEditObject: (artifactId: string) => void;
}) {
  const nav = useScene(store, (s) => s.nav);
  const pinned = useScene(store, (s) => s.pinnedObjId);
  const closeDetail = () => actions.up();

  if (nav.level === "quartier") {
    const q = model.layout.quarters.find((x) => x.id === nav.q);
    return (
      <Shell title={q?.name ?? "Quartier"} subtitle="Quartier" onClose={closeDetail}>
        <QuarterDetail model={model} quarterId={nav.q} actions={actions} />
      </Shell>
    );
  }
  if (nav.level === "haus") {
    const house = model.byId[nav.h];
    if (!house) return null;
    const mine = artifacts.filter((a) => a.house_id === house.id);
    const artifact = pinned ? mine.find((a) => a.id === pinned) : undefined;
    return (
      <Shell
        title={house.kind === "zentrale" ? "Zentrale" : house.title}
        subtitle={artifact ? "Objekt" : "Haus"}
        onClose={closeDetail}
      >
        {artifact ? (
          <ObjectDetail
            artifact={artifact}
            house={house}
            preview={previews[artifact.id]}
            isOwner={isOwner}
            onBack={() => actions.goToObject(house.id, null)}
            onEdit={() => onEditObject(artifact.id)}
          />
        ) : (
          <HouseDetail
            house={house}
            artifacts={mine}
            isOwner={isOwner}
            actions={actions}
            onAdd={onAddObject}
            onEdit={onEditHouse}
          />
        )}
      </Shell>
    );
  }
  return null;
}

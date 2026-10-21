"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { TIME_LABELS, type TimeSetting } from "@/lib/daytime";
import { FACHBEREICHE } from "@/lib/fachbereiche";
import { hostOf, ITEM_TYPE_ICONS, ITEM_TYPE_LABELS } from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact, type ArtifactKind } from "@/lib/types";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

const TIME_ORDER: TimeSetting[] = ["morgen", "mittag", "abend", "auto"];
const FILTER_KINDS: ArtifactKind[] = [
  "rechner",
  "quiz",
  "zusammenfassung",
  "cheatsheet",
  "tool",
  "visualisierung",
];
const KEY_HINTS: [string, string][] = [
  ["Klick", "Quartier oder Haus öffnen"],
  ["← →", "Quartier oder Haus wählen"],
  ["Enter", "Auswahl öffnen"],
  ["Esc", "eine Ebene zurück"],
];

const seg = (on: boolean) => (on ? "bg-[#1c1b19] text-[#fffdf8]" : "bg-transparent text-[#3a3732]");
const linkClass =
  "text-[13px] font-medium text-[#2f5d4a] underline underline-offset-2 hover:text-[#1c3f32]";

function Segments<T extends string>({
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
      <div className="text-[13px] font-semibold text-[#1c1b19]">{label}</div>
      <div
        className="flex flex-wrap gap-0.5 rounded-[9px] bg-[#efeae0] p-[3px]"
        role="group"
        aria-label={label}
      >
        {options.map(([v, text]) => (
          <button
            key={v || "alle"}
            type="button"
            aria-pressed={value === v}
            onClick={() => onPick(v)}
            className={`flex-1 cursor-pointer rounded-[7px] px-1.5 py-[7px] text-[12.5px] font-medium ${seg(value === v)}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

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
      className="pointer-events-auto absolute top-3 right-3 bottom-3 z-20 flex w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl bg-[#fffdf8]/98 shadow-[0_12px_40px_rgba(28,27,25,.25)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#ebe6dc] px-[18px] pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold text-[#1c1b19]">{title}</h2>
          {subtitle && <div className="text-[12px] text-[#7a766d]">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schliessen"
          className="h-8 w-8 flex-none cursor-pointer rounded-lg bg-[#efeae0] text-[16px] text-[#3a3732]"
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

function SettingsWindow({
  store,
  actions,
  isOwner,
  ownerUsername,
}: {
  store: SceneStore;
  actions: SceneActions;
  isOwner: boolean;
  ownerUsername: string;
}) {
  const time = useScene(store, (s) => s.time);
  const view = useScene(store, (s) => s.view);
  const filter = useScene(store, (s) => s.filter);
  return (
    <Shell
      title="Einstellungen"
      subtitle="Änderungen gelten sofort"
      onClose={() => store.set({ panel: null })}
    >
      <Segments
        label="Tageszeit"
        value={time}
        options={TIME_ORDER.map((t) => [t, TIME_LABELS[t]] as [TimeSetting, string])}
        onPick={(t) => store.set({ time: t })}
      />
      <Segments
        label="Ansicht"
        value={view}
        options={[
          ["3d", "3D"],
          ["karte", "Karte"],
        ]}
        onPick={(v) => actions.setView(v)}
      />
      <Segments
        label="Nach Kategorie filtern"
        value={filter}
        options={[
          ["", "Alle"],
          ...FILTER_KINDS.map((k) => [k, ARTIFACT_KIND_LABELS[k]] as [ArtifactKind, string]),
        ]}
        onPick={(k) => store.set({ filter: k })}
      />
      <div className="flex flex-col gap-1.5 border-t border-[#ebe6dc] pt-2.5">
        <div className="pt-2.5 text-[13px] font-semibold text-[#1c1b19]">Bedienung</div>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-[12.5px] text-[#3a3732]">
          {KEY_HINTS.map(([k, text]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[11.5px] font-medium text-[#6d6a63]">{k}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#ebe6dc] pt-3.5">
        <Link href={`/dorf/${ownerUsername}/liste`} className={linkClass}>
          {isOwner ? "In der Listenansicht bearbeiten" : "Zur Listenansicht"}
        </Link>
        {isOwner && (
          <Link href="/einstellungen" className={linkClass}>
            Zentrale-Stil und Einstellungen
          </Link>
        )}
        <Link href="/doerfer" className={linkClass}>
          Alle Dörfer
        </Link>
      </div>
    </Shell>
  );
}

function ObjectDetail({
  artifact,
  house,
  preview,
  onBack,
}: {
  artifact: Artifact;
  house: HouseInfo;
  preview: ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[13px] text-[#2f5d4a] underline"
      >
        ← Zurück zu {house.kind === "zentrale" ? "Zentrale" : house.title}
      </button>
      <h3 className="text-xl font-semibold text-[#1c1b19]">{artifact.title}</h3>
      <p className="text-[13px] text-[#6d6a63]">
        <span aria-hidden>{ITEM_TYPE_ICONS[artifact.item_type]}</span>{" "}
        {ITEM_TYPE_LABELS[artifact.item_type]} · {ARTIFACT_KIND_LABELS[artifact.kind]}
        {artifact.item_type !== "claude_artifact" && ` · ${hostOf(artifact.url)}`}
      </p>
      {artifact.description && <p className="text-[14px]">{artifact.description}</p>}
      {artifact.tags.length > 0 && (
        <p className="text-xs text-[#6d6a63]">#{artifact.tags.join(" #")}</p>
      )}
      {artifact.visibility === "private" && <p className="text-xs text-amber-700">Privat</p>}
      <a
        href={artifact.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-[#2f5d4a] px-4 py-2 text-center font-medium text-[#fffdf8]"
      >
        Öffnen
      </a>
      {preview}
    </div>
  );
}

function HouseDetail({
  house,
  artifacts,
  isOwner,
  ownerUsername,
  actions,
}: {
  house: HouseInfo;
  artifacts: Artifact[];
  isOwner: boolean;
  ownerUsername: string;
  actions: SceneActions;
}) {
  const listHref = `/dorf/${ownerUsername}/liste#h-${house.id}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[#6d6a63]">
        {house.kind === "zentrale" ? "Zentrale" : FACHBEREICHE[house.fach].name}
        {house.semester ? ` · ${house.semester}. Semester` : ""} · {artifacts.length}{" "}
        {artifacts.length === 1 ? "Objekt" : "Objekte"}
        {house.newCount > 0 && (
          <span className="ml-2 rounded-full bg-[#fde68a] px-2 py-0.5 text-[11px] font-semibold text-[#78350f]">
            {house.newCount} neu
          </span>
        )}
      </p>
      {artifacts.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Baustelle: hier gibt es noch keine Objekte.
          {isOwner && (
            <>
              {" "}
              <Link href={listHref} className="underline">
                Erstes Objekt hinzufügen
              </Link>
              .
            </>
          )}
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
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-[#e2ddd2] px-3 py-2 text-left hover:bg-[#efeae0] focus-visible:outline-2 focus-visible:outline-[#2f5d4a]"
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 flex-none rounded-[3px]"
                    style={{ background: KIND_COLORS[a.kind] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#1c1b19]">
                      <span aria-hidden>{ITEM_TYPE_ICONS[a.item_type]}</span> {a.title}
                    </span>
                    <span className="block text-xs text-[#6d6a63]">
                      {ITEM_TYPE_LABELS[a.item_type]} · {ARTIFACT_KIND_LABELS[a.kind]}
                    </span>
                  </span>
                  {isNew && (
                    <span className="flex-none rounded-full bg-[#fde68a] px-2 py-0.5 text-[11px] font-semibold text-[#78350f]">
                      neu
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {isOwner && artifacts.length > 0 && (
        <Link href={listHref} className={linkClass}>
          In der Listenansicht bearbeiten
        </Link>
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
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-[#e2ddd2] px-3 py-2 text-left hover:bg-[#efeae0]"
            >
              <span
                aria-hidden
                className="h-3 w-3 flex-none rounded-full"
                style={{ background: h.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#1c1b19]">
                {h.title}
              </span>
              <span className="flex-none text-xs text-[#6d6a63]">
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
 * Fenster rechts: Einstellungen (wenn geöffnet), sonst Details des gewählten Quartiers, Hauses oder Objekts.
 * Gibt zurück, ob ein Fenster offen ist (Leiste unten rückt dann nach links).
 */
export function useSideWindowOpen(store: SceneStore): boolean {
  const panel = useScene(store, (s) => s.panel);
  const level = useScene(store, (s) => s.nav.level);
  return panel === "drawer" || level !== "dorf";
}

export function SideWindow({
  model,
  store,
  actions,
  artifacts,
  previews,
  isOwner,
  ownerUsername,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  artifacts: Artifact[];
  previews: Record<string, ReactNode>;
  isOwner: boolean;
  ownerUsername: string;
}) {
  const panel = useScene(store, (s) => s.panel);
  const nav = useScene(store, (s) => s.nav);
  const pinned = useScene(store, (s) => s.pinnedObjId);
  const closeDetail = () => actions.up();

  if (panel === "drawer") {
    return (
      <SettingsWindow
        store={store}
        actions={actions}
        isOwner={isOwner}
        ownerUsername={ownerUsername}
      />
    );
  }
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
            onBack={() => actions.goToObject(house.id, null)}
          />
        ) : (
          <HouseDetail
            house={house}
            artifacts={mine}
            isOwner={isOwner}
            ownerUsername={ownerUsername}
            actions={actions}
          />
        )}
      </Shell>
    );
  }
  return null;
}

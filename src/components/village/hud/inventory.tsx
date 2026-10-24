"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import {
  bulkDelete,
  bulkMoveArtifacts,
  bulkSetKind,
  bulkSetVisibility,
  type BulkResult,
} from "@/app/dorf/inventar-actions";
import { EmptyArt } from "@/components/ui/empty-art";
import { Segment } from "@/components/ui/controls";
import { FACH_ORDER } from "@/lib/fachbereiche";
import {
  ARTIFACT_KINDS,
  ARTIFACT_KIND_LABELS,
  type Artifact,
  type ArtifactKind,
} from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { useItemExtras } from "../../world/item-extras";
import { countText, PreviewTile } from "../../world/tafel/shared";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";
import { useUi } from "./ui-context";

type Zustand = "neu" | "nie" | "privat" | "ohne";
type Group = {
  key: string;
  name: string;
  color: string;
  patch: { houseId?: string; kind?: ArtifactKind };
};

/** Höhe des Welt-Streifens über dem Inventar (Pixel). */
export const INV_TOP = 150;

/**
 * Inventar (Phase 4h): Herauszoomen bis zum Anschlag bzw. Taste I. Die Welt bleibt als Streifen oben, das
 * Inventar fährt hoch. Filter nach Haus und Zustand (neu, nie geöffnet, nur ich, ohne Beschreibung), Gruppen
 * nach Haus oder Kategorie, Mehrfachauswahl → Verschieben, Kategorie, Sichtbarkeit, Löschen (mit Rückgängig),
 * Ziehen zwischen Gruppen, Doppelklick zeigt das Objekt im Dorf. Nie gleichzeitig mit der Liste.
 */
export function Inventory({
  model,
  store,
  actions,
  artifacts,
  onClose,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  artifacts: Artifact[];
  onClose: () => void;
}) {
  const open = useScene(store, (s) => s.inv);
  const ui = useUi();
  const x = useItemExtras();
  const [filter, setFilter] = useState("");
  const [by, setBy] = useState<"haus" | "kategorie">("haus");
  const [house, setHouse] = useState<string | null>(null);
  const [state, setState] = useState<Zustand | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [menu, setMenu] = useState<"move" | "kind" | null>(null);
  const [drop, setDrop] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dragIds = useRef<string[]>([]);
  const root = useRef<HTMLDivElement>(null);

  // Beim Öffnen Fokus ins Inventar (Esc schliesst, siehe Ansicht)
  useEffect(() => {
    if (open) root.current?.focus({ preventScroll: true });
  }, [open]);

  const houses = useMemo(
    () =>
      [
        ...model.houses.filter((h) => h.kind === "zentrale"),
        ...FACH_ORDER.flatMap((f) =>
          model.houses.filter((h) => h.kind !== "zentrale" && h.fach === f),
        ),
      ].map((h) => ({ ...h, name: h.kind === "zentrale" ? "Zentrale" : h.title })),
    [model],
  );
  const isNew = useMemo(
    () => new Map(model.houses.flatMap((h) => h.items.map((o) => [o.id, o.isNew] as const))),
    [model],
  );
  const opened = (id: string) => x.stats[id]?.geoeffnet ?? 0;
  const tests: Record<Zustand, (a: Artifact) => boolean> = {
    neu: (a) => !!isNew.get(a.id),
    nie: (a) => opened(a.id) === 0,
    privat: (a) => a.visibility === "private",
    ohne: (a) => !a.description,
  };
  const term = filter.trim().toLocaleLowerCase("de-CH");
  const pass = (a: Artifact) =>
    (!term ||
      `${a.title} ${ARTIFACT_KIND_LABELS[a.kind]} ${a.description ?? ""}`
        .toLocaleLowerCase("de-CH")
        .includes(term)) &&
    (!house || a.house_id === house) &&
    (!state || tests[state](a));
  const filtered = !!(term || house || state);
  const shown = artifacts.filter(pass);

  const groups: Group[] =
    by === "haus"
      ? houses
          .filter((h) => !house || h.id === house)
          .map((h) => ({ key: h.id, name: h.name, color: h.color, patch: { houseId: h.id } }))
      : ARTIFACT_KINDS.map((k) => ({
          key: k,
          name: ARTIFACT_KIND_LABELS[k],
          color: KIND_COLORS[k],
          patch: { kind: k },
        }));
  const inGroup = (g: Group, a: Artifact) =>
    g.patch.houseId ? a.house_id === g.patch.houseId : a.kind === g.patch.kind;

  const selected = artifacts.filter((a) => sel.includes(a.id));
  const allPrivate = selected.length > 0 && selected.every((a) => a.visibility === "private");
  const toggle = (id: string) => {
    setMenu(null);
    setSel((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
  };

  /** Massenaktion mit Rückgängig: alte Werte je Objekt merken und beim Rückgängig gruppiert zurückschreiben. */
  const apply = (
    ids: string[],
    patch: Group["patch"] | { visibility: "shared" | "private" },
    text: string,
  ) => {
    const before = artifacts.filter((a) => ids.includes(a.id));
    setMenu(null);
    start(async () => {
      let res: BulkResult;
      if ("houseId" in patch && patch.houseId)
        res = await bulkMoveArtifacts({ ids, houseId: patch.houseId });
      else if ("kind" in patch && patch.kind) res = await bulkSetKind({ ids, kind: patch.kind });
      else if ("visibility" in patch)
        res = await bulkSetVisibility({ ids, visibility: patch.visibility });
      else return;
      if ("error" in res) return ui.say(res.error, { error: true });
      ui.say(text, {
        undo: () =>
          start(async () => {
            const by = <K extends "house_id" | "kind" | "visibility">(k: K) => {
              const m = new Map<Artifact[K], string[]>();
              for (const a of before) m.set(a[k], [...(m.get(a[k]) ?? []), a.id]);
              return [...m];
            };
            if ("houseId" in patch)
              for (const [h, g] of by("house_id")) await bulkMoveArtifacts({ ids: g, houseId: h });
            if ("kind" in patch)
              for (const [k, g] of by("kind")) await bulkSetKind({ ids: g, kind: k });
            if ("visibility" in patch)
              for (const [v, g] of by("visibility"))
                await bulkSetVisibility({ ids: g, visibility: v });
          }),
      });
    });
  };

  const remove = (ids: string[]) => {
    setSel([]);
    setMenu(null);
    ui.deferred(
      ids.length === 1 ? "1 Objekt gelöscht" : `${ids.length} Objekte gelöscht`,
      ids,
      () => {
        void bulkDelete({ ids }).then((r) => "error" in r && ui.say(r.error, { error: true }));
      },
    );
  };

  const onDrop = (e: DragEvent, g: Group) => {
    e.preventDefault();
    setDrop(null);
    const ids = dragIds.current.filter((id) => {
      const a = artifacts.find((v) => v.id === id);
      return a && !inGroup(g, a);
    });
    dragIds.current = [];
    if (ids.length)
      apply(
        ids,
        g.patch,
        ids.length === 1 ? `Nach ${g.name} verschoben` : `${ids.length} nach ${g.name} verschoben`,
      );
  };

  const zustand: [Zustand, string][] = [
    ["neu", "Neu"],
    ["nie", "Nie geöffnet"],
    ["privat", "Nur ich"],
    ["ohne", "Ohne Beschreibung"],
  ];
  const side = "flex cursor-pointer items-center gap-2 rounded-hd-ctl px-2.5 py-[7px] text-left";

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-hd-ui
      data-hd-inv
      aria-hidden={!open || undefined}
      inert={!open}
      role="region"
      aria-label="Inventar"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 grid grid-cols-[220px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-hd-panel border-t border-hd-line bg-hd-surface shadow-hd-panel outline-none transition-transform duration-500 ease-[var(--hd-ease)] motion-reduce:transition-none max-md:grid-cols-1"
      style={{ top: INV_TOP, transform: open ? "translateY(0)" : "translateY(105%)" }}
    >
      <div className="col-span-2 flex flex-wrap items-center gap-3.5 border-b border-hd-line px-5 py-3.5 max-md:col-span-1">
        <h2 className="text-[20px] font-bold">Inventar</h2>
        <span className="text-[13px] whitespace-nowrap text-hd-muted">
          {filtered ? `${shown.length} von ` : ""}
          {artifacts.length} Objekten
        </span>
        <span className="flex-1" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtern …"
          aria-label="Objekte filtern"
          className="hd-input !w-60 !py-[7px] !text-[13px]"
        />
        <Segment
          label="Gruppieren"
          value={by}
          size="sm"
          onPick={setBy}
          options={[
            { value: "haus", label: "Nach Haus" },
            { value: "kategorie", label: "Nach Kategorie" },
          ]}
        />
        <button
          type="button"
          onClick={onClose}
          className="hd-btn hd-btn-ghost hd-btn-sm"
          aria-keyshortcuts="I Escape"
        >
          Zurück ins Dorf · I
        </button>
      </div>

      <nav
        aria-label="Filter"
        className="flex flex-col gap-px overflow-y-auto border-r border-hd-line px-2 py-3 text-[13px] max-md:hidden"
      >
        <span className="hd-kicker px-2.5 pt-1 pb-2 !text-hd-faint">Häuser</span>
        {houses.map((h) => (
          <button
            key={h.id}
            type="button"
            aria-pressed={house === h.id}
            onClick={() => setHouse((v) => (v === h.id ? null : h.id))}
            className={`${side} ${house === h.id ? "bg-hd-accent-soft" : "hover:bg-hd-raised"}`}
          >
            <span
              aria-hidden
              className="h-[9px] w-[9px] flex-none rounded-[2px]"
              style={{ background: h.color }}
            />
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
            <span className="text-[12px] text-hd-faint">{h.items.length}</span>
          </button>
        ))}
        <span className="hd-kicker px-2.5 pt-4 pb-2 !text-hd-faint">Zustand</span>
        {zustand.map(([id, l]) => (
          <button
            key={id}
            type="button"
            aria-pressed={state === id}
            onClick={() => setState((v) => (v === id ? null : id))}
            className={`${side} ${state === id ? "bg-hd-accent-soft" : "hover:bg-hd-raised"}`}
          >
            <span className="flex-1">{l}</span>
            <span className="text-[12px] text-hd-faint">{artifacts.filter(tests[id]).length}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-[18px] overflow-y-auto px-5 py-4">
        {artifacts.length === 0 && (
          <div className="flex items-center gap-3 rounded-hd-panel border border-dashed border-hd-line p-4 text-[13px] text-hd-muted">
            <EmptyArt kind="baustelle" />
            Noch keine Objekte. Wähle im Dorf ein Haus und hänge mit «Objekt» das erste an.
          </div>
        )}
        {artifacts.length > 0 &&
          groups.map((g) => {
            const items = shown.filter((a) => inGroup(g, a));
            if (filtered && !items.length) return null;
            return (
              <section
                key={g.key}
                aria-label={g.name}
                onDragOver={(e) => {
                  if (!dragIds.current.length) return;
                  e.preventDefault();
                  if (drop !== g.key) setDrop(g.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
                }}
                onDrop={(e) => onDrop(e, g)}
                className={`-m-2 flex flex-col gap-2 rounded-hd-panel p-2 ${drop === g.key ? "bg-hd-accent-soft" : ""}`}
              >
                <h3 className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ background: g.color }}
                  />
                  <span className="font-bold">{g.name}</span>
                  <span className="text-hd-faint">{countText(items.length)}</span>
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
                  {items.map((a) => {
                    const on = sel.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        draggable
                        aria-pressed={on}
                        aria-label={`${a.title}, ${ARTIFACT_KIND_LABELS[a.kind]}${on ? ", gewählt" : ""}`}
                        onClick={() => toggle(a.id)}
                        onDoubleClick={() => {
                          setSel([]);
                          onClose();
                          actions.openTafel(a.house_id, "objekt", a.id);
                        }}
                        onDragStart={(e) => {
                          dragIds.current = sel.includes(a.id) ? sel : [a.id];
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", a.id);
                        }}
                        onDragEnd={() => {
                          dragIds.current = [];
                          setDrop(null);
                        }}
                        className={`relative flex h-[118px] cursor-pointer flex-col justify-between overflow-hidden rounded-hd-ctl bg-hd-raised text-left select-none ${
                          on ? "shadow-[0_0_0_2px_var(--hd-accent)]" : "hover:brightness-110"
                        }`}
                      >
                        <PreviewTile kind={a.kind} itemType={a.item_type} height={41} label="" />
                        <span className="flex flex-1 flex-col justify-between gap-1 px-2.5 pt-2 pb-2.5">
                          <span className="line-clamp-2 text-[12.5px] leading-[1.3] font-semibold">
                            {a.title}
                          </span>
                          <span className="truncate text-[11px] text-hd-muted">
                            {ARTIFACT_KIND_LABELS[a.kind]} ·{" "}
                            {a.visibility === "private" ? "Nur ich" : "Freunde"}
                          </span>
                        </span>
                        {on && (
                          <span
                            aria-hidden
                            className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-hd-accent text-[10px] font-bold text-hd-accent-ink"
                          >
                            ✓
                          </span>
                        )}
                        {isNew.get(a.id) && (
                          <span className="absolute right-1.5 bottom-1.5 text-[10px] font-bold text-hd-accent-text">
                            neu
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {!items.length && (
                    <div className="flex h-[118px] items-center justify-center rounded-hd-ctl border border-dashed border-hd-line text-[12px] text-hd-faint">
                      Hierher ziehen
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        {filtered && shown.length === 0 && artifacts.length > 0 && (
          <p className="text-[13px] text-hd-muted">Keine Objekte passen zu den Filtern.</p>
        )}
      </div>

      <div className="relative col-span-2 flex min-h-[58px] flex-wrap items-center gap-2 border-t border-hd-line bg-hd-raised px-5 py-3 text-[13px] max-md:col-span-1">
        {sel.length > 0 ? (
          <>
            <span className="font-bold whitespace-nowrap text-hd-accent-text">
              {sel.length} ausgewählt
            </span>
            <span aria-hidden className="mx-1.5 h-[18px] w-px bg-hd-line" />
            <button
              type="button"
              aria-expanded={menu === "move"}
              onClick={() => setMenu((m) => (m === "move" ? null : "move"))}
              className="hd-btn hd-btn-ghost hd-btn-sm"
            >
              Verschieben nach …
            </button>
            <button
              type="button"
              aria-expanded={menu === "kind"}
              onClick={() => setMenu((m) => (m === "kind" ? null : "kind"))}
              className="hd-btn hd-btn-ghost hd-btn-sm"
            >
              Kategorie …
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                apply(
                  sel,
                  { visibility: allPrivate ? "shared" : "private" },
                  allPrivate ? "Für Freunde freigegeben" : "Auf «Nur ich» gesetzt",
                )
              }
              className="hd-btn hd-btn-ghost hd-btn-sm"
            >
              {allPrivate ? "Für Freunde freigeben" : "Auf «Nur ich» setzen"}
            </button>
            {sel.length === 1 && (
              <button
                type="button"
                onClick={() => {
                  const a = selected[0];
                  setSel([]);
                  onClose();
                  if (a) actions.openTafel(a.house_id, "objekt", a.id);
                }}
                className="hd-btn hd-btn-ghost hd-btn-sm"
              >
                Im Dorf zeigen
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(sel)}
              className="hd-btn hd-btn-danger hd-btn-sm"
            >
              Löschen
            </button>
            <button
              type="button"
              onClick={() => setSel([])}
              className="cursor-pointer px-2.5 py-[7px] whitespace-nowrap text-hd-muted"
            >
              Auswahl aufheben
            </button>
          </>
        ) : (
          <span className="ml-auto text-hd-muted max-md:hidden">
            Klick wählt · Ziehen verschiebt · Doppelklick zeigt im Dorf
          </span>
        )}
        {menu && sel.length > 0 && (
          <div
            role="menu"
            className="hd-rise absolute bottom-[54px] flex max-h-80 w-[230px] flex-col overflow-auto rounded-hd-panel border border-hd-line bg-hd-surface p-1.5 shadow-hd-panel"
            style={{ left: menu === "move" ? 140 : 290 }}
          >
            {menu === "move"
              ? houses.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      apply(sel, { houseId: h.id }, `${sel.length} nach ${h.name} verschoben`)
                    }
                    className="flex cursor-pointer items-center gap-[9px] rounded-hd-ctl px-2.5 py-2 text-left hover:bg-hd-raised"
                  >
                    <span
                      aria-hidden
                      className="h-[9px] w-[9px] rounded-[2px]"
                      style={{ background: h.color }}
                    />
                    {h.name}
                  </button>
                ))
              : ARTIFACT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="menuitem"
                    onClick={() => apply(sel, { kind: k }, `Kategorie: ${ARTIFACT_KIND_LABELS[k]}`)}
                    className="flex cursor-pointer items-center gap-[9px] rounded-hd-ctl px-2.5 py-2 text-left hover:bg-hd-raised"
                  >
                    <span
                      aria-hidden
                      className="h-[9px] w-[9px] rounded-full"
                      style={{ background: KIND_COLORS[k] }}
                    />
                    {ARTIFACT_KIND_LABELS[k]}
                  </button>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

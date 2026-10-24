"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { reorderArtifacts } from "@/app/dorf/inventar-actions";
import { FACHBEREICHE, FACH_ORDER } from "@/lib/fachbereiche";
import { ARTIFACT_KIND_LABELS, type Artifact } from "@/lib/types";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";
import { useUi } from "./ui-context";

type Sort = "eigen" | "name" | "zuletzt";
const SORT_LABEL: Record<Sort, string> = {
  eigen: "Eigene Reihenfolge",
  name: "Nach Name",
  zuletzt: "Zuletzt hinzugefügt",
};
const NEXT: Record<Sort, Sort> = { eigen: "name", name: "zuletzt", zuletzt: "eigen" };
const LIST_KEY = "hubdome-liste-breite";
const MIN = 320;
const MAX = 680;

/** Breite der Liste beim Öffnen (zuletzt gezogene Breite, sonst 420 px). */
export function listWidth(): number {
  try {
    const v = Number(localStorage.getItem(LIST_KEY));
    return v >= MIN && v <= MAX ? v : 420;
  } catch {
    return 420;
  }
}

const norm = (s: string) => s.toLocaleLowerCase("de-CH");

/**
 * Liste links (Phase 4h, «Baum»): Quartier › Haus › Objekt mit Suche und Sortierung. Ein Haus wählen fliegt hin
 * (Haus in der Mitte der freien Fläche), ein Objekt öffnet seine Tafel und hebt es in der Welt hervor. Besitzer
 * ziehen Objekte zum Umsortieren oder in ein anderes Haus (auch per Alt+Pfeil), «+» legt ein Objekt an.
 * Breite per Griff, gemerkt im Browser.
 */
export function ListPanel({
  model,
  store,
  actions,
  artifacts,
  isOwner,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  artifacts: Artifact[];
  isOwner: boolean;
}) {
  const listW = useScene(store, (s) => s.listW);
  const selHouse = useScene(store, (s) => (s.nav.level === "haus" ? s.nav.h : null));
  const selObj = useScene(store, (s) => s.tafel?.objId ?? null);
  const ui = useUi();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("eigen");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [drop, setDrop] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dragId = useRef<string | null>(null);
  const byId = useMemo(() => new Map(artifacts.map((a) => [a.id, a])), [artifacts]);

  // Häuser in der Reihenfolge der Quartiere (Zentrale zuerst), Objekte nach eigener Reihenfolge
  const groups = useMemo(() => {
    const zentrale = model.houses.filter((h) => h.kind === "zentrale");
    const rest = FACH_ORDER.flatMap((f) =>
      (model.layout.quarters.find((x) => x.id === f)?.houseIds ?? [])
        .map((id) => model.byId[id])
        .filter(Boolean),
    );
    // Häuser ohne Platz in der Welt (selten) trotzdem zeigen
    const seen = new Set([...zentrale, ...rest].map((h) => h.id));
    const missing = model.houses.filter((h) => !seen.has(h.id));
    return [...zentrale, ...rest, ...missing];
  }, [model]);

  const ordered = (h: HouseInfo) => {
    const items = h.items.slice();
    if (sort === "name") items.sort((a, b) => a.title.localeCompare(b.title, "de-CH"));
    else if (sort === "zuletzt") items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else
      items.sort(
        (a, b) =>
          (byId.get(a.id)?.sort ?? 0) - (byId.get(b.id)?.sort ?? 0) ||
          a.createdAt.localeCompare(b.createdAt),
      );
    return items;
  };
  const term = norm(q.trim());
  const total = model.houses.reduce((n, h) => n + h.items.length, 0);
  const visible = groups
    .map((h) => ({
      h,
      items: ordered(h).filter(
        (o) =>
          !term || norm(`${o.title} ${ARTIFACT_KIND_LABELS[o.kind]} ${h.title}`).includes(term),
      ),
    }))
    .filter(({ h, items }) => !term || items.length > 0 || norm(h.title).includes(term));
  const canDrag = isOwner && sort === "eigen" && !term && !pending;

  /** Objekt `id` vor `beforeId` (bzw. ans Ende) in Haus `houseId` einsortieren und speichern. */
  const place = (id: string, houseId: string, beforeId: string | null) => {
    const from = byId.get(id);
    const target = model.byId[houseId];
    if (!from || !target || id === beforeId) return;
    const prevFrom = ordered(model.byId[from.house_id]).map((o) => o.id);
    const prevTo = ordered(target).map((o) => o.id);
    const next = prevTo.filter((x) => x !== id);
    const at = beforeId ? next.indexOf(beforeId) : -1;
    next.splice(at < 0 ? next.length : at, 0, id);
    if (next.join() === prevTo.join()) return;
    start(async () => {
      const res = await reorderArtifacts({ houseId, ids: next });
      if ("error" in res) return ui.say(res.error, { error: true });
      const moved = from.house_id !== houseId;
      ui.say(
        moved
          ? `Nach ${target.kind === "zentrale" ? "Zentrale" : target.title} verschoben`
          : "Verschoben",
        {
          undo: () =>
            start(async () => {
              // Erst zurück ins alte Haus (in alter Reihenfolge), dann die alte Reihenfolge im Ziel
              if (moved) await reorderArtifacts({ houseId: from.house_id, ids: prevFrom });
              if (prevTo.length) await reorderArtifacts({ houseId, ids: prevTo });
            }),
        },
      );
    });
  };

  const onDragStart = (e: DragEvent, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDrop = (e: DragEvent, houseId: string, beforeId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragId.current;
    dragId.current = null;
    setDrop(null);
    if (id) place(id, houseId, beforeId);
  };
  const over = (e: DragEvent, key: string) => {
    if (!dragId.current) return;
    e.preventDefault();
    if (drop !== key) setDrop(key);
  };

  if (!listW) return null;
  let lastQ: string | null = null;

  return (
    <aside
      aria-label="Alle Objekte"
      data-hd-ui
      className="pointer-events-auto absolute inset-y-0 left-0 z-10 overflow-hidden border-r border-hd-line bg-hd-surface"
      style={{ width: listW }}
    >
      <div className="flex h-full flex-col" style={{ width: Math.max(listW, MIN) }}>
        <div className="flex flex-col gap-2.5 border-b border-hd-line px-4 pt-3.5 pb-2.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[17px] font-bold">Alle Objekte</h2>
            <span className="text-[12.5px] text-hd-muted">
              {total} in {model.houses.length} {model.houses.length === 1 ? "Haus" : "Häusern"}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              aria-label="Liste schliessen"
              onClick={() => store.set({ listW: 0 })}
              className="hd-close flex h-[26px] w-[26px] items-center justify-center text-[11px]"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Suchen …"
              aria-label="Objekte suchen"
              className="hd-input min-w-0 flex-1 !py-[7px] !text-[13px]"
            />
            <button
              type="button"
              onClick={() => setSort(NEXT[sort])}
              aria-label={`Sortierung: ${SORT_LABEL[sort]}. Wechseln`}
              className="cursor-pointer rounded-hd-ctl border border-hd-line px-2.5 py-1.5 text-[12px] whitespace-nowrap text-hd-ink-2 hover:bg-hd-raised"
            >
              {SORT_LABEL[sort]}
            </button>
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto px-2 pt-1.5 pb-5 text-[13px]"
          role="tree"
          aria-label="Häuser und Objekte"
        >
          {visible.map(({ h, items }) => {
            const quarter = h.kind === "zentrale" ? "Zentrale" : FACHBEREICHE[h.fach].name;
            const showQ = quarter !== lastQ;
            lastQ = quarter;
            const open = !closed[h.id] || !!term;
            const name = h.kind === "zentrale" ? "Zentrale" : h.title;
            return (
              <div key={h.id} className="flex flex-col">
                {showQ && (
                  <span className="hd-kicker px-2.5 pt-3 pb-1 !text-[10px] !text-hd-faint">
                    {quarter}
                  </span>
                )}
                <div
                  role="treeitem"
                  aria-expanded={open}
                  aria-selected={selHouse === h.id && !selObj}
                  onDragOver={(e) => over(e, `h${h.id}`)}
                  onDragLeave={() => drop === `h${h.id}` && setDrop(null)}
                  onDrop={(e) => onDrop(e, h.id, null)}
                  className={`flex items-center gap-2 rounded-hd-ctl px-2 py-[7px] ${
                    selHouse === h.id && !selObj ? "bg-hd-accent-soft" : ""
                  } ${drop === `h${h.id}` ? "shadow-[inset_0_0_0_1.5px_var(--hd-accent-line)]" : ""}`}
                >
                  <button
                    type="button"
                    aria-label={open ? `${name} zuklappen` : `${name} aufklappen`}
                    onClick={() => setClosed((c) => ({ ...c, [h.id]: open }))}
                    className="w-3.5 cursor-pointer text-[10px] text-hd-faint"
                  >
                    {open ? "▾" : "▸"}
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.openHouse(h.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    <span
                      aria-hidden
                      className="h-[9px] w-[9px] flex-none rounded-[2px]"
                      style={{ background: h.color }}
                    />
                    <span className="truncate font-bold">{name}</span>
                    <span className="flex-none text-[12px] text-hd-faint">
                      {h.items.length === 0 ? "Baustelle" : h.items.length}
                    </span>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      title="Objekt hinzufügen"
                      aria-label={`Objekt in ${name} hinzufügen`}
                      onClick={() => actions.openTafel(h.id, "neu")}
                      className="cursor-pointer px-1 text-[15px] text-hd-muted hover:text-hd-ink"
                    >
                      +
                    </button>
                  )}
                </div>
                {open &&
                  items.map((o, i) => {
                    const a = byId.get(o.id);
                    const tag = o.isNew ? "neu" : a?.visibility === "private" ? "privat" : "";
                    const on = selObj === o.id;
                    return (
                      <div
                        key={o.id}
                        role="treeitem"
                        aria-selected={on}
                        draggable={canDrag}
                        onDragStart={(e) => onDragStart(e, o.id)}
                        onDragEnd={() => {
                          dragId.current = null;
                          setDrop(null);
                        }}
                        onDragOver={(e) => over(e, `r${o.id}`)}
                        onDrop={(e) => onDrop(e, h.id, o.id)}
                        className={`group grid grid-cols-[14px_10px_minmax(0,1fr)_auto] items-center gap-2 rounded-hd-ctl py-1.5 pr-2 pl-[26px] hover:bg-hd-raised ${
                          on ? "bg-hd-accent-soft shadow-[0_0_0_2px_var(--hd-accent-line)]" : ""
                        } ${drop === `r${o.id}` ? "shadow-[inset_0_2px_0_var(--hd-accent)]" : ""}`}
                      >
                        <span
                          aria-hidden
                          className={`text-[10px] text-hd-faint ${canDrag ? "cursor-grab" : "opacity-0"}`}
                        >
                          ⋮⋮
                        </span>
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ background: KIND_COLORS[o.kind] }}
                        />
                        <button
                          type="button"
                          onClick={() => actions.openTafel(h.id, "objekt", o.id)}
                          onKeyDown={(e) => {
                            if (!canDrag || !e.altKey) return;
                            if (e.key === "ArrowUp" && i > 0) {
                              e.preventDefault();
                              place(o.id, h.id, items[i - 1].id);
                            } else if (e.key === "ArrowDown" && i < items.length - 1) {
                              e.preventDefault();
                              place(o.id, h.id, items[i + 2]?.id ?? null);
                            }
                          }}
                          aria-keyshortcuts={canDrag ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
                          className="min-w-0 cursor-pointer truncate text-left"
                        >
                          {o.title}
                        </button>
                        <span className="text-[11.5px] whitespace-nowrap text-hd-faint">{tag}</span>
                      </div>
                    );
                  })}
              </div>
            );
          })}
          {total === 0 && (
            <p className="m-2 rounded-hd-ctl border border-dashed border-hd-line p-3 text-[13px] text-hd-muted">
              Noch keine Objekte. {isOwner ? "Wähle ein Haus und hänge mit «+» das erste an." : ""}
            </p>
          )}
          {term && visible.length === 0 && (
            <p className="m-2 text-[13px] text-hd-muted">Nichts gefunden für «{q.trim()}».</p>
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * Griff am linken Rand («Punkte»): Klick öffnet bzw. schliesst die Liste (L), Ziehen ändert die Breite
 * (unter 140 px zu, mindestens 320, höchstens 680 px; gemerkt im Browser).
 */
export function ListGrip({ store }: { store: SceneStore }) {
  const listW = useScene(store, (s) => s.listW);
  const [drag, setDrag] = useState<{ x: number; w: number; moved: boolean } | null>(null);
  const save = (w: number) => {
    try {
      if (w >= MIN) localStorage.setItem(LIST_KEY, String(w));
    } catch {
      /* Speicher nicht verfügbar */
    }
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Liste: ziehen oder klicken (L)"
      aria-valuenow={listW}
      aria-valuemin={0}
      aria-valuemax={MAX}
      tabIndex={0}
      title="Ziehen oder klicken: Liste (L)"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          store.set({ listW: listW ? 0 : listWidth() });
        }
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDrag({ x: e.clientX, w: listW, moved: false });
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < 4) return;
        if (!drag.moved) setDrag({ ...drag, moved: true });
        store.set({ listW: Math.max(0, Math.min(MAX, drag.w + dx)), inv: false });
      }}
      onPointerUp={() => {
        if (!drag) return;
        let w = store.get().listW;
        if (!drag.moved) w = drag.w > 0 ? 0 : listWidth();
        else if (w < 140) w = 0;
        else if (w < MIN) w = MIN;
        store.set({ listW: w, inv: false });
        if (drag.moved) save(w);
        setDrag(null);
      }}
      className={`group pointer-events-auto absolute inset-y-0 z-10 flex w-4 cursor-col-resize items-center justify-center hover:bg-hd-accent-soft focus-visible:bg-hd-accent-soft max-md:hidden ${
        drag ? "" : "transition-[left] duration-300"
      }`}
      style={{ left: listW }}
    >
      <span aria-hidden className="flex flex-col gap-[5px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-[5px] w-[5px] rounded-full ${listW || drag ? "bg-hd-accent-line" : "bg-hd-faint"}`}
          />
        ))}
      </span>
    </div>
  );
}

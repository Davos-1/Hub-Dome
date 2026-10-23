"use client";

import { useMemo, useState } from "react";
import { ARTIFACT_KIND_LABELS } from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";
import { EmptyArt } from "@/components/ui/empty-art";

type Hit = {
  key: string;
  houseId: string;
  objId: string | null;
  label: string;
  sub: string;
  color: string;
};

const countText = (n: number) => (n === 0 ? "Baustelle" : n === 1 ? "1 Objekt" : `${n} Objekte`);

/** Suche nach Häusern (Titel, Kürzel) und Objekten (Titel, Kategorie); die Wahl fliegt zum Haus. */
export function SearchBox({ model, actions }: { model: VillageModel; actions: SceneActions }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Hit[] = [];
    for (const h of model.houses) {
      if (h.kind !== "zentrale" && `${h.title} ${h.code}`.toLowerCase().includes(q)) {
        out.push({
          key: h.id,
          houseId: h.id,
          objId: null,
          label: h.title,
          sub: `${h.code} · ${countText(h.items.length)}`,
          color: h.color,
        });
      }
      for (const o of h.items) {
        if (`${o.title} ${ARTIFACT_KIND_LABELS[o.kind]}`.toLowerCase().includes(q)) {
          out.push({
            key: o.id,
            houseId: h.id,
            objId: o.id,
            label: o.title,
            sub: `${ARTIFACT_KIND_LABELS[o.kind]} · ${h.kind === "zentrale" ? "Zentrale" : h.code}`,
            color: KIND_COLORS[o.kind],
          });
        }
      }
    }
    return out.slice(0, 7);
  }, [query, model]);

  const choose = (h: Hit) => {
    setOpen(false);
    setQuery("");
    // Fokus abgeben: auf dem Handy schrumpft das Suchfeld wieder und gibt die Brotkrumen frei
    (document.activeElement as HTMLElement | null)?.blur();
    actions.goToObject(h.houseId, h.objId);
  };

  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-30 flex w-[148px] max-w-[calc(100vw-24px)] flex-col gap-1 transition-[width] duration-200 focus-within:w-[calc(100vw-24px)] md:w-[260px] md:focus-within:w-[260px]">
      <input
        type="search"
        value={query}
        placeholder="Suchen …"
        aria-label="Haus oder Objekt suchen"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && hits[0]) choose(hits[0]);
          if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full rounded-lg hd-float border border-hd-line-strong px-3 py-2 text-[13px] font-medium text-hd-ink shadow-hd-pop outline-none focus-visible:border-hd-accent"
      />
      {open && query.trim() && (
        <div
          role="listbox"
          aria-label="Suchergebnisse"
          className="flex flex-col overflow-hidden hd-float rounded-lg shadow-hd-pop"
        >
          {hits.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-[9px] text-[13px] text-hd-muted">
              <EmptyArt kind="suche" className="h-6 w-8" />
              Keine Treffer
            </div>
          )}
          {hits.map((h) => (
            <button
              key={h.key}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => choose(h)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-hd-hover"
            >
              <span
                aria-hidden
                className="h-3 w-3 flex-none rounded-[3px] ring-1 ring-hd-ink/12 ring-inset"
                style={{ background: h.color }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold text-hd-ink">{h.label}</span>
                <span className="text-[11.5px] text-hd-muted">{h.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

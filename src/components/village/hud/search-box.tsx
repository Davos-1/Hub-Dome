"use client";

import { useMemo, useState } from "react";
import { ARTIFACT_KIND_LABELS } from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "../colors";
import type { SceneActions } from "../scene-actions";

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
    actions.goToObject(h.houseId, h.objId);
  };

  return (
    <div className="pointer-events-auto absolute top-3 right-3 flex w-[260px] max-w-[calc(100vw-24px)] flex-col gap-1">
      <input
        type="search"
        value={query}
        placeholder="Haus oder Objekt suchen…"
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
        className="w-full rounded-lg border border-[#1c1b19]/15 bg-[#fffdf8]/95 px-3 py-2 text-[13px] font-medium text-[#1c1b19] shadow-[0_1px_3px_rgba(0,0,0,.1)] outline-none focus-visible:border-[#2f5d4a]"
      />
      {open && query.trim() && (
        <div
          role="listbox"
          aria-label="Suchergebnisse"
          className="flex flex-col overflow-hidden rounded-lg bg-[#fffdf8]/98 shadow-[0_4px_14px_rgba(0,0,0,.15)]"
        >
          {hits.length === 0 && (
            <div className="px-3 py-[9px] text-[13px] text-[#7a766d]">Keine Treffer</div>
          )}
          {hits.map((h) => (
            <button
              key={h.key}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => choose(h)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-[#efeae0]"
            >
              <span
                aria-hidden
                className="h-3 w-3 flex-none rounded-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]"
                style={{ background: h.color }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold text-[#1c1b19]">{h.label}</span>
                <span className="text-[11.5px] text-[#6d6a63]">{h.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

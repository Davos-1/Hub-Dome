"use client";

import { useMemo, useState } from "react";
import { FACHBEREICHE } from "@/lib/fachbereiche";
import {
  hostOf,
  ITEM_TYPES,
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
  type ItemType,
} from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact } from "@/lib/types";
import type { HouseInfo, VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "../village/colors";
import type { SceneActions } from "../village/scene-actions";
import { DialogShell } from "./dialog-shell";
import { CopyControl, ItemMeta, openHref } from "./item-extras";

type Section = { key: string; title: string; houses: HouseInfo[] };

/** Alle Häuser nach Quartier (Zentrale zuerst), in der Reihenfolge der Welt. */
function sections(model: VillageModel): Section[] {
  const out: Section[] = [];
  const zentrale = model.houses.find((h) => h.kind === "zentrale");
  if (zentrale) out.push({ key: "zentrale", title: "Zentrale", houses: [zentrale] });
  for (const q of model.layout.quarters) {
    out.push({
      key: q.id,
      title: FACHBEREICHE[q.id].name,
      houses: q.houseIds.map((id) => model.byId[id]),
    });
  }
  return out;
}

/**
 * Listenansicht als Dialog: alle Häuser und Objekte als Text, mit Suche und Typ-Filter. Ergänzt die 3D-Welt
 * für Tastatur, Screenreader, Mobile und grosse Dörfer. Besitzer sehen Bearbeiten-Knöpfe.
 */
export function ListDialog({
  model,
  artifacts,
  isOwner,
  actions,
  lowDetail,
  onAddObject,
  onEditHouse,
  onEditObject,
  onClose,
}: {
  model: VillageModel;
  artifacts: Artifact[];
  isOwner: boolean;
  actions: SceneActions;
  lowDetail: boolean;
  onAddObject: (houseId: string) => void;
  onEditHouse: (houseId: string) => void;
  onEditObject: (artifactId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ItemType | "">("");

  const byHouse = useMemo(() => {
    const map = new Map<string, Artifact[]>();
    for (const a of artifacts) map.set(a.house_id, [...(map.get(a.house_id) ?? []), a]);
    return map;
  }, [artifacts]);
  const presentTypes = ITEM_TYPES.filter((t) => artifacts.some((a) => a.item_type === t));

  const q = query.trim().toLowerCase();
  const matches = (a: Artifact, h: HouseInfo) =>
    (!type || a.item_type === type) &&
    (!q ||
      `${a.title} ${a.description ?? ""} ${a.tags.join(" ")} ${h.title}`.toLowerCase().includes(q));

  const shown = sections(model)
    .map((s) => ({
      ...s,
      houses: s.houses
        .map((h) => ({ h, items: (byHouse.get(h.id) ?? []).filter((a) => matches(a, h)) }))
        // Bei Suche oder Filter nur Häuser mit Treffern; sonst alle (auch Baustellen)
        .filter((x) => (!q && !type) || x.items.length > 0),
    }))
    .filter((s) => s.houses.length > 0);

  const total = shown.reduce((n, s) => n + s.houses.reduce((m, x) => m + x.items.length, 0), 0);

  return (
    <DialogShell
      title="Liste"
      kicker="Hub Dome · Übersicht"
      icon="objekt"
      subtitle="Alle Häuser und Objekte dieses Dorfs."
      onClose={onClose}
      size="lg"
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <label htmlFor="list-search" className="sr-only">
            In der Liste suchen
          </label>
          <input
            id="list-search"
            data-autofocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel, Beschreibung, Tag oder Haus suchen…"
            className="hd-input"
          />
          {presentTypes.length > 1 && (
            <div
              role="group"
              aria-label="Nach Objekttyp filtern"
              className="flex flex-wrap gap-1.5"
            >
              {(["", ...presentTypes] as (ItemType | "")[]).map((t) => (
                <button
                  key={t || "alle"}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-semibold ${
                    type === t
                      ? "border-[#5e3c22] bg-[#5e3c22] text-[#fbf3e4]"
                      : "border-[#d9c9a8] bg-[#fffdf8] text-[#3a3732] hover:bg-[#f3ead4]"
                  }`}
                >
                  {t ? `${ITEM_TYPE_ICONS[t]} ${ITEM_TYPE_LABELS[t]}` : "Alle"}
                </button>
              ))}
            </div>
          )}
          <p role="status" className="hd-note">
            {total} {total === 1 ? "Objekt" : "Objekte"}
            {(q || type) && " gefunden"}
          </p>
        </div>

        {shown.length === 0 && <p className="hd-card hd-note">Nichts gefunden.</p>}

        {shown.map((s) => (
          <section key={s.key} aria-label={s.title} className="flex flex-col gap-2.5">
            <h3 className="font-mono text-[11.5px] font-semibold tracking-[.08em] text-[#7a766d] uppercase">
              {s.title}
            </h3>
            {s.houses.map(({ h, items }) => (
              <div key={h.id} className="hd-card flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 flex-none rounded-full"
                      style={{ background: h.color }}
                    />
                    <h4 className="truncate text-[16px] font-bold">
                      {h.kind === "zentrale" ? "Zentrale" : h.title}
                    </h4>
                    <span className="hd-note flex-none">
                      {h.kind !== "zentrale" && `${h.code} · `}
                      {h.semester ? `${h.semester}. Semester · ` : ""}
                      {h.items.length === 0
                        ? "Baustelle"
                        : `${h.items.length} ${h.items.length === 1 ? "Objekt" : "Objekte"}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="hd-btn hd-btn-ghost hd-btn-sm"
                      onClick={() => {
                        onClose();
                        actions.goToObject(h.id, null);
                      }}
                    >
                      In 3D zeigen
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className="hd-btn hd-btn-ghost hd-btn-sm"
                        onClick={() => onAddObject(h.id)}
                      >
                        Objekt hinzufügen
                      </button>
                    )}
                    {isOwner && h.kind !== "zentrale" && (
                      <button
                        type="button"
                        className="hd-btn hd-btn-ghost hd-btn-sm"
                        onClick={() => onEditHouse(h.id)}
                      >
                        Haus bearbeiten
                      </button>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {items.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-1 rounded-xl border-[1.5px] border-[#e4d9c0] bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={openHref(a)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 text-[14px] font-semibold text-[#2f5d4a] underline underline-offset-2"
                          >
                            {a.title}
                          </a>
                          <span
                            className="flex flex-none items-center gap-1 rounded-full bg-[#efe6d0] px-2 py-0.5 text-[11px] font-semibold"
                            title="Inhaltskategorie"
                          >
                            <span
                              aria-hidden
                              className="h-2 w-2 rounded-[2px]"
                              style={{ background: KIND_COLORS[a.kind] }}
                            />
                            {ARTIFACT_KIND_LABELS[a.kind]}
                          </span>
                        </div>
                        <p className="hd-note">
                          <span aria-hidden>{ITEM_TYPE_ICONS[a.item_type]}</span>{" "}
                          {ITEM_TYPE_LABELS[a.item_type]}
                          {a.item_type !== "claude_artifact" && ` · ${hostOf(a.url)}`}
                          {a.visibility === "private" && " · privat"}
                        </p>
                        {a.description && <p className="text-[13px]">{a.description}</p>}
                        {a.tags.length > 0 && <p className="hd-note">#{a.tags.join(" #")}</p>}
                        <ItemMeta artifact={a} />
                        <CopyControl artifact={a} />
                        <div className="mt-1 flex gap-1.5">
                          <button
                            type="button"
                            className="hd-btn hd-btn-ghost hd-btn-sm"
                            onClick={() => {
                              onClose();
                              actions.goToObject(h.id, a.id);
                            }}
                          >
                            In 3D zeigen
                          </button>
                          {isOwner && (
                            <button
                              type="button"
                              className="hd-btn hd-btn-ghost hd-btn-sm"
                              onClick={() => onEditObject(a.id)}
                            >
                              Bearbeiten
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </DialogShell>
  );
}

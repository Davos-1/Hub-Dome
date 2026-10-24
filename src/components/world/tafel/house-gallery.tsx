"use client";

import { EmptyArt } from "@/components/ui/empty-art";
import { PanelBody, PanelFooter } from "@/components/ui/panel";
import { ARTIFACT_KIND_LABELS, type Artifact } from "@/lib/types";
import type { HouseInfo } from "@/lib/village-model";
import { useItemExtras } from "../item-extras";
import { chipBtn, PreviewTile, primaryBtn, Stats } from "./shared";

/**
 * Tafel «Öffnen» (7b): Kennzahlen oben, darunter die Objekte des Hauses als Galerie in zwei Spalten mit
 * Vorschau, Kategoriestreifen und «neu»; ein Klick öffnet das Objekt.
 */
export function HouseGallery({
  house,
  artifacts,
  isOwner,
  onObject,
  onAdd,
  onEdit,
}: {
  house: HouseInfo;
  artifacts: Artifact[];
  isOwner: boolean;
  onObject: (id: string) => void;
  onAdd: () => void;
  onEdit: () => void;
}) {
  const x = useItemExtras();
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const items = house.items.map((o) => ({ o, a: byId.get(o.id) })).filter((r) => r.a);
  const opened = (id: string) => x.stats[id]?.geoeffnet ?? 0;
  const total = isOwner ? items.reduce((t, r) => t + opened(r.o.id), 0) : null;

  return (
    <>
      <PanelBody className="!gap-2.5">
        <Stats
          items={[
            { v: items.length, l: items.length === 1 ? "Objekt" : "Objekte" },
            { v: house.newCount, l: "neu" },
            { v: total ?? "–", l: "geöffnet" },
            { v: house.semester ? `${house.semester}.` : "–", l: "Semester" },
          ]}
        />
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-hd-ctl border border-dashed border-hd-line p-3 text-[13px] text-hd-muted">
            <EmptyArt kind="baustelle" />
            <span>Baustelle: hier gibt es noch keine Objekte.</span>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {items.map(({ o, a }) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onObject(o.id)}
                  className="relative flex w-full cursor-pointer flex-col overflow-hidden rounded-hd-ctl bg-hd-raised text-left transition-[filter] hover:brightness-110"
                >
                  <PreviewTile kind={o.kind} itemType={o.itemType} />
                  <span className="flex flex-col gap-[3px] px-2.5 pt-[9px] pb-2.5">
                    <span className="text-[12.5px] leading-[1.3] font-semibold">{o.title}</span>
                    <span className="text-[11px] text-hd-muted">
                      {ARTIFACT_KIND_LABELS[o.kind]}
                      {isOwner
                        ? ` · ${opened(o.id) ? `${opened(o.id)}× geöffnet` : "nie geöffnet"}`
                        : a!.visibility === "private"
                          ? " · privat"
                          : ""}
                    </span>
                  </span>
                  {o.isNew && (
                    <span className="hd-sticker absolute top-1.5 right-1.5 px-[7px] py-px text-[10px]">
                      neu
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
      {isOwner && (
        <PanelFooter line={false}>
          <button type="button" onClick={onAdd} className={`${primaryBtn} flex-1`}>
            + Objekt
          </button>
          {house.kind !== "zentrale" && (
            <button type="button" onClick={onEdit} className={chipBtn}>
              Haus bearbeiten
            </button>
          )}
        </PanelFooter>
      )}
    </>
  );
}

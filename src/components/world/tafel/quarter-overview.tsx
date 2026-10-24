"use client";

import { PanelBody, PanelFooter } from "@/components/ui/panel";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { VillageModel } from "@/lib/village-model";
import { useItemExtras } from "../item-extras";
import { chipBtn, countText } from "./shared";

/**
 * Tafel «Quartier» (Plan Abschnitt 3 Nr. 2): Übersicht der Häuser eines Quartiers mit Farbe, Objekten und
 * neuen; ein Klick wählt das Haus (Kamera fliegt hin). Besitzer: Haus in diesem Quartier anlegen.
 */
export function QuarterOverview({
  model,
  quarterId,
  isOwner,
  onHouse,
  onAddHouse,
}: {
  model: VillageModel;
  quarterId: FachbereichId;
  isOwner: boolean;
  onHouse: (id: string) => void;
  onAddHouse: () => void;
}) {
  const x = useItemExtras();
  const q = model.layout.quarters.find((v) => v.id === quarterId);
  const houses = (q?.houseIds ?? []).map((id) => model.byId[id]).filter(Boolean);
  const objects = houses.reduce((n, h) => n + h.items.length, 0);
  return (
    <>
      <PanelBody className="!gap-2">
        <p className="text-[12.5px] text-hd-muted">
          {houses.length} {houses.length === 1 ? "Haus" : "Häuser"} · {countText(objects)}
        </p>
        <ul className="flex flex-col gap-1">
          {houses.map((h) => {
            const opened = x.isOwner
              ? h.items.reduce((t, o) => t + (x.stats[o.id]?.geoeffnet ?? 0), 0)
              : null;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onHouse(h.id)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-hd-ctl bg-hd-raised px-3 py-2.5 text-left hover:bg-hd-chip"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 flex-none rounded-[3px]"
                    style={{ background: h.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{h.title}</span>
                    <span className="block text-[11.5px] text-hd-muted">
                      {countText(h.items.length)}
                      {h.semester ? ` · ${h.semester}. Semester` : ""}
                      {opened ? ` · ${opened}× geöffnet` : ""}
                    </span>
                  </span>
                  {h.newCount > 0 && (
                    <span className="hd-sticker px-[7px] py-px text-[10px]">{h.newCount} neu</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {houses.length === 0 && (
          <p className="rounded-hd-ctl border border-dashed border-hd-line p-3 text-[13px] text-hd-muted">
            In diesem Quartier steht noch kein Haus.
          </p>
        )}
      </PanelBody>
      {isOwner && (
        <PanelFooter line={false}>
          <button type="button" onClick={onAddHouse} className={chipBtn}>
            + Haus in diesem Quartier
          </button>
        </PanelFooter>
      )}
    </>
  );
}

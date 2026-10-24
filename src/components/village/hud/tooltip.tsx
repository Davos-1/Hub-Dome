"use client";

import { FACHBEREICHE } from "@/lib/fachbereiche";
import type { VillageModel } from "@/lib/village-model";
import { useItemExtras } from "../../world/item-extras";
import { useOverlay, type OverlayStore } from "../overlay-store";
import { useScene, type SceneStore } from "../scene-store";

const count = (n: number) => (n === 0 ? "Baustelle" : n === 1 ? "1 Objekt" : `${n} Objekte`);

/**
 * Tooltip beim Überfahren eines Hauses (Info-Menge «ausführlich»): Name, Quartier und Semester, Objekte und
 * neue, für den Besitzer wie oft geöffnet. Nicht über dem gewählten Haus (dort stehen Sucher und Kacheln).
 */
export function HouseTooltip({
  model,
  store,
  overlay,
}: {
  model: VillageModel;
  store: SceneStore;
  overlay: OverlayStore;
}) {
  const hoverId = useScene(store, (s) => s.hoverHouseId);
  const selId = useScene(store, (s) => (s.nav.level === "haus" ? s.nav.h : null));
  const busy = useScene(store, (s) => s.building || s.inv);
  const rect = useOverlay(overlay, (s) => s.hover);
  const extras = useItemExtras();
  const house = hoverId ? model.byId[hoverId] : undefined;
  if (!house || !rect || hoverId === selId || busy) return null;

  const n = house.items.length;
  const opened = extras.isOwner
    ? house.items.reduce((t, o) => t + (extras.stats[o.id]?.geoeffnet ?? 0), 0)
    : null;
  const lines = [
    house.kind === "zentrale"
      ? "Zentrale"
      : `${FACHBEREICHE[house.fach].name}${house.semester ? ` · ${house.semester}. Semester` : ""}`,
    `${count(n)}${n ? ` · ${house.newCount} neu` : ""}`,
    ...(opened !== null && n ? [`${opened}× geöffnet`] : []),
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col gap-0.5 rounded-hd-ctl border border-hd-line bg-hd-surface px-[11px] py-[7px] whitespace-nowrap shadow-hd-panel"
      style={{ left: rect.x + rect.w / 2, top: rect.y - 10 }}
    >
      <span className="text-[13px] font-bold text-hd-ink">
        {house.kind === "zentrale" ? "Zentrale" : house.title}
      </span>
      {lines.map((l) => (
        <span key={l} className="text-[11.5px] text-hd-muted">
          {l}
        </span>
      ))}
    </div>
  );
}

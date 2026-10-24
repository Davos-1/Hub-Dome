"use client";

import type { VillageModel } from "@/lib/village-model";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

/**
 * Brotkrumen oben links: Dorf / Quartier / Haus (Phase 4h). Wird es eng, kürzt sich zuerst das Quartier, dann
 * das Dorf; das Haus bleibt am längsten lesbar. Rückt mit der Liste nach rechts.
 */
export function Breadcrumb({
  model,
  store,
  actions,
  villageName,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  villageName: string;
}) {
  const nav = useScene(store, (s) => s.nav);
  const listW = useScene(store, (s) => s.listW);
  const inv = useScene(store, (s) => s.inv);
  const quarter = nav.level === "dorf" ? null : model.layout.quarters.find((q) => q.id === nav.q);
  const house = nav.level === "haus" ? model.byId[nav.h] : null;

  const seg = (label: string, onClick: () => void, strong: boolean, shrink: number) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={strong ? "location" : undefined}
      title={label}
      style={{ flex: `0 ${shrink} auto` }}
      className={`min-w-0 cursor-pointer truncate rounded-hd-ctl px-2 py-[5px] hover:bg-hd-raised ${
        strong ? "font-bold text-hd-ink" : "text-hd-muted"
      }`}
    >
      {label}
    </button>
  );
  const sep = (
    <span aria-hidden className="flex-none px-0.5 text-hd-faint">
      /
    </span>
  );

  return (
    <nav
      aria-label="Ebene im Dorf"
      className="pointer-events-auto absolute top-3.5 flex items-center gap-0.5 overflow-hidden rounded-hd-ctl border border-hd-line bg-hd-surface p-[3px] text-[13px] whitespace-nowrap transition-[left] duration-300"
      style={{ left: listW + 26, maxWidth: `max(120px, calc(100vw - ${listW + 26 + 330}px))` }}
    >
      {seg(villageName, actions.goHome, nav.level === "dorf" && !inv, 3)}
      {inv && (
        <>
          {sep}
          <span className="px-2 py-[5px] font-bold text-hd-ink">Inventar</span>
        </>
      )}
      {!inv && quarter && house?.kind !== "zentrale" && (
        <>
          {sep}
          {seg(quarter.name, () => actions.openQuarter(quarter.id), nav.level === "quartier", 4)}
        </>
      )}
      {!inv && house && (
        <>
          {sep}
          {seg(
            house.kind === "zentrale" ? "Zentrale" : house.title,
            () => actions.openHouse(house.id),
            true,
            1,
          )}
        </>
      )}
    </nav>
  );
}

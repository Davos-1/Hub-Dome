"use client";

import type { VillageModel } from "@/lib/village-model";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";

/** Brotkrumen oben links: Dorf › Quartier › Haus; jede Ebene davor ist anklickbar. */
export function Breadcrumb({
  model,
  store,
  actions,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
}) {
  const nav = useScene(store, (s) => s.nav);
  const quarter = nav.level === "dorf" ? null : model.layout.quarters.find((q) => q.id === nav.q);
  const house = nav.level === "haus" ? model.byId[nav.h] : null;

  const seg = (label: string, onClick: (() => void) | null, strong: boolean) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer rounded-md px-[9px] py-[5px] text-[#2f5d4a] hover:bg-[#efeae0] focus-visible:outline-2 focus-visible:outline-[#2f5d4a]"
      >
        {label}
      </button>
    ) : (
      <span
        className={`px-[9px] py-[5px] ${strong ? "font-semibold text-[#1c1b19]" : "text-[#2f5d4a]"}`}
      >
        {label}
      </span>
    );
  const sep = (
    <span className="text-[#a8a29e]" aria-hidden>
      ›
    </span>
  );

  return (
    <nav
      aria-label="Ebene im Dorf"
      className="pointer-events-auto absolute top-3 left-3 flex max-w-[calc(100vw-24px)] items-center gap-0.5 overflow-hidden rounded-[9px] bg-[#fffdf8]/95 p-1 text-[13px] font-medium shadow-[0_1px_3px_rgba(0,0,0,.15)]"
    >
      {seg("Dorf", nav.level === "dorf" ? null : actions.goHome, nav.level === "dorf")}
      {quarter && (
        <>
          {sep}
          {seg(
            quarter.name,
            nav.level === "haus" ? () => actions.openQuarter(quarter.id) : null,
            nav.level === "quartier",
          )}
        </>
      )}
      {nav.level === "haus" && house && (
        <>
          {sep}
          {seg(house.kind === "zentrale" ? "Zentrale" : house.title, null, true)}
        </>
      )}
    </nav>
  );
}

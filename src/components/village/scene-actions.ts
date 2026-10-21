import { navUp } from "@/lib/camera-poses";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { ViewMode } from "@/lib/camera-poses";
import type { VillageModel } from "@/lib/village-model";
import type { SceneStore } from "./scene-store";

/** Navigation durch das Dorf wie durch eine Ordnerstruktur: Dorf › Quartier › Haus. */
export function makeActions(store: SceneStore, model: VillageModel) {
  const { layout } = model;
  const zentraleId = model.houses.find((h) => h.kind === "zentrale")?.id ?? null;
  const homes = () => model.houses.filter((h) => h.kind !== "zentrale");
  const quarterOf = (houseId: string): FachbereichId | null =>
    layout.houses[houseId]?.quarterId ?? null;

  const openQuarter = (q: FachbereichId) => {
    store.set({
      nav: { level: "quartier", q },
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
      kbdQuarter: q,
      kbdHouse: null,
    });
  };

  const openHouse = (id: string) => {
    store.set({
      nav: { level: "haus", q: quarterOf(id), h: id },
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
      kbdHouse: id,
    });
  };

  const goHome = () => {
    store.set({ nav: { level: "dorf" }, pinnedObjId: null, highlight: null, hoverObjId: null });
  };

  /** Haus öffnen und ein Objekt hervorheben (Suche, Anschlagbrett, Klick auf ein Objekt). */
  const goToObject = (houseId: string, objId: string | null) => {
    openHouse(houseId);
    if (objId) {
      store.set({
        pinnedObjId: objId,
        highlight: { kind: "obj", id: objId, t0: performance.now() },
      });
    } else {
      store.set({ highlight: { kind: "house", id: houseId, t0: performance.now() } });
    }
  };

  const up = () => {
    const nav = store.get().nav;
    if (nav.level === "dorf") return;
    const next = navUp(nav);
    if (next.level === "quartier") openQuarter(next.q);
    else goHome();
  };

  const setView = (view: ViewMode) => {
    store.set({
      view,
      nav: { level: "dorf" },
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
      hoverHouseId: null,
    });
  };

  /** Pfeiltasten, Enter, Esc (Fokus im Canvas). Gibt zurück, ob die Taste verarbeitet wurde. */
  const onKey = (key: string): boolean => {
    const s = store.get();
    const list = homes();
    if (list.length === 0 && key !== "Escape") return false;
    const step = (
      { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>
    )[key];
    const quarters = layout.quarters;
    const cyc = <T>(items: T[], cur: T | undefined): T => {
      const i = cur === undefined ? -1 : items.indexOf(cur);
      return items[
        i < 0 ? (step > 0 ? 0 : items.length - 1) : (i + step + items.length) % items.length
      ];
    };
    if (step) {
      if (s.nav.level === "dorf" && quarters.length) {
        const ids = quarters.map((q) => q.id);
        store.set({ kbdQuarter: cyc(ids, s.kbdQuarter ?? undefined) });
        return true;
      }
      const nav = s.nav;
      const pool =
        nav.level !== "dorf" && nav.q
          ? layout.quarters.find((q) => q.id === nav.q)!.houseIds
          : list.map((h) => h.id);
      const cur = nav.level === "haus" ? nav.h : (s.kbdHouse ?? undefined);
      const next = cyc(pool, cur);
      if (nav.level === "haus") openHouse(next);
      else store.set({ kbdHouse: next });
      return true;
    }
    if (key === "Enter") {
      if (s.nav.level === "dorf" && quarters.length && s.kbdQuarter) {
        openQuarter(s.kbdQuarter);
        return true;
      }
      if (s.kbdHouse) {
        openHouse(s.kbdHouse);
        return true;
      }
      return false;
    }
    if (key === "Escape") {
      // Zuerst ein angeheftetes Objekt loslassen (zurück zum Haus), dann eine Ebene hoch
      if (s.pinnedObjId) {
        store.set({ pinnedObjId: null, highlight: null });
        return true;
      }
      store.set({ kbdHouse: null });
      up();
      return true;
    }
    return false;
  };

  return { openQuarter, openHouse, goHome, goToObject, up, setView, onKey, zentraleId };
}

export type SceneActions = ReturnType<typeof makeActions>;

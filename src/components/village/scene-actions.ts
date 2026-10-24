import { navUp } from "@/lib/camera-poses";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { ViewMode } from "@/lib/camera-poses";
import type { VillageModel } from "@/lib/village-model";
import type { SceneStore, Tafel, TafelMode } from "./scene-store";

/**
 * Navigation durch das Dorf wie durch eine Ordnerstruktur: Dorf › Quartier › Haus. Seit Phase 4h mit Tafeln am
 * Ort: Ein Haus wählen fliegt hin (Sucher und Kacheln), die Kacheln öffnen Tafeln daneben.
 */
export function makeActions(store: SceneStore, model: VillageModel) {
  const { layout } = model;
  const zentraleId = model.houses.find((h) => h.kind === "zentrale")?.id ?? null;
  const homes = () => model.houses.filter((h) => h.kind !== "zentrale");
  const quarterOf = (houseId: string): FachbereichId | null =>
    layout.houses[houseId]?.quarterId ?? null;

  /** Quartier öffnen: Kamera zum Quartier, Übersicht der Häuser als Tafel. */
  const openQuarter = (q: FachbereichId) => {
    store.set({
      nav: { level: "quartier", q },
      tafel: { mode: "quartier" },
      camHold: false,
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
      kbdQuarter: q,
      kbdHouse: null,
    });
  };

  /** Haus wählen: Kamera fliegt hin, danach erscheinen Sucher und Kacheln (keine Tafel). */
  const openHouse = (id: string, tafel: Tafel | null = null) => {
    store.set({
      nav: { level: "haus", q: quarterOf(id), h: id },
      tafel,
      camHold: false,
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
      kbdHouse: id,
    });
  };

  /** Klick auf ein Haus in der Welt: wählen bzw. (schon gewählt, keine Tafel) die Auswahl aufheben. */
  const clickHouse = (id: string) => {
    const s = store.get();
    if (s.nav.level === "haus" && s.nav.h === id && !s.tafel) return clearSelection();
    openHouse(id);
  };

  /** Rasen-Klick bzw. Esc: Sucher, Kacheln und Tafel weg, die Kamera bleibt stehen. */
  const clearSelection = () => {
    const s = store.get();
    if (s.nav.level === "dorf" && !s.tafel) return;
    store.set({
      nav: { level: "dorf" },
      tafel: null,
      camHold: true,
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
    });
  };

  /** Tafel am gewählten Haus öffnen (Kacheln, Liste, Suche); wählt das Haus, falls nötig. */
  const openTafel = (houseId: string, mode: TafelMode, objId: string | null = null) => {
    const s = store.get();
    const tafel: Tafel = { mode, objId, houseId };
    if (s.nav.level === "haus" && s.nav.h === houseId) {
      // Kein angeheftetes Objekt (die 3D-Karte läge über den Kacheln); der Leuchtring zeigt es in der Welt
      store.set({ tafel, pinnedObjId: null });
    } else openHouse(houseId, tafel);
    if (objId && (mode === "objekt" || mode === "objektedit"))
      store.set({ highlight: { kind: "obj", id: objId, t0: performance.now() } });
  };

  /** Tafel ohne Haus (z.B. «Haus anlegen»): rechts angedockt, die Kamera bleibt beim Dorf. */
  const openLooseTafel = (mode: TafelMode) => {
    store.set({ nav: { level: "dorf" }, tafel: { mode }, camHold: false, pinnedObjId: null });
  };

  const closeTafel = () => store.set({ tafel: null, pinnedObjId: null, highlight: null });

  /** Zur Übersicht; fliegt auch dann, wenn die Kamera zuletzt stehen geblieben ist. */
  const goHome = () => {
    const s = store.get();
    store.set({
      nav: { level: "dorf" },
      tafel: null,
      camHold: false,
      flyNonce: s.flyNonce + 1,
      pinnedObjId: null,
      highlight: null,
      hoverObjId: null,
    });
  };

  /** Haus öffnen und ein Objekt zeigen (Suche, Liste, Anschlagbrett, Klick auf ein Objekt). */
  const goToObject = (houseId: string, objId: string | null) => {
    if (objId) openTafel(houseId, "objekt", objId);
    else {
      openHouse(houseId);
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
      // Von innen nach aussen: Tafel, dann Auswahl (Kamera bleibt), dann Quartier → Dorf
      if (s.tafel) {
        closeTafel();
        return true;
      }
      store.set({ kbdHouse: null });
      if (s.nav.level === "haus") clearSelection();
      else up();
      return true;
    }
    return false;
  };

  return {
    openQuarter,
    openHouse,
    clickHouse,
    clearSelection,
    openTafel,
    openLooseTafel,
    closeTafel,
    goHome,
    goToObject,
    up,
    setView,
    onKey,
    zentraleId,
  };
}

export type SceneActions = ReturnType<typeof makeActions>;

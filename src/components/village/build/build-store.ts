import { useSyncExternalStore } from "react";
import type { DekoTyp } from "@/lib/world/catalog";
import {
  addDeko,
  commit,
  dekoLabel,
  dekoLeft,
  draftFromDoc,
  EMPTY_DRAFT,
  ghostAt,
  nextDekoId,
  pinHouse,
  redo,
  removeDeko,
  replaceDeko,
  setVariante,
  startHistory,
  undo,
  type BuildHistory,
  type Draft,
  type Ghost,
} from "@/lib/world/build";
import type { Variante, WorldDoc } from "@/lib/world/doc";
import type { World } from "@/lib/world/generate";
import { pointShapeDist } from "@/lib/world/geom";
import { dekoShape } from "@/lib/world/rules";
import { freeSlots, plotShape, quarterName } from "@/lib/world/settlement";

/** Zustand des Bau-Modus (nur der Besitzer im eigenen Dorf). */
/** Freier Bauplatz für ein Haus (Gasse, Platz, Lage). */
export type HouseSlot = { dir: number; key: string; x: number; z: number; angle: number };

export type BuildState = {
  active: boolean;
  history: BuildHistory;
  /** Gewähltes Element aus dem Katalog: jeder Klick setzt eines. */
  tool: DekoTyp | null;
  /** Drehung für neue Elemente (Grad, 15°-Schritte). */
  rot: number;
  /** Gewähltes Deko-Element (Id) oder Haus (Varianten). */
  selected: string | null;
  house: string | null;
  /** Gewähltes Element wird gerade versetzt (folgt dem Zeiger bis zum Klick). */
  moving: boolean;
  /** Haus umsetzen: freie Bauplätze im eigenen Quartier (Klick oder Knopf wählt einen). */
  houseSlots: HouseSlot[] | null;
  /** Vorschau unter dem Zeiger. */
  ghost: Ghost | null;
  /** Tastatur-Cursor für neue Elemente (Pfeiltasten bewegen ihn, Enter setzt). */
  cursor: { x: number; z: number };
  /** Letzte Ansage (Bildschirmleser und Hinweiszeile). */
  message: string;
  saving: boolean;
  error: string | null;
};

const initial = (doc: WorldDoc): BuildState => ({
  active: false,
  history: startHistory(draftFromDoc(doc)),
  tool: null,
  rot: 0,
  selected: null,
  house: null,
  moving: false,
  houseSlots: null,
  ghost: null,
  cursor: { x: 0, z: 0 },
  message: "",
  saving: false,
  error: null,
});

export type BuildStore = ReturnType<typeof createBuildStore>;

/**
 * Bau-Modus: Entwurf mit Rückgängig, Live-Prüfung unter dem Zeiger, Auswahl per Klick. Die Welt für die
 * Prüfung kommt von aussen (`setWorld`), sie wird nach jeder Änderung des Entwurfs neu gerechnet.
 */
export function createBuildStore(doc: WorldDoc) {
  let state = initial(doc);
  let world: World | null = null;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<BuildState>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  const change = (next: Draft, message: string, extra: Partial<BuildState> = {}) =>
    set({ history: commit(state.history, next), message, error: null, ...extra });

  const selectedItem = () => state.history.present.deko.find((d) => d.id === state.selected);

  /** Prüft das Element an (x, z): neues Element des Werkzeugs oder das gerade versetzte. */
  const probe = (x: number, z: number): Ghost | null => {
    if (!world) return null;
    if (state.tool) {
      return ghostAt(world.editSpace, { id: "neu", typ: state.tool, x, z, r: state.rot });
    }
    const it = state.moving ? selectedItem() : undefined;
    return it ? ghostAt(world.editSpace, { ...it, x, z }) : null;
  };

  const build = {
    get: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setWorld: (w: World) => {
      world = w;
      // Neue Entwurfswelt (z.B. nach dem Setzen): Vorschau am Cursor neu prüfen
      if (state.active && (state.tool || state.moving))
        set({ ghost: probe(state.cursor.x, state.cursor.z) });
    },
    start: (d: WorldDoc) =>
      set({
        ...initial(d),
        // Heutige Lage aller Quartiere und Häuser fixieren: im Bau-Modus bewegt sich nur, was man selbst bewegt
        history: startHistory(draftFromDoc(d, world?.settlement)),
        active: true,
        message: "Bau-Modus: wähle ein Element oder klicke auf Deko oder ein Haus.",
      }),
    stop: () =>
      set({
        active: false,
        tool: null,
        ghost: null,
        selected: null,
        house: null,
        moving: false,
        houseSlots: null,
      }),
    dirty: () => state.history.past.length > 0,
    chooseTool: (tool: DekoTyp | null) => {
      if (tool && dekoLeft(state.history.present) <= 0) {
        set({ message: "Höchstens 120 eigene Elemente. Entferne zuerst etwas.", tool: null });
        return;
      }
      set({
        tool,
        selected: null,
        house: null,
        moving: false,
        ghost: null,
        message: tool
          ? `${dekoLabel(tool)}: klicke auf die Wiese oder setze es mit Enter (Pfeile verschieben, Q/E drehen).`
          : "",
      });
    },
    hover: (x: number, z: number) => set({ ghost: probe(x, z), cursor: { x, z } }),
    /** Cursor setzen (z.B. Blickziel der Kamera beim Wählen eines Werkzeugs), Vorschau dort zeigen. */
    setCursor: (x: number, z: number) => {
      // Erste gültige Stelle in der Nähe (Spirale bis 18 m), damit die Vorschau sofort sichtbar und setzbar ist
      for (let r = 0; r <= 18; r += 1.5)
        for (let k = 0; k < (r ? 12 : 1); k++) {
          const a = (k / 12) * Math.PI * 2;
          const g = probe(x + Math.sin(a) * r, z + Math.cos(a) * r);
          if (g?.ok) return set({ cursor: { x: g.item.x, z: g.item.z }, ghost: g });
        }
      set({ cursor: { x, z }, ghost: probe(x, z) });
    },
    leave: () => set({ ghost: null }),
    /** Klick auf den Boden: setzen, versetzen oder auswählen. */
    click: (x: number, z: number) => {
      if (state.tool) {
        const g = probe(x, z);
        if (!g) return;
        if (!g.ok) return set({ ghost: g, message: `Hier nicht möglich: ${g.grund}` });
        const item = { ...g.item, id: nextDekoId(state.history.present.deko) };
        change(
          addDeko(state.history.present, item),
          `${dekoLabel(item.typ)} gesetzt${g.snapped ? " (eingerastet)" : ""}.`,
        );
        if (dekoLeft(state.history.present) <= 0) set({ tool: null, ghost: null });
        return;
      }
      if (state.houseSlots) {
        const slot = state.houseSlots.find(
          (sl) => pointShapeDist(x, z, plotShape(sl.x, sl.z, sl.angle)) <= 0,
        );
        if (slot) build.placeHouse(slot);
        else set({ houseSlots: null, message: "Umsetzen abgebrochen." });
        return;
      }
      if (state.moving) {
        const g = probe(x, z);
        if (!g) return;
        if (!g.ok) return set({ ghost: g, message: `Hier nicht möglich: ${g.grund}` });
        change(replaceDeko(state.history.present, g.item), `${dekoLabel(g.item.typ)} versetzt.`, {
          moving: false,
          ghost: null,
        });
        return;
      }
      // Auswahl: nächstes Deko-Element unter dem Zeiger, sonst ein Haus
      const deko = state.history.present.deko
        .map((d) => ({ d, dist: pointShapeDist(x, z, dekoShape(d)) }))
        .filter((e) => e.dist <= 0.3)
        .sort((a, b) => a.dist - b.dist)[0];
      if (deko) {
        return set({
          selected: deko.d.id,
          house: null,
          message: `${dekoLabel(deko.d.typ)} ausgewählt. Pfeiltasten verschieben, Q/E drehen, Entf entfernt.`,
        });
      }
      const house = world
        ? Object.values(world.settlement.houses).find(
            (h) => pointShapeDist(x, z, plotShape(h.x, h.z, h.angle)) <= 0,
          )
        : undefined;
      if (house)
        return set({
          house: house.id,
          selected: null,
          message: "Haus ausgewählt: Farbe, Dach, Anbau und Garten.",
        });
      set({ selected: null, house: null, message: "" });
    },
    /** Gewähltes Element verschieben (Meter) oder drehen (Grad); nur gültige Lagen werden übernommen. */
    nudge: (dx: number, dz: number, dr = 0) => {
      if (state.tool && dr) {
        set({ rot: (((state.rot + dr) % 360) + 360) % 360 });
        return set({ ghost: probe(state.cursor.x, state.cursor.z) });
      }
      const it = selectedItem();
      if (!it || !world) return;
      const g = ghostAt(world.editSpace, { ...it, x: it.x + dx, z: it.z + dz, r: it.r + dr });
      if (!g.ok) return set({ message: `Hier nicht möglich: ${g.grund}` });
      change(replaceDeko(state.history.present, g.item), dr ? "Gedreht." : "Verschoben.");
    },
    /** Pfeiltasten: Werkzeug → Cursor bewegen; gewähltes Element → verschieben. */
    arrow: (dx: number, dz: number) => {
      if (state.tool || state.moving) {
        const c = { x: state.cursor.x + dx, z: state.cursor.z + dz };
        set({ cursor: c, ghost: probe(c.x, c.z) });
        return;
      }
      if (selectedItem()) build.nudge(dx, dz);
    },
    /** Enter: am Cursor setzen bzw. versetzen. */
    enter: () => {
      if (state.tool || state.moving) build.click(state.cursor.x, state.cursor.z);
    },
    startMove: () => {
      const it = selectedItem();
      if (it)
        set({
          moving: true,
          cursor: { x: it.x, z: it.z },
          message: "Klicke dorthin, wo das Element hin soll (oder Pfeiltasten und Enter).",
        });
    },
    remove: () => {
      const it = selectedItem();
      if (!it) return;
      change(removeDeko(state.history.present, it.id), `${dekoLabel(it.typ)} entfernt.`, {
        selected: null,
        moving: false,
      });
    },
    variante: (houseId: string, patch: Partial<Variante>) =>
      change(setVariante(state.history.present, houseId, patch), "Haus angepasst."),
    resetAll: () =>
      change(
        EMPTY_DRAFT,
        "Alles wieder automatisch: eigene Deko, Varianten und Hausplätze entfernt (rückgängig möglich).",
        { selected: null, house: null, houseSlots: null },
      ),
    /** Haus wählen (Tastatur, Liste in der Werkzeugleiste). */
    selectHouse: (id: string | null) =>
      set({
        house: id,
        selected: null,
        tool: null,
        ghost: null,
        moving: false,
        houseSlots: null,
        message: id ? "Haus ausgewählt: Farbe, Dach, Anbau und Garten." : "",
      }),
    /** Freie Bauplätze für das gewählte Haus zeigen (nur im eigenen Quartier, höchstens 8). */
    showHouseSlots: () => {
      const id = state.house;
      if (!world || !id) return;
      const h = world.settlement.houses[id];
      const q = world.layout.houses[id]?.quarterId;
      if (!h || !q) return;
      const slots = freeSlots(world.seed, world.editSpace, world.settlement, q).slice(0, 8);
      set({
        houseSlots: slots,
        message: slots.length
          ? `${slots.length} freie Plätze in «${quarterName(q)}»: klicke einen an.`
          : "Im Quartier ist gerade kein anderer Platz frei.",
      });
    },
    /** Gewähltes Haus auf einen freien Platz setzen. */
    placeHouse: (slot: HouseSlot) => {
      const id = state.house;
      if (!id) return;
      change(pinHouse(state.history.present, id, { r: slot.dir, s: slot.key }), "Haus umgesetzt.", {
        houseSlots: null,
      });
    },
    undo: () =>
      set({
        history: undo(state.history),
        message: "Rückgängig.",
        selected: null,
        moving: false,
        houseSlots: null,
      }),
    redo: () =>
      set({
        history: redo(state.history),
        message: "Wiederholt.",
        selected: null,
        moving: false,
        houseSlots: null,
      }),
    escape: () => {
      if (state.houseSlots)
        return (set({ houseSlots: null, message: "Umsetzen abgebrochen." }), true);
      if (state.moving)
        return (set({ moving: false, ghost: null, message: "Versetzen abgebrochen." }), true);
      if (state.tool) return (set({ tool: null, ghost: null, message: "" }), true);
      if (state.selected || state.house)
        return (set({ selected: null, house: null, message: "" }), true);
      return false;
    },
    saving: (saving: boolean, error: string | null = null) => set({ saving, error }),
  };
  return build;
}

export function useBuild<T>(store: BuildStore, select: (s: BuildState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

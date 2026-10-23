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
  moveGroup,
  nextDekoId,
  pinHouse,
  redo,
  removeDeko,
  replaceDeko,
  setVariante,
  startHistory,
  undo,
  unpinHouses,
  type BuildHistory,
  type Draft,
  type Ghost,
} from "@/lib/world/build";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { DekoItem, Variante, WorldDoc } from "@/lib/world/doc";
import {
  dragBase,
  groupGhost,
  houseGhost,
  quarterDeko,
  type DragBase,
  type GroupGhost,
  type HouseGhost,
} from "@/lib/world/free-drag";
import type { World, WorldInput } from "@/lib/world/generate";
import { pointShapeDist } from "@/lib/world/geom";
import { dekoShape } from "@/lib/world/rules";
import { freeSlots, NODE_RP, plotShape, quarterName } from "@/lib/world/settlement";

/** Zustand des Bau-Modus (nur der Besitzer im eigenen Dorf). */
/** Freier Bauplatz für ein Haus (Gasse, Platz, Lage). */
export type HouseSlot = { dir: number; key: string; x: number; z: number; angle: number };

/** Haus frei ziehen oder Quartier verschieben (Generator v2): Vorschau folgt Zeiger oder Pfeiltasten. */
export type DragState =
  | { kind: "haus"; id: string; ghost: HouseGhost }
  | {
      kind: "quartier";
      quarterId: FachbereichId;
      /** Griff (Quartierplatz): Verschiebung = Zeiger − Griff. */
      anchor: { x: number; z: number };
      members: { id: string; x: number; z: number }[];
      deko: DekoItem[];
      ghost: GroupGhost;
    };

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
  /** Gewähltes Quartier (Griff am Quartierplatz): verschieben oder zurück auf Automatik. */
  quarter: FachbereichId | null;
  /** Haus umsetzen (v1): freie Bauplätze im eigenen Quartier (Klick oder Knopf wählt einen). */
  houseSlots: HouseSlot[] | null;
  /** Haus oder Quartier wird gerade gezogen (v2). */
  drag: DragState | null;
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
  quarter: null,
  moving: false,
  houseSlots: null,
  drag: null,
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
  let input: WorldInput | null = null;
  let titles: Record<string, { title: string }> = {};
  /** Prüfwelt des laufenden Ziehens (ohne die gezogenen Häuser). */
  let base: DragBase | null = null;
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

  /** Vorschau beim Ziehen an (x, z). */
  const dragAt = (d: DragState, x: number, z: number): DragState => {
    if (!base) return d;
    if (d.kind === "haus") return { ...d, ghost: houseGhost(base, d.id, x, z) };
    const label = (id: string) =>
      titles[id] ? `«${titles[id].title}»` : d.deko.some((x) => x.id === id) ? "Deko" : "Haus";
    return {
      ...d,
      ghost: groupGhost(base, d.members, d.deko, x - d.anchor.x, z - d.anchor.z, label),
    };
  };
  const dragMessage = (d: DragState) => {
    if (d.kind === "haus")
      return d.ghost.ok
        ? d.ghost.snapped
          ? "Passt (eingerastet)."
          : "Passt."
        : `Hier nicht möglich: ${d.ghost.grund}`;
    if (d.ghost.state === "ok") return "Passt.";
    if (d.ghost.state === "grenze") return `Nur bis hier: ${d.ghost.grund}`;
    return `Hier nicht möglich: ${d.ghost.grund}`;
  };
  const isV2 = () => world?.map.version === 2;

  const build = {
    get: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setWorld: (w: World, i: WorldInput, t: Record<string, { title: string }> = {}) => {
      world = w;
      input = i;
      titles = t;
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
    stop: () => {
      base = null;
      set({
        active: false,
        tool: null,
        ghost: null,
        selected: null,
        house: null,
        quarter: null,
        moving: false,
        houseSlots: null,
        drag: null,
      });
    },
    dirty: () => state.history.past.length > 0,
    chooseTool: (tool: DekoTyp | null) => {
      if (tool && dekoLeft(state.history.present) <= 0) {
        set({ message: "Höchstens 120 eigene Elemente. Entferne zuerst etwas.", tool: null });
        return;
      }
      base = null;
      set({
        tool,
        selected: null,
        house: null,
        quarter: null,
        moving: false,
        drag: null,
        ghost: null,
        message: tool
          ? `${dekoLabel(tool)}: klicke auf die Wiese oder setze es mit Enter (Pfeile verschieben, Q/E drehen).`
          : "",
      });
    },
    hover: (x: number, z: number) => {
      if (state.drag) return set({ drag: dragAt(state.drag, x, z), cursor: { x, z } });
      set({ ghost: probe(x, z), cursor: { x, z } });
    },
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
    /** Klick auf den Boden: setzen, versetzen, ablegen oder auswählen. */
    click: (x: number, z: number) => {
      if (state.drag) return build.drop(x, z);
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
          quarter: null,
          message: isV2()
            ? "Haus ausgewählt: ziehen zum Verschieben, oder Farbe, Dach, Anbau und Garten wählen."
            : "Haus ausgewählt: Farbe, Dach, Anbau und Garten.",
        });
      // Griff am Quartierplatz: Quartier wählen
      const node = world?.settlement.nodes.find((n) => Math.hypot(n.x - x, n.z - z) <= NODE_RP);
      if (node) return build.selectQuarter(node.quarterId);
      set({ selected: null, house: null, quarter: null, message: "" });
    },
    /** Quartier wählen (Griff am Quartierplatz oder Liste). */
    selectQuarter: (q: FachbereichId | null) => {
      base = null;
      set({
        quarter: q,
        house: null,
        selected: null,
        tool: null,
        ghost: null,
        moving: false,
        houseSlots: null,
        drag: null,
        message: q
          ? isV2()
            ? `Quartier «${quarterName(q)}» ausgewählt: ziehe den Griff, um alle Häuser gemeinsam zu verschieben.`
            : `Quartier «${quarterName(q)}» ausgewählt.`
          : "",
      });
    },
    /** Haus frei ziehen beginnen (v2): Vorschau an der heutigen Lage. */
    startHouseDrag: (id = state.house) => {
      if (!world || !input || !id || !isV2()) return false;
      const h = world.settlement.houses[id];
      if (!h) return false;
      base = dragBase(input, world, h.quarterId, new Set([id]));
      const drag = dragAt(
        { kind: "haus", id, ghost: { ok: false, x: h.x, z: h.z, angle: h.angle, grund: "" } },
        h.x,
        h.z,
      );
      set({
        drag,
        house: id,
        quarter: null,
        selected: null,
        tool: null,
        ghost: null,
        houseSlots: null,
        cursor: { x: h.x, z: h.z },
        message:
          "Haus verschieben: ziehen und loslassen (oder Pfeiltasten und Enter, Esc bricht ab).",
      });
      return true;
    },
    /** Quartier als Gruppe verschieben beginnen (v2): Griff am Quartierplatz. */
    startGroupDrag: (q = state.quarter) => {
      if (!world || !input || !q || !isV2()) return false;
      const node = world.settlement.nodes.find((n) => n.quarterId === q);
      const members = Object.values(world.settlement.houses)
        .filter((h) => h.quarterId === q)
        .map((h) => ({ id: h.id, x: h.x, z: h.z }));
      if (!node || !members.length) {
        set({ message: "Dieses Quartier hat noch keine Häuser." });
        return false;
      }
      const deko = quarterDeko(world, q);
      base = dragBase(
        input,
        world,
        q,
        new Set(members.map((m) => m.id)),
        new Set(deko.map((d) => d.id)),
      );
      const anchor = { x: node.x, z: node.z };
      const first: DragState = {
        kind: "quartier",
        quarterId: q,
        anchor,
        members,
        deko,
        ghost: { dx: 0, dz: 0, state: "ok", poses: {}, deko },
      };
      set({
        drag: dragAt(first, anchor.x, anchor.z),
        quarter: q,
        house: null,
        selected: null,
        tool: null,
        ghost: null,
        houseSlots: null,
        cursor: anchor,
        message: `Quartier «${quarterName(q)}» verschieben: Griff ziehen und loslassen (oder Pfeiltasten und Enter, Esc bricht ab).`,
      });
      return true;
    },
    /** Gezogenes Haus oder Quartier ablegen (nur gültige Lagen werden übernommen). */
    drop: (x: number, z: number) => {
      const d0 = state.drag;
      if (!d0) return;
      const d = dragAt(d0, x, z);
      if (d.kind === "haus") {
        if (!d.ghost.ok) return set({ drag: d, message: `Hier nicht möglich: ${d.ghost.grund}` });
        base = null;
        change(
          pinHouse(state.history.present, d.id, { r: d.ghost.dir, x: d.ghost.x, z: d.ghost.z }),
          `Haus verschoben${d.ghost.snapped ? " (eingerastet)" : ""}.`,
          { drag: null },
        );
        return;
      }
      if (d.ghost.state === "nein")
        return set({ drag: d, message: `Hier nicht möglich: ${d.ghost.grund}` });
      base = null;
      if (d.ghost.dx === 0 && d.ghost.dz === 0)
        return set({ drag: null, message: "Quartier bleibt, wo es ist." });
      change(
        moveGroup(state.history.present, d.ghost.poses, d.ghost.deko),
        d.ghost.state === "grenze"
          ? `Quartier verschoben, bis zur Grenze (${d.ghost.grund}).`
          : "Quartier verschoben.",
        { drag: null },
      );
    },
    /** «Zurück auf Automatik»: gewähltes Haus oder alle Häuser des gewählten Quartiers. */
    unpin: () => {
      if (!world) return;
      if (state.house) {
        change(
          unpinHouses(state.history.present, [state.house]),
          "Haus wieder automatisch platziert (rückgängig möglich).",
          { drag: null },
        );
        return;
      }
      const q = state.quarter;
      if (!q) return;
      const ids = Object.values(world.settlement.houses)
        .filter((h) => h.quarterId === q)
        .map((h) => h.id);
      change(
        unpinHouses(state.history.present, ids),
        `Quartier «${quarterName(q)}» wieder automatisch (rückgängig möglich).`,
        { drag: null },
      );
    },
    /** Gewähltes Element verschieben (Meter) oder drehen (Grad); nur gültige Lagen werden übernommen. */
    nudge: (dx: number, dz: number, dr = 0) => {
      if (state.drag && dr) return set({ message: "Häuser drehen sich von selbst zu ihrem Weg." });
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
      if (state.drag) {
        const c = { x: state.cursor.x + dx, z: state.cursor.z + dz };
        const d = dragAt(state.drag, c.x, c.z);
        return set({ cursor: c, drag: d, message: dragMessage(d) });
      }
      if (state.tool || state.moving) {
        const c = { x: state.cursor.x + dx, z: state.cursor.z + dz };
        set({ cursor: c, ghost: probe(c.x, c.z) });
        return;
      }
      if (selectedItem()) build.nudge(dx, dz);
    },
    /** Enter: am Cursor setzen bzw. versetzen. */
    enter: () => {
      if (state.drag) return build.drop(state.cursor.x, state.cursor.z);
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
        { selected: null, house: null, quarter: null, houseSlots: null, drag: null },
      ),
    /** Haus wählen (Tastatur, Liste in der Werkzeugleiste). */
    selectHouse: (id: string | null) => {
      base = null;
      set({
        house: id,
        quarter: null,
        selected: null,
        tool: null,
        ghost: null,
        moving: false,
        houseSlots: null,
        drag: null,
        message: id ? "Haus ausgewählt: Farbe, Dach, Anbau und Garten." : "",
      });
    },
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
    undo: () => {
      base = null;
      set({
        history: undo(state.history),
        message: "Rückgängig.",
        selected: null,
        moving: false,
        houseSlots: null,
        drag: null,
      });
    },
    redo: () => {
      base = null;
      set({
        history: redo(state.history),
        message: "Wiederholt.",
        selected: null,
        moving: false,
        houseSlots: null,
        drag: null,
      });
    },
    escape: () => {
      if (state.drag) {
        base = null;
        return (
          set({
            drag: null,
            message:
              state.drag.kind === "haus"
                ? "Verschieben abgebrochen."
                : "Quartier bleibt, wo es ist.",
          }),
          true
        );
      }
      if (state.houseSlots)
        return (set({ houseSlots: null, message: "Umsetzen abgebrochen." }), true);
      if (state.moving)
        return (set({ moving: false, ghost: null, message: "Versetzen abgebrochen." }), true);
      if (state.tool) return (set({ tool: null, ghost: null, message: "" }), true);
      if (state.selected || state.house || state.quarter)
        return (set({ selected: null, house: null, quarter: null, message: "" }), true);
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

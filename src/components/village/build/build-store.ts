import { useSyncExternalStore } from "react";
import { FACHBEREICHE, type FachbereichId } from "@/lib/fachbereiche";
import type { DekoTyp } from "@/lib/world/catalog";
import {
  addDeko,
  commit,
  dekoLabel,
  dekoLeft,
  draftDoc,
  draftFromDoc,
  EMPTY_DRAFT,
  ghostAt,
  moveGroup,
  moveTree,
  nextDekoId,
  pinHouse,
  redo,
  removeDeko,
  replaceDeko,
  setBend,
  setRoad,
  setVariante,
  startHistory,
  undo,
  unpinHouses,
  type BuildHistory,
  type Draft,
  type Ghost,
} from "@/lib/world/build";
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
import { generateWorld, type World, type WorldInput } from "@/lib/world/generate";
import { distPointPolyline, pointShapeDist, type Pt } from "@/lib/world/geom";
import { dekoShape } from "@/lib/world/rules";
import {
  KURVEN,
  RADIUS,
  WEGFORM_LABELS,
  roadCurve,
  roadRadius,
  type QuarterRoad,
  type Wegform,
} from "@/lib/world/roads";
import { freeSlots, NODE_RP, plotShape, quarterName } from "@/lib/world/settlement";
import { treeFits, treeRadius } from "@/lib/world/vegetation";

/** Zustand des Bau-Modus (nur der Besitzer im eigenen Dorf). */
/** Freier Bauplatz für ein Haus (Gasse, Platz, Lage). */
export type HouseSlot = { dir: number; key: string; x: number; z: number; angle: number };

/** Werkzeuge der Werkzeugleiste (Prototyp 12a). */
export const BAU_WERKZEUGE = ["waehlen", "haus", "quartier", "weg", "deko"] as const;
export type BauWerkzeug = (typeof BAU_WERKZEUGE)[number];
export const WERKZEUG_LABELS: Record<BauWerkzeug, string> = {
  waehlen: "Wählen",
  haus: "Haus",
  quartier: "Quartier",
  weg: "Weg",
  deko: "Deko",
};
const WERKZEUG_HINWEIS: Record<BauWerkzeug, string> = {
  waehlen: "Haus oder Griff anklicken",
  haus: "Haus ziehen zum Versetzen",
  quartier: "Haus oder runden Griff ziehen, um ein Quartier zu verschieben",
  weg: "Auf einen Stichweg klicken setzt einen Eckpunkt",
  deko: "Bäume ziehen zum Versetzen",
};

/** Haus frei ziehen oder Quartier verschieben (Generator v2): Vorschau folgt Zeiger oder Pfeiltasten. */
export type DragState =
  | { kind: "haus"; id: string; ghost: HouseGhost }
  | {
      kind: "quartier";
      quarterId: FachbereichId;
      /** Griff (Quartierplatz oder gezogenes Haus): Verschiebung = Zeiger − Griff. */
      anchor: { x: number; z: number };
      members: { id: string; x: number; z: number }[];
      deko: DekoItem[];
      ghost: GroupGhost;
    };

/** v3: Baum oder Eckpunkt wird gezogen. */
export type PointDrag =
  | { kind: "baum"; i: number; x: number; z: number; ok: boolean }
  | { kind: "eckpunkt"; houseId: string; x: number; z: number };

export type BuildState = {
  active: boolean;
  history: BuildHistory;
  /** Werkzeug der Leiste links. */
  btool: BauWerkzeug;
  /** Gewähltes Element aus dem Katalog (eigene Deko): jeder Klick setzt eines. */
  tool: DekoTyp | null;
  /** Drehung für neue Elemente (Grad, 15°-Schritte). */
  rot: number;
  /** Gewähltes Deko-Element (Id) oder Haus (Varianten). */
  selected: string | null;
  house: string | null;
  /** Gewähltes Element wird gerade versetzt (folgt dem Zeiger bis zum Klick). */
  moving: boolean;
  /** Gewähltes Quartier (auch beim gewählten Haus: sein Quartier). */
  quarter: FachbereichId | null;
  /** Haus umsetzen (v1): freie Bauplätze im eigenen Quartier (Klick oder Knopf wählt einen). */
  houseSlots: HouseSlot[] | null;
  /** Haus oder Quartier wird gerade gezogen (v2). */
  drag: DragState | null;
  /** v3: Baum oder Eckpunkt wird gezogen. */
  point: PointDrag | null;
  /** Vorschau unter dem Zeiger. */
  ghost: Ghost | null;
  /** Tastatur-Cursor für neue Elemente (Pfeiltasten bewegen ihn, Enter setzt). */
  cursor: { x: number; z: number };
  /** Letzte Ansage (Bildschirmleser und Hinweiszeile); `bad` = Fehler (rot). */
  message: string;
  bad: boolean;
  saving: boolean;
  error: string | null;
};

const initial = (doc: WorldDoc): BuildState => ({
  active: false,
  history: startHistory(draftFromDoc(doc)),
  btool: "waehlen",
  tool: null,
  rot: 0,
  selected: null,
  house: null,
  quarter: null,
  moving: false,
  houseSlots: null,
  drag: null,
  point: null,
  ghost: null,
  cursor: { x: 0, z: 0 },
  message: "",
  bad: false,
  saving: false,
  error: null,
});

export type BuildStore = ReturnType<typeof createBuildStore>;

/** Beschriftung einer Wegform samt Radius bzw. Krümmung. */
export function roadText(road: QuarterRoad): string {
  if (road.form === "ring" || road.form === "halbkreis")
    return `${WEGFORM_LABELS[road.form]} (Radius ${roadRadius(road)} m)`;
  if (road.form === "intelligent")
    return `${WEGFORM_LABELS[road.form]} (${KURVEN[roadCurve(road)]})`;
  return WEGFORM_LABELS.gasse;
}

/**
 * Bau-Modus: Entwurf mit Rückgängig, Live-Prüfung unter dem Zeiger, Auswahl per Klick. Die Welt für die
 * Prüfung kommt von aussen (`setWorld`), sie wird nach jeder Änderung des Entwurfs neu gerechnet. Wegformen,
 * Eckpunkte und versetzte Bäume prüft der Store vor dem Übernehmen an einer Probewelt (gleiche Regeln wie
 * Server): Was nicht passt, wird mit Grund zurückgesetzt.
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
    set({ history: commit(state.history, next), message, bad: false, error: null, ...extra });
  const fail = (message: string, extra: Partial<BuildState> = {}) =>
    set({ message, bad: true, ...extra });

  const selectedItem = () => state.history.present.deko.find((d) => d.id === state.selected);
  const name = (id: string) => (titles[id] ? `«${titles[id].title}»` : "ein Haus");
  const housesOf = (q: FachbereichId) =>
    world
      ? Object.values(world.settlement.houses)
          .filter((h) => h.quarterId === q)
          .map((h) => h.id)
      : [];

  /** Probewelt eines Entwurfs (gleiche Rechnung wie Szene und Server). */
  const trial = (d: Draft): World | null =>
    input ? generateWorld({ ...input, lowDetail: true, doc: draftDoc(d) }) : null;

  /**
   * Prüft einen Entwurf an der Probewelt: Fixierungen, die nicht mehr halten, und Häuser ohne Platz sind ein
   * Grund zum Zurücksetzen. Liefert den Grund oder `null`.
   */
  const problem = (w: World, q?: FachbereichId): string | null => {
    if (q && w.settlement.droppedForms.includes(q))
      return "Diese Wegform hat hier keinen Platz (Wasser, Nachbarquartier oder Dorfplatz im Weg).";
    const dropped = w.settlement.droppedPins.filter((id) => !id.includes(":"));
    if (dropped.length) return `Dann hätte ${name(dropped[0])} keinen Platz mehr.`;
    const before = world?.settlement.unplaced.length ?? 0;
    if (w.settlement.unplaced.length > before)
      return `Dann fänden ${w.settlement.unplaced.length - before} Häuser keinen Platz.`;
    return null;
  };

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
    if (d.ghost.state === "ok") return "Quartier verschieben · passt.";
    if (d.ghost.state === "grenze") return `Nur bis hier: ${d.ghost.grund}`;
    return `Hier nicht möglich: ${d.ghost.grund}`;
  };
  const isV2 = () => (world?.map.version ?? 1) >= 2;
  const isV3 = () => (world?.version ?? 1) >= 3;

  /** Baum an (x, z): passt er? (Register nach Häusern, Wegen und Deko, wie beim Erzeugen.) */
  const treeOk = (i: number, x: number, z: number) => {
    const t = world?.vegetation.trees.find((v) => v.i === i);
    if (!world || !t) return false;
    if (!treeFits(world.editSpace, t, x, z)) return false;
    // Nicht in einen anderen Baum
    return !world.vegetation.trees.some(
      (o) =>
        o.i !== i &&
        Math.hypot(o.x - x, o.z - z) < treeRadius(o.kind, o.s) + treeRadius(t.kind, t.s),
    );
  };

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
        message: "Haus ziehen oder Quartier-Griff ziehen",
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
        point: null,
      });
    },
    dirty: () => state.history.past.length > 0,
    /** Werkzeug der Leiste wählen (Auswahl von Haus und Quartier bleibt). */
    setTool: (btool: BauWerkzeug) => {
      base = null;
      set({
        btool,
        tool: null,
        moving: false,
        drag: null,
        point: null,
        ghost: null,
        selected: null,
        houseSlots: null,
        message: WERKZEUG_HINWEIS[btool],
        bad: false,
      });
    },
    chooseTool: (tool: DekoTyp | null) => {
      if (tool && dekoLeft(state.history.present) <= 0) {
        fail("Höchstens 120 eigene Elemente. Entferne zuerst etwas.", { tool: null });
        return;
      }
      base = null;
      set({
        btool: "deko",
        tool,
        selected: null,
        house: null,
        moving: false,
        drag: null,
        ghost: null,
        bad: false,
        message: tool
          ? `${dekoLabel(tool)}: klicke auf die Wiese oder setze es mit Enter (Pfeile verschieben, Q/E drehen).`
          : "",
      });
    },
    hover: (x: number, z: number) => {
      if (state.drag) return set({ drag: dragAt(state.drag, x, z), cursor: { x, z } });
      const p = state.point;
      if (p) {
        if (p.kind === "baum") {
          const ok = treeOk(p.i, x, z);
          return set({
            point: { ...p, x, z, ok },
            message: ok ? "Baum versetzen · passt" : "Nicht auf Haus, Weg oder Baum",
            bad: !ok,
          });
        }
        return set({ point: { ...p, x, z } });
      }
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
        if (!g.ok) return fail(`Hier nicht möglich: ${g.grund}`, { ghost: g });
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
        else set({ houseSlots: null, message: "Umsetzen abgebrochen.", bad: false });
        return;
      }
      if (state.moving) {
        const g = probe(x, z);
        if (!g) return;
        if (!g.ok) return fail(`Hier nicht möglich: ${g.grund}`, { ghost: g });
        change(replaceDeko(state.history.present, g.item), `${dekoLabel(g.item.typ)} versetzt.`, {
          moving: false,
          ghost: null,
        });
        return;
      }
      // Deko-Werkzeug: eigenes Element unter dem Zeiger wählen
      if (state.btool === "deko") {
        const deko = state.history.present.deko
          .map((d) => ({ d, dist: pointShapeDist(x, z, dekoShape(d)) }))
          .filter((e) => e.dist <= 0.3)
          .sort((a, b) => a.dist - b.dist)[0];
        if (deko)
          return set({
            selected: deko.d.id,
            house: null,
            bad: false,
            message: `${dekoLabel(deko.d.typ)} ausgewählt. Pfeiltasten verschieben, Q/E drehen, Entf entfernt.`,
          });
        return set({ selected: null, message: WERKZEUG_HINWEIS.deko, bad: false });
      }
      if (state.btool === "weg") return build.addBendAt(x, z);
      const house = world
        ? Object.values(world.settlement.houses).find(
            (h) => pointShapeDist(x, z, plotShape(h.x, h.z, h.angle)) <= 0,
          )
        : undefined;
      if (house) return build.selectHouse(house.id);
      // Griff am Quartierplatz: Quartier wählen
      const node = world?.settlement.nodes.find((n) => Math.hypot(n.x - x, n.z - z) <= NODE_RP);
      if (node) return build.selectQuarter(node.quarterId);
      set({ selected: null, house: null, quarter: null, message: "", bad: false });
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
        bad: false,
        message: q
          ? isV2()
            ? "Quartier gewählt · Griff ziehen zum Verschieben"
            : `Quartier «${quarterName(q)}» ausgewählt.`
          : "",
      });
    },
    /** Haus wählen (Klick, Liste); sein Quartier wird mitgewählt. */
    selectHouse: (id: string | null) => {
      base = null;
      const q = id && world ? (world.settlement.houses[id]?.quarterId ?? null) : null;
      set({
        house: id,
        quarter: id ? q : state.quarter,
        selected: null,
        tool: null,
        ghost: null,
        moving: false,
        houseSlots: null,
        drag: null,
        bad: false,
        message: id ? (isV2() ? "Haus gewählt · ziehen zum Versetzen" : "Haus gewählt.") : "",
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
        quarter: h.quarterId,
        selected: null,
        tool: null,
        ghost: null,
        houseSlots: null,
        cursor: { x: h.x, z: h.z },
        bad: false,
        message:
          "Haus verschieben: ziehen und loslassen (oder Pfeiltasten und Enter, Esc bricht ab).",
      });
      return true;
    },
    /** Quartier als Gruppe verschieben beginnen (v2): Griff am Quartierplatz oder gezogenes Haus. */
    startGroupDrag: (q = state.quarter, from?: { x: number; z: number }) => {
      if (!world || !input || !q || !isV2()) return false;
      const node = world.settlement.nodes.find((n) => n.quarterId === q);
      const members = Object.values(world.settlement.houses)
        .filter((h) => h.quarterId === q)
        .map((h) => ({ id: h.id, x: h.x, z: h.z }));
      if (!node || !members.length) {
        fail("Dieses Quartier hat noch keine Häuser.");
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
      const anchor = from ?? { x: node.x, z: node.z };
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
        bad: false,
        message: `Quartier «${quarterName(q)}» verschieben: ziehen und loslassen (oder Pfeiltasten und Enter, Esc bricht ab).`,
      });
      return true;
    },
    /** Gezogenes Haus oder Quartier ablegen; an ungültiger Stelle zurückgesetzt mit Grund. */
    drop: (x: number, z: number) => {
      const d0 = state.drag;
      if (!d0) return;
      const d = dragAt(d0, x, z);
      base = null;
      if (d.kind === "haus") {
        if (!d.ghost.ok) return fail(`Zurückgesetzt: ${d.ghost.grund}`, { drag: null });
        change(
          pinHouse(state.history.present, d.id, { r: d.ghost.dir, x: d.ghost.x, z: d.ghost.z }),
          `Abgelegt${d.ghost.snapped ? " (eingerastet)" : ""} · Bäume passen sich an`,
          { drag: null },
        );
        return;
      }
      if (d.ghost.state === "nein") return fail(`Zurückgesetzt: ${d.ghost.grund}`, { drag: null });
      if (d.ghost.dx === 0 && d.ghost.dz === 0)
        return set({ drag: null, message: "Quartier bleibt, wo es ist.", bad: false });
      change(
        moveGroup(state.history.present, d.ghost.poses, d.ghost.deko),
        d.ghost.state === "grenze"
          ? `Quartier verschoben, bis zur Grenze (${d.ghost.grund}).`
          : "Abgelegt · Bäume passen sich an",
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
      change(
        unpinHouses(state.history.present, housesOf(q)),
        `Quartier «${quarterName(q)}» wieder automatisch (rückgängig möglich).`,
        { drag: null },
      );
    },
    /**
     * v3: Wegform, Radius oder Krümmung des gewählten Quartiers ändern. Die Häuser des Quartiers ordnen sich
     * neu; passt das nicht, bleibt alles, wie es war (mit Grund).
     */
    setRoad: (patch: Partial<QuarterRoad>) => {
      const q = state.quarter;
      if (!q || !world || !isV3()) return;
      const cur: QuarterRoad = state.history.present.roads[q] ?? { form: "gasse" };
      const road: QuarterRoad = { ...cur, ...patch };
      const round = road.form === "ring" || road.form === "halbkreis";
      if (round)
        road.radius = Math.max(RADIUS.min, Math.min(RADIUS.max, road.radius ?? RADIUS.start));
      else delete road.radius;
      if (road.form !== "intelligent") delete road.curve;
      // Neue Form ohne gewählten Radius: vom Startwert abwärts den grössten nehmen, der passt
      const radii =
        round && patch.form && patch.radius === undefined
          ? Array.from({ length: road.radius! - RADIUS.min + 1 }, (_, i) => road.radius! - i)
          : [road.radius];
      let why: string | null = null;
      for (const radius of radii) {
        const next: QuarterRoad = round ? { ...road, radius } : road;
        const draft = setRoad(state.history.present, q, next, housesOf(q));
        const w = trial(draft);
        why = w && problem(w, q);
        if (!why)
          return change(draft, `${roadText(next)} · Häuser neu angeordnet`, {
            house: null,
            drag: null,
          });
      }
      fail(`${roadText(road)} geht nicht: ${why}`);
    },
    /** v3: Quartier zurück auf die Gasse und die automatische Anordnung. */
    resetQuarter: () => {
      const q = state.quarter;
      if (!q || !world) return;
      const next = setRoad(state.history.present, q, null, housesOf(q));
      const w = trial(next);
      const why = w && problem(w);
      if (why) return fail(`Zurück auf Ausgangslage geht nicht: ${why}`);
      change(next, `Quartier «${quarterName(q)}» auf Ausgangslage`, { house: null });
    },
    /** v3 Weg-Werkzeug: Eckpunkt auf dem Stichweg unter dem Zeiger setzen und gleich ziehen. */
    addBendAt: (x: number, z: number) => {
      if (!world || !isV3()) return;
      let best: { id: string; d: number } | null = null;
      for (const [id, pts] of Object.entries(world.settlement.spurs)) {
        const d = distPointPolyline(x, z, pts);
        if (d < 1.2 && (!best || d < best.d)) best = { id, d };
      }
      if (!best) return set({ message: WERKZEUG_HINWEIS.weg, bad: false });
      set({
        point: { kind: "eckpunkt", houseId: best.id, x, z },
        house: best.id,
        message: "Eckpunkt gesetzt · ziehen zum Formen",
        bad: false,
      });
    },
    /** v3: bestehenden Eckpunkt ziehen. */
    startBendDrag: (houseId: string) => {
      const b = state.history.present.bends[houseId];
      if (!b) return false;
      set({ point: { kind: "eckpunkt", houseId, ...b }, house: houseId, bad: false });
      return true;
    },
    /** v3: Eckpunkt entfernen (Doppelklick). */
    removeBend: (houseId: string) => {
      if (!state.history.present.bends[houseId]) return;
      change(setBend(state.history.present, houseId, null), "Eckpunkt entfernt", { point: null });
    },
    resetBends: () =>
      change({ ...state.history.present, bends: {} }, "Alle Wege wieder automatisch", {
        point: null,
      }),
    /** v3 Deko-Werkzeug: Baum aus dem Seed ziehen beginnen. */
    startTreeDrag: (i: number) => {
      const t = world?.vegetation.trees.find((v) => v.i === i);
      if (!t) return false;
      set({ point: { kind: "baum", i, x: t.x, z: t.z, ok: true }, bad: false });
      return true;
    },
    resetTrees: () =>
      change({ ...state.history.present, trees: {} }, "Alle Bäume am Seed-Platz", {
        point: null,
      }),
    /** Baum oder Eckpunkt ablegen: an der Probewelt prüfen, sonst zurücksetzen. */
    dropPoint: (x: number, z: number) => {
      const p = state.point;
      if (!p) return;
      if (p.kind === "baum") {
        if (!treeOk(p.i, x, z))
          return fail("Zurückgesetzt: nicht auf Haus, Weg oder Baum", { point: null });
        const next = moveTree(state.history.present, p.i, { x, z });
        const w = trial(next);
        if (w?.invalidTreeMoves.includes(p.i))
          return fail("Zurückgesetzt: Der Baum passt dort nicht.", { point: null });
        return change(next, "Baum versetzt", { point: null });
      }
      const next = setBend(state.history.present, p.houseId, { x, z });
      const w = trial(next);
      if (!w || w.settlement.droppedBends.includes(p.houseId) || problem(w))
        return fail("Zurückgesetzt: Der Weg über diesen Eckpunkt geht nicht.", { point: null });
      change(next, "Weg angepasst", { point: null });
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
      if (!g.ok) return fail(`Hier nicht möglich: ${g.grund}`);
      change(replaceDeko(state.history.present, g.item), dr ? "Gedreht." : "Verschoben.");
    },
    /** Pfeiltasten: Werkzeug → Cursor bewegen; gewähltes Element → verschieben. */
    arrow: (dx: number, dz: number) => {
      if (state.drag) {
        const c = { x: state.cursor.x + dx, z: state.cursor.z + dz };
        const d = dragAt(state.drag, c.x, c.z);
        const msg = dragMessage(d);
        return set({ cursor: c, drag: d, message: msg, bad: !msg.startsWith("Passt") });
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
          bad: false,
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
        "Alles wieder automatisch: eigene Deko, Varianten, Wegformen und Hausplätze entfernt (rückgängig möglich).",
        { selected: null, house: null, quarter: null, houseSlots: null, drag: null, point: null },
      ),
    /** Freie Bauplätze für das gewählte Haus zeigen (v1, nur im eigenen Quartier, höchstens 8). */
    showHouseSlots: () => {
      const id = state.house;
      if (!world || !id) return;
      const h = world.settlement.houses[id];
      const q = world.layout.houses[id]?.quarterId;
      if (!h || !q) return;
      const slots = freeSlots(world.seed, world.editSpace, world.settlement, q).slice(0, 8);
      set({
        houseSlots: slots,
        bad: false,
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
        message: "Rückgängig",
        bad: false,
        selected: null,
        moving: false,
        houseSlots: null,
        drag: null,
        point: null,
      });
    },
    redo: () => {
      base = null;
      set({
        history: redo(state.history),
        message: "Wiederholt",
        bad: false,
        selected: null,
        moving: false,
        houseSlots: null,
        drag: null,
        point: null,
      });
    },
    /** Esc von innen nach aussen: Ziehen, Umsetzen, Versetzen, Katalog, Auswahl. */
    escape: () => {
      if (state.drag || state.point) {
        base = null;
        return (
          set({
            drag: null,
            point: null,
            bad: false,
            message:
              state.drag?.kind === "quartier" ? "Quartier bleibt, wo es ist." : "Abgebrochen.",
          }),
          true
        );
      }
      if (state.houseSlots)
        return (set({ houseSlots: null, message: "Umsetzen abgebrochen.", bad: false }), true);
      if (state.moving)
        return (
          set({ moving: false, ghost: null, message: "Versetzen abgebrochen.", bad: false }),
          true
        );
      if (state.tool) return (set({ tool: null, ghost: null, message: "", bad: false }), true);
      if (state.selected || state.house || state.quarter)
        return (set({ selected: null, house: null, quarter: null, message: "", bad: false }), true);
      return false;
    },
    saving: (saving: boolean, error: string | null = null) => set({ saving, error }),
  };
  return build;
}

/** Farbe eines Quartiers (Datenfarbe des Fachbereichs). */
export const quarterColor = (q: FachbereichId) => FACHBEREICHE[q].style.accent;

export function useBuild<T>(store: BuildStore, select: (s: BuildState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

export type { Pt, Wegform };

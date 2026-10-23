import { DEKO, MAX_DEKO, type DekoTyp } from "./catalog";
import type { DekoItem, Variante, WorldDoc } from "./doc";
import { checkDeko, snapDeko } from "./rules";
import {
  pinsFromSettlement,
  type HousePin,
  type Settlement,
  type SettlementPins,
} from "./settlement";
import type { Space } from "./space";

/**
 * Bau-Modus als reine Logik: Entwurf (eigene Deko und Varianten) mit Rückgängig/Wiederholen, Live-Prüfung
 * einer Platzierung und das Dokument zum Speichern. Dieselben Regeln wie Generator und Server.
 */

/** Entwurf: eigene Deko, Varianten und die Fixierung der Quartiere und Häuser (Grundlage der Entwurfswelt). */
export type Draft = {
  deko: DekoItem[];
  varianten: Record<string, Variante>;
  pins: Required<SettlementPins>;
};
export type BuildHistory = { past: Draft[]; present: Draft; future: Draft[] };

/** Höchstens so viele Schritte zurück. */
const MAX_UNDO = 60;

/**
 * Entwurf aus dem gespeicherten Dokument. Mit `settlement` werden alle heutigen Quartiere und Häuser fixiert:
 * Im Bau-Modus bewegt sich dann nur, was der Besitzer selbst bewegt.
 */
export function draftFromDoc(doc: WorldDoc, settlement?: Settlement): Draft {
  const pins = settlement
    ? pinsFromSettlement(settlement)
    : { quartiere: { ...(doc.quartiere ?? {}) }, haeuser: { ...(doc.haeuser ?? {}) } };
  return { deko: [...(doc.deko ?? [])], varianten: { ...(doc.varianten ?? {}) }, pins };
}

/** Dokument der Entwurfswelt (für die Vorschau in der Szene). */
export const draftDoc = (d: Draft): WorldDoc => ({
  v: 1,
  ...d.pins,
  deko: d.deko,
  varianten: d.varianten,
});

/** Haus auf einen anderen Bauplatz setzen (Gasse `r`, Platz `s`). */
export function pinHouse(d: Draft, houseId: string, pin: HousePin): Draft {
  return { ...d, pins: { ...d.pins, haeuser: { ...d.pins.haeuser, [houseId]: pin } } };
}

/** Alles zurück auf Automatik: keine eigene Deko, keine Varianten, keine Fixierung. */
export const EMPTY_DRAFT: Draft = { deko: [], varianten: {}, pins: { quartiere: {}, haeuser: {} } };

export const startHistory = (draft: Draft): BuildHistory => ({
  past: [],
  present: draft,
  future: [],
});

/** Neuer Stand (wird rückgängig machbar). Gleicher Stand ändert nichts. */
export function commit(h: BuildHistory, next: Draft): BuildHistory {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-MAX_UNDO), present: next, future: [] };
}

export function undo(h: BuildHistory): BuildHistory {
  if (!h.past.length) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

export function redo(h: BuildHistory): BuildHistory {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** Kurze, eindeutige Id für ein neues Element (passt zum Schema `^[a-z0-9-]{1,24}$`). */
export function nextDekoId(deko: readonly DekoItem[]): string {
  let n = deko.length + 1;
  const used = new Set(deko.map((d) => d.id));
  while (used.has(`d${n.toString(36)}`)) n++;
  return `d${n.toString(36)}`;
}

/** Ergebnis der Live-Prüfung: gültig (ggf. eingerastet) oder Grund. */
export type Ghost =
  { ok: true; item: DekoItem; snapped: boolean } | { ok: false; item: DekoItem; grund: string };

/** Auf 0.25 m runden (Raster des Bau-Modus) und Drehung in 15°-Schritte bringen. */
export function normalize(item: DekoItem): DekoItem {
  const r = (((Math.round(item.r / 15) * 15) % 360) + 360) % 360;
  return {
    ...item,
    x: Math.round(item.x * 4) / 4,
    z: Math.round(item.z * 4) / 4,
    r,
  };
}

/**
 * Prüft ein Element an seiner Stelle. Ungültig → in der Nähe einrasten (höchstens 3 m), sonst Grund.
 * `space` enthält die Welt ohne das Element selbst (beim Verschieben: eigene Id in `ignore`).
 */
export function ghostAt(space: Space, raw: DekoItem, ignore?: ReadonlySet<string>): Ghost {
  const item = normalize(raw);
  const c = checkDeko(space, item, ignore);
  if (!c) return { ok: true, item, snapped: false };
  const s = snapDeko(space, item, ignore);
  if (s) return { ok: true, item: s, snapped: true };
  return { ok: false, item, grund: c.grund };
}

/** Wie viele Elemente dürfen noch dazu? */
export const dekoLeft = (d: Draft) => MAX_DEKO - d.deko.length;

export function addDeko(d: Draft, item: DekoItem): Draft {
  if (d.deko.length >= MAX_DEKO) return d;
  return { ...d, deko: [...d.deko, item] };
}

export function replaceDeko(d: Draft, item: DekoItem): Draft {
  return { ...d, deko: d.deko.map((x) => (x.id === item.id ? item : x)) };
}

export function removeDeko(d: Draft, id: string): Draft {
  return { ...d, deko: d.deko.filter((x) => x.id !== id) };
}

/** Variante eines Hauses ändern; leere Varianten werden entfernt (= Automatik). */
export function setVariante(d: Draft, houseId: string, patch: Partial<Variante>): Draft {
  const next: Variante = { ...(d.varianten[houseId] ?? {}), ...patch };
  for (const k of Object.keys(next) as (keyof Variante)[])
    if (next[k] === undefined) delete next[k];
  const varianten = { ...d.varianten };
  if (Object.keys(next).length) varianten[houseId] = next;
  else delete varianten[houseId];
  return { ...d, varianten };
}

/**
 * Dokument zum Speichern: Entwurf plus Fixierung aller heutigen Quartiere und Häuser (sonst könnte eine neue
 * Bank ein automatisch gesetztes Haus verschieben).
 */
export function docForSave(d: Draft, settlement: Settlement): WorldDoc {
  return {
    v: 1,
    ...pinsFromSettlement(settlement),
    deko: d.deko,
    varianten: d.varianten,
  };
}

/** Beschriftung eines Elements für Ansagen («Bank platziert»). */
export const dekoLabel = (typ: DekoTyp) => DEKO[typ].label;

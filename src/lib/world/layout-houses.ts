import { fachbereichOf } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import type { Artifact, House } from "../types";
import type { WorldDoc } from "./doc";

/**
 * Datenbankzeilen → Eingabe des Welt-Generators. Reine Funktionen ohne server-only: Server (Speichern) und
 * Browser (Anzeige, Bau-Modus) müssen aus denselben Zeilen dieselben Häuser in derselben Reihenfolge bilden,
 * sonst rechnen sie verschiedene Welten.
 */

export type HouseRow = Pick<
  House,
  "id" | "kind" | "module_code" | "created_at" | "quarter_override"
> & {
  position_index?: number;
};
export type ArtifactRow = Pick<Artifact, "id" | "house_id" | "kind" | "sort" | "created_at">;
export type OrderedLayoutHouse = LayoutHouse & { order: number };

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Häuser mit Fachbereich, Objekten und Rang (`order`) der Entstehung. Rang = Reihenfolge nach `created_at`
 * (bei gleichem Zeitstempel nach `position_index`, dann nach Id). Objekte stehen in der Reihenfolge `sort`,
 * `created_at`. Die Ausgabe folgt der Reihenfolge der Eingabe; Objekte unbekannter Häuser werden ignoriert.
 */
export function toLayoutHouses(
  houses: readonly HouseRow[],
  artifacts: readonly ArtifactRow[],
): OrderedLayoutHouse[] {
  const rank = new Map(
    [...houses]
      .sort(
        (a, b) =>
          time(a.created_at) - time(b.created_at) ||
          (a.position_index ?? 0) - (b.position_index ?? 0) ||
          byId(a, b),
      )
      .map((h, i) => [h.id, i]),
  );

  const itemsOf = new Map<string, ArtifactRow[]>();
  for (const a of artifacts) {
    const list = itemsOf.get(a.house_id);
    if (list) list.push(a);
    else itemsOf.set(a.house_id, [a]);
  }

  return houses.map((h) => ({
    id: h.id,
    kind: h.kind,
    fach: fachbereichOf(h),
    order: rank.get(h.id)!,
    items: (itemsOf.get(h.id) ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort || time(a.created_at) - time(b.created_at) || byId(a, b))
      .map((a) => ({ id: a.id, kind: a.kind })),
  }));
}

/**
 * Entfernt Fixierungen und Varianten für Häuser, die es im Dorf nicht (mehr) gibt. Der Server speichert nie
 * Einträge zu fremden oder erfundenen Ids; das hält das Dokument ausserdem klein.
 */
export function pruneDoc(doc: WorldDoc, houseIds: ReadonlySet<string>): WorldDoc {
  const keep = <T>(rec: Record<string, T> | undefined) =>
    rec && Object.fromEntries(Object.entries(rec).filter(([id]) => houseIds.has(id)));
  const out: WorldDoc = { v: 1 };
  if (doc.quartiere) out.quartiere = doc.quartiere;
  if (doc.haeuser) out.haeuser = keep(doc.haeuser);
  if (doc.deko) out.deko = doc.deko;
  if (doc.varianten) out.varianten = keep(doc.varianten);
  return out;
}

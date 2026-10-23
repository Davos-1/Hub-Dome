import { FACHBEREICHE, type FachbereichId } from "@/lib/fachbereiche";
import type { ItemType } from "@/lib/item-types";
import type { Artifact } from "@/lib/types";

type FilterHouse = { id: string; kind: string; title: string };
type FilterArtifact = Pick<Artifact, "house_id" | "item_type" | "title" | "description" | "tags">;

/** Das Stück des Dorfmodells, das die Liste braucht (passt auf `VillageModel`). */
type FilterModel<H extends FilterHouse> = {
  houses: H[];
  byId: Record<string, H>;
  layout: { quarters: { id: FachbereichId; houseIds: string[] }[] };
};

export type ListSection<H, A> = {
  key: string;
  title: string;
  houses: { house: H; items: A[] }[];
};

export type ListResult<H, A> = {
  sections: ListSection<H, A>[];
  /** Anzahl angezeigter Objekte. */
  total: number;
  /** Suche oder Typ-Filter ist aktiv. */
  filtering: boolean;
};

/** Alle Häuser nach Quartier, Zentrale zuerst, dann in der Reihenfolge der Welt. */
function quarters<H extends FilterHouse>(
  model: FilterModel<H>,
): { key: string; title: string; houses: H[] }[] {
  const out: { key: string; title: string; houses: H[] }[] = [];
  const zentrale = model.houses.find((h) => h.kind === "zentrale");
  if (zentrale) out.push({ key: "zentrale", title: "Zentrale", houses: [zentrale] });
  for (const q of model.layout.quarters) {
    out.push({
      key: q.id,
      title: FACHBEREICHE[q.id].name,
      houses: q.houseIds.map((id) => model.byId[id]),
    });
  }
  return out;
}

/**
 * Häuser nach Quartier mit den Objekten, die zu Suche und Typ passen. Ohne Suche und Filter erscheinen
 * alle Häuser (auch Baustellen), sonst nur Häuser mit Treffern.
 */
export function filterList<H extends FilterHouse, A extends FilterArtifact>(
  model: FilterModel<H>,
  artifacts: A[],
  query: string,
  type: ItemType | "",
): ListResult<H, A> {
  const q = query.trim().toLowerCase();
  const filtering = Boolean(q || type);

  const byHouse = new Map<string, A[]>();
  for (const a of artifacts) {
    const list = byHouse.get(a.house_id);
    if (list) list.push(a);
    else byHouse.set(a.house_id, [a]);
  }

  function matches(a: A, house: H): boolean {
    if (type && a.item_type !== type) return false;
    if (!q) return true;
    const text = `${a.title} ${a.description ?? ""} ${a.tags.join(" ")} ${house.title}`;
    return text.toLowerCase().includes(q);
  }

  const sections: ListSection<H, A>[] = [];
  let total = 0;
  for (const { key, title, houses } of quarters(model)) {
    const withItems = houses
      .map((house) => ({
        house,
        items: (byHouse.get(house.id) ?? []).filter((a) => matches(a, house)),
      }))
      .filter(({ items }) => !filtering || items.length > 0);
    if (withItems.length === 0) continue;
    total += withItems.reduce((n, { items }) => n + items.length, 0);
    sections.push({ key, title, houses: withItems });
  }

  return { sections, total, filtering };
}

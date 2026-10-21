import { fachbereichOf, houseFachStyle, houseShortCode, type FachbereichId } from "./fachbereiche";
import type { ItemType } from "./item-types";
import { computeLayout, type VillageLayout } from "./layout";
import type { Artifact, ArtifactKind, House } from "./types";

/** Objekte, die jünger als sieben Tage sind, gelten als «neu». */
export const NEW_DAYS = 7;

export function isNew(createdAt: string, now: number): boolean {
  return now - Date.parse(createdAt) < NEW_DAYS * 24 * 3600 * 1000;
}

export type ObjInfo = {
  id: string;
  houseId: string;
  kind: ArtifactKind;
  itemType: ItemType;
  title: string;
  isNew: boolean;
  createdAt: string;
};

export type HouseInfo = {
  id: string;
  kind: House["kind"];
  title: string;
  /** Kürzel für Beschriftungen (z.B. «BAUSTATIK1»). */
  code: string;
  color: string;
  semester: number | null;
  fach: FachbereichId;
  style: ReturnType<typeof houseFachStyle>;
  items: ObjInfo[];
  newCount: number;
};

export type VillageModel = {
  layout: VillageLayout;
  /** Alle Häuser inklusive Zentrale, in der Reihenfolge der Eingabe. */
  houses: HouseInfo[];
  byId: Record<string, HouseInfo>;
  /** Die neuesten Objekte (höchstens fünf) für das Anschlagbrett. */
  notice: ObjInfo[];
};

/** Leitet aus den Datenbankzeilen alles ab, was die 3D-Ansicht zeichnet (Layout, Stil, neue Objekte). */
export function buildVillageModel(
  houses: House[],
  artifacts: Artifact[],
  now: number,
): VillageModel {
  const byHouse: Record<string, ObjInfo[]> = {};
  for (const a of artifacts) {
    (byHouse[a.house_id] ??= []).push({
      id: a.id,
      houseId: a.house_id,
      kind: a.kind,
      itemType: a.item_type,
      title: a.title,
      isNew: isNew(a.created_at, now),
      createdAt: a.created_at,
    });
  }

  const infos: HouseInfo[] = houses.map((h) => {
    const items = byHouse[h.id] ?? [];
    return {
      id: h.id,
      kind: h.kind,
      title: h.title,
      code: houseShortCode(h),
      color: h.color,
      semester: h.semester ?? null,
      fach: fachbereichOf(h),
      style: houseFachStyle(h),
      items,
      newCount: items.filter((i) => i.isNew).length,
    };
  });

  const layout = computeLayout(
    infos.map((h) => ({
      id: h.id,
      kind: h.kind,
      fach: h.fach,
      items: h.items.map((i) => ({ id: i.id, kind: i.kind })),
    })),
  );

  const notice = infos
    .flatMap((h) => h.items)
    .filter((i) => i.isNew)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);

  return { layout, houses: infos, byId: Object.fromEntries(infos.map((h) => [h.id, h])), notice };
}

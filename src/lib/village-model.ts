import { fachbereichOf, houseFachStyle, houseShortCode, type FachbereichId } from "./fachbereiche";
import type { ItemType } from "./item-types";
import type { VillageLayout } from "./layout";
import type { Artifact, ArtifactKind, House } from "./types";
import type { Variante, WorldDoc } from "./world/doc";
import { generateWorld, PLOT_CAPACITY, type World, type WorldInput } from "./world/generate";
import { withVariante } from "./world/kit";
import { toLayoutHouses } from "./world/layout-houses";

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
  /** Übernahme aus einem anderen Dorf (dezente Markierung am Boden). */
  isCopy: boolean;
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
  /** Objekte, die nicht mehr in den Garten passen (Archivschrank «+N»). */
  archived: number;
  /** Baukasten des Besitzers (Farbe, Dach, Anbau, Garten); `undefined` = Automatik. */
  variante?: Variante;
};

/** Welt-Parameter eines Dorfs: Seed, Generator-Version und Platzierungen des Besitzers. */
export type WorldParams = { seed: string; version: number; doc: WorldDoc };

export type VillageModel = {
  layout: VillageLayout;
  /** Die ganze Welt (Karte, Siedlung, Deko, Pflanzen, Laternen). */
  world: World;
  /** Eingabe des Generators (Bau-Modus: Prüfwelt ohne das gezogene Haus). */
  input: WorldInput;
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
  params: WorldParams,
  opts: { lowDetail?: boolean } = {},
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
      isCopy: a.is_copy ?? false,
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
      style: withVariante(houseFachStyle(h), params.doc.varianten?.[h.id]),
      variante: params.doc.varianten?.[h.id],
      items,
      newCount: items.filter((i) => i.isNew).length,
      archived:
        h.kind !== "zentrale" && items.length > PLOT_CAPACITY
          ? items.length - (PLOT_CAPACITY - 1)
          : 0,
    };
  });

  // Gleiche Eingabe wie der Server (Reihenfolge der Entstehung, Objekte nach `sort`): sonst prüft der Server
  // beim Speichern eine andere Welt als die angezeigte
  const input: WorldInput = {
    seed: params.seed,
    version: params.version,
    doc: params.doc,
    lowDetail: opts.lowDetail,
    houses: toLayoutHouses(houses, artifacts),
  };
  const world = generateWorld(input);
  const layout = world.layout;

  const notice = infos
    .flatMap((h) => h.items)
    .filter((i) => i.isNew)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);

  return {
    layout,
    world,
    input,
    houses: infos,
    byId: Object.fromEntries(infos.map((h) => [h.id, h])),
    notice,
  };
}

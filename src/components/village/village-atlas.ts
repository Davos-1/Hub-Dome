import type { VillageModel } from "@/lib/village-model";
import {
  buildAtlas,
  drawBoard,
  drawCard,
  drawChip,
  drawConstruction,
  drawMapLabel,
  drawNotice,
  drawPill,
  drawQuarterBoard,
  type AtlasEntry,
  type Drawing,
} from "./label-atlas";
import type * as THREE from "three";

/** Alle Beschriftungen eines Dorfs in einem Atlas. */
export type VillageAtlas = {
  base: THREE.CanvasTexture;
  size: [number, number];
  chip: Record<string, AtlasEntry>;
  card: Record<string, AtlasEntry>;
  board: Record<string, AtlasEntry>;
  construction: AtlasEntry;
  notice: AtlasEntry;
  quarterBoard: Record<string, AtlasEntry>;
  quarterPill: Record<string, AtlasEntry>;
  zentralePill: AtlasEntry;
  mapHouse: Record<string, AtlasEntry>;
  mapQuarter: Record<string, AtlasEntry>;
  mapZentrale: AtlasEntry;
  dispose: () => void;
};

export function buildVillageAtlas(model: VillageModel, ownerName: string): VillageAtlas {
  const all: Drawing[] = [];
  const reg = (d: Drawing): AtlasEntry => {
    all.push(d);
    return d.entry;
  };
  const chip: VillageAtlas["chip"] = {};
  const card: VillageAtlas["card"] = {};
  const board: VillageAtlas["board"] = {};
  const mapHouse: VillageAtlas["mapHouse"] = {};
  for (const h of model.houses) {
    if (h.kind === "zentrale") continue;
    chip[h.id] = reg(drawChip(h));
    card[h.id] = reg(drawCard(h));
    if (h.items.length > 0) board[h.id] = reg(drawBoard(h));
    mapHouse[h.id] = reg(drawMapLabel(h.code, h.title));
  }
  const quarterBoard: VillageAtlas["quarterBoard"] = {};
  const quarterPill: VillageAtlas["quarterPill"] = {};
  const mapQuarter: VillageAtlas["mapQuarter"] = {};
  for (const q of model.layout.quarters) {
    const codes = q.houseIds.map((id) => model.byId[id].code);
    quarterBoard[q.id] = reg(drawQuarterBoard(q, codes));
    quarterPill[q.id] = reg(drawPill(q.name));
    mapQuarter[q.id] = reg(drawMapLabel(q.name, null));
  }
  const construction = reg(drawConstruction());
  const notice = reg(drawNotice(model.notice.map((o) => ({ o, h: model.byId[o.houseId] }))));
  const zentralePill = reg(drawPill(`${ownerName} · Zentrale`));
  const mapZentrale = reg(drawMapLabel("Zentrale", null));
  const { base, dispose } = buildAtlas(all);
  return {
    base,
    size: [base.image.width, base.image.height],
    chip,
    card,
    board,
    construction,
    notice,
    quarterBoard,
    quarterPill,
    zentralePill,
    mapHouse,
    mapQuarter,
    mapZentrale,
    dispose,
  };
}

import type { ItemType } from "./item-types";
import type { PreviewMeta } from "./previews";

export const ARTIFACT_KINDS = [
  "rechner",
  "quiz",
  "zusammenfassung",
  "cheatsheet",
  "tool",
  "visualisierung",
  "sonstiges",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  rechner: "Rechner",
  quiz: "Quiz",
  zusammenfassung: "Zusammenfassung",
  cheatsheet: "Cheatsheet",
  tool: "Tool",
  visualisierung: "Visualisierung",
  sonstiges: "Sonstiges",
};

export type HouseKind = "zentrale" | "modul" | "thema";

export type Artifact = {
  id: string;
  house_id: string;
  owner_id: string;
  url: string;
  title: string;
  description: string | null;
  kind: ArtifactKind;
  item_type: ItemType;
  meta: PreviewMeta;
  meta_refreshed_at: string | null;
  tags: string[];
  visibility: "shared" | "private";
  sort: number;
  created_at: string;
};

export type House = {
  id: string;
  village_id: string;
  kind: HouseKind;
  title: string;
  module_code: string | null;
  color: string;
  position_index: number;
  created_at: string;
};

export type Village = { id: string; owner_id: string; name: string; theme: string };
export type ModuleOption = { code: string; title: string };

/** Zustand einer Server Action für useActionState. */
export type ActionState = { error?: string; ok?: boolean; inviteUrl?: string };

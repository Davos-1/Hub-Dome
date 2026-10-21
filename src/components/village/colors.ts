import type { ArtifactKind } from "@/lib/types";

/** Farbe des Objekts nach Inhaltskategorie (`kind`). */
export const KIND_COLORS: Record<ArtifactKind, string> = {
  rechner: "#f59e0b",
  quiz: "#ec4899",
  zusammenfassung: "#3b82f6",
  cheatsheet: "#10b981",
  tool: "#8b5cf6",
  visualisierung: "#06b6d4",
  sonstiges: "#9ca3af",
};

/** Stabile Figurfarbe aus `avatar_seed`. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 65%, 55%)`;
}

export { seededRandom } from "@/lib/random";

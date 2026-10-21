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

/** Kleiner deterministischer Zufallsgenerator (mulberry32) für Dekoration. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

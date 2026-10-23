import { z } from "zod";
import { seededRandom } from "../random";

/**
 * Seed einer Welt: 8 Zeichen a–z/0–9. Gleicher Seed + gleiche Daten + gleiche Generator-Version
 * ergeben immer dieselbe Welt. Zufall nur über `rng(seed, strom)`, nie über Math.random.
 */
export const SEED_RE = /^[a-z0-9]{8}$/;
export const seedSchema = z.string().regex(SEED_RE, "Ungültiger Seed.");

/** Aktuelle Version des Generators. Bestehende Welten behalten ihre Version (Annahme A4). */
export const GENERATOR_VERSION = 2;
export const SUPPORTED_VERSIONS = [1, 2] as const;

export const isSeed = (s: unknown): s is string => typeof s === "string" && SEED_RE.test(s);

/** Zufallsfolge für einen benannten Strom (unabhängig voneinander, damit Änderungen nicht durchschlagen). */
export function rng(seed: string, stream: string): () => number {
  return seededRandom(`${seed}:${stream}`);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Neuer Seed aus einer Zufallsquelle (Server: crypto, Tests: deterministisch). */
export function makeSeed(random: () => number): string {
  let s = "";
  for (let i = 0; i < 8; i++)
    s += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
  return s;
}

/** Hilfen für deterministische Auswahl. */
export const pick = <T>(r: () => number, list: readonly T[]): T =>
  list[Math.floor(r() * list.length) % list.length];
export const range = (r: () => number, a: number, b: number) => a + r() * (b - a);

/** Gewichtete Auswahl. */
export function pickWeighted<T>(r: () => number, list: readonly (readonly [T, number])[]): T {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of list) {
    x -= w;
    if (x < 0) return v;
  }
  return list[list.length - 1][0];
}

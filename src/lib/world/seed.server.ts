import "server-only";
import { createHash, randomInt } from "node:crypto";

/**
 * Ersatz-Seed eines Dorfs ohne gespeicherte Welt: die ersten 8 Hex-Zeichen von md5(Dorf-ID).
 * Identisch zu `substr(md5(id::text), 1, 8)` der Migration `village_worlds`, damit beim Einspielen
 * keine Landschaft springt. (`uuid::text` ist in Postgres immer kleingeschrieben.)
 */
export function legacySeed(villageId: string): string {
  return createHash("md5").update(villageId.toLowerCase()).digest("hex").slice(0, 8);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Neuer Zufalls-Seed (8 Zeichen a–z/0–9, `SEED_RE`) aus der kryptografischen Zufallsquelle des Servers. */
export function randomSeed(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

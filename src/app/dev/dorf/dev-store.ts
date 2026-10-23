import "server-only";
import type { WorldDoc } from "@/lib/world/doc";

/**
 * Speicher der Entwickler-Vorschau (nur im laufenden Dev-Server, pro Seed): ersetzt die Datenbank, damit
 * Bau-Modus und Neu-Würfeln ohne Supabase durchgespielt werden können. Überlebt Hot Reload über `globalThis`.
 */
const g = globalThis as unknown as { __hubDomeDevWorlds?: Map<string, WorldDoc> };
const store = (g.__hubDomeDevWorlds ??= new Map());

export const devDoc = (seed: string): WorldDoc | undefined => store.get(seed);
export const setDevDoc = (seed: string, doc: WorldDoc) => store.set(seed, doc);

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FachbereichId } from "../fachbereiche";
import { generateWorld } from "./generate";
import { pruneDoc } from "./layout-houses";
import { relocateDoc, relocationResult } from "./relocate";
import { loadOwnWorld, writeWorld } from "./server-data";

/**
 * Quartier-Umzug auf dem Server vorbereiten: Welt vorher und nachher rechnen (Häuser aus der Datenbank, nicht
 * aus dem Browser) und prüfen, dass das Haus im Zielquartier Platz findet, ohne dass sich etwas anderes bewegt.
 * Gibt eine Funktion zurück, die die Fixierungen schreibt, sobald das Haus selbst geändert ist.
 */
export async function planRelocation(
  supabase: SupabaseClient,
  userId: string,
  houseId: string,
  to: FachbereichId,
): Promise<{ ok: true; commit: () => Promise<boolean> } | { ok: false; error: string }> {
  const own = await loadOwnWorld(supabase, userId);
  if (!own.ok) {
    // Ohne Welt-Tabelle gilt der Ersatz-Seed ohne Fixierungen: Umzug geht, nichts zu schreiben
    if (own.reason === "no-table") return { ok: true, commit: async () => true };
    return { ok: false, error: "Das Dorf konnte nicht geladen werden." };
  }
  const { seed, version, doc: stored } = own.world;
  const before = generateWorld({ seed, version, houses: own.houses, doc: stored });
  const doc = pruneDoc(relocateDoc(before, stored, houseId), new Set(own.houses.map((h) => h.id)));
  const houses = own.houses.map((h) => (h.id === houseId ? { ...h, fach: to } : h));
  const after = generateWorld({ seed, version, houses, doc });
  const res = relocationResult(after, houseId, to);
  if (!res.ok) return { ok: false, error: res.grund };
  if (after.rejected.length)
    return { ok: false, error: "Eigene Deko stünde dem Haus im Weg. Verschiebe sie im Bau-Modus." };
  return {
    ok: true,
    commit: async () => (await writeWorld(own.villageId, userId, { placements: doc })).ok,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Artifact, House } from "./types";

/** Zusatzangaben zu den Objekten eines Dorfs (Phase 5b: Übernehmen, Herkunft, Nutzungszahlen). */
export type ItemExtras = {
  /** Nur für den Besitzer: verschiedene Personen, die geöffnet bzw. übernommen haben. */
  stats: Record<string, { geoeffnet: number; uebernommen: number }>;
  /** Für Besucher: URL → ID des eigenen Objekts mit derselben URL («Schon in deinem Dorf»). */
  copiedByUrl: Record<string, string>;
  /** Herkunft von Übernahmen und eigenen Versionen (Profil-ID → Name). */
  sources: Record<string, { username: string; displayName: string; canVisit: boolean }>;
  /** Für Besucher: eigene Häuser als Ziel fürs Übernehmen. */
  myHouses: House[];
  /** Eigener Benutzername (Link «Ansehen» nach dem Übernehmen). */
  myUsername: string;
};

export const EMPTY_EXTRAS: ItemExtras = {
  stats: {},
  copiedByUrl: {},
  sources: {},
  myHouses: [],
  myUsername: "",
};

export async function loadItemExtras(
  supabase: SupabaseClient,
  me: { id: string; username: string },
  artifacts: Artifact[],
  isOwner: boolean,
): Promise<ItemExtras> {
  const extras: ItemExtras = { ...EMPTY_EXTRAS, myUsername: me.username };
  const sourceIds = [
    ...new Set(artifacts.map((a) => a.source_owner_id).filter((x): x is string => !!x)),
  ];

  const [stats, mine, houses, profiles, villages] = await Promise.all([
    isOwner && artifacts.length
      ? supabase.rpc("item_stats", { p_ids: artifacts.map((a) => a.id) })
      : null,
    !isOwner && artifacts.length
      ? supabase
          .from("artifacts")
          .select("id, url")
          .eq("owner_id", me.id)
          .in("url", [...new Set(artifacts.map((a) => a.url))])
      : null,
    !isOwner
      ? supabase
          .from("houses")
          .select("*, villages!inner(owner_id)")
          .eq("villages.owner_id", me.id)
          .neq("kind", "zentrale")
          .order("position_index")
      : null,
    sourceIds.length
      ? supabase.from("profiles").select("id, username, display_name").in("id", sourceIds)
      : null,
    // RLS liefert nur Dörfer, die man sehen darf
    sourceIds.length ? supabase.from("villages").select("owner_id").in("owner_id", sourceIds) : null,
  ]);

  for (const r of (stats?.data ?? []) as {
    artifact_id: string;
    geoeffnet: number;
    uebernommen: number;
  }[]) {
    extras.stats[r.artifact_id] = { geoeffnet: r.geoeffnet, uebernommen: r.uebernommen };
  }
  for (const r of mine?.data ?? []) extras.copiedByUrl[r.url] = r.id;
  extras.myHouses = ((houses?.data ?? []) as (House & { villages?: unknown })[]).map((r) => {
    const h = { ...r };
    delete h.villages;
    return h;
  });
  const visible = new Set((villages?.data ?? []).map((v) => v.owner_id as string));
  for (const p of profiles?.data ?? []) {
    extras.sources[p.id] = {
      username: p.username,
      displayName: p.display_name,
      canVisit: visible.has(p.id) || p.id === me.id,
    };
  }
  return extras;
}

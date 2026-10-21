import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeRefresh } from "./previews";

/**
 * Lädt die Vorschau eines Objekts bei Bedarf (max. alle 24 h) und speichert sie in `meta`.
 * Läuft mit Service Role, filtert daher immer explizit nach `owner_id`.
 */
export async function refreshArtifactMeta(artifactId: string, ownerId: string) {
  const db = createAdminClient();
  const { data: row } = await db
    .from("artifacts")
    .select("item_type, url, meta, meta_refreshed_at")
    .eq("id", artifactId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!row) return;

  const update = await maybeRefresh(row);
  if (!update) return;
  await db.from("artifacts").update(update).eq("id", artifactId).eq("owner_id", ownerId);
}

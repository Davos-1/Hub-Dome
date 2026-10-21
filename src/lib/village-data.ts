import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireProfile } from "@/lib/auth";
import { needsRefresh } from "@/lib/item-types";
import { refreshArtifactMeta } from "@/lib/previews.server";
import type { Artifact, House, Village } from "@/lib/types";

/**
 * Lädt ein Dorf für die 3D- und 2D-Ansicht. RLS entscheidet über den Zugriff:
 * ohne Besitz oder Freigabe → 404 (verrät nicht, ob das Dorf existiert).
 */
export async function loadVillage(username: string) {
  const { supabase, profile: me } = await requireProfile();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_seed")
    .eq("username", username)
    .maybeSingle();
  if (!owner) notFound();

  const { data: village } = await supabase
    .from("villages")
    .select("id, owner_id, name, theme, house_style, zentrale_style, zentrale_model_meta")
    .eq("owner_id", owner.id)
    .maybeSingle<Village>();
  if (!village) notFound();

  const { data: houseRows } = await supabase
    .from("houses")
    .select("*")
    .eq("village_id", village.id)
    .order("position_index")
    .order("created_at");
  const houses = ((houseRows ?? []) as House[]).sort(
    (a, b) => Number(b.kind === "zentrale") - Number(a.kind === "zentrale"),
  );

  const { data: artifactRows } = await supabase
    .from("artifacts")
    .select("*")
    .in(
      "house_id",
      houses.map((h) => h.id),
    )
    .order("sort")
    .order("created_at");
  const artifacts = (artifactRows ?? []) as Artifact[];

  const isOwner = me.id === owner.id;
  if (isOwner) {
    // Veraltete GitHub-/Gist-Vorschauen (älter als 24 h) nach der Antwort aktualisieren.
    const stale = artifacts
      .filter(
        (a) =>
          (a.item_type === "github_repo" || a.item_type === "gist") &&
          needsRefresh(a.meta_refreshed_at),
      )
      .slice(0, 5);
    if (stale.length) after(() => Promise.all(stale.map((a) => refreshArtifactMeta(a.id, me.id))));
  }

  // Eigenes Zentrale-Modell: kurzlebige signierte URL, nur wenn der Stil es verwendet. RLS auf dem
  // Storage-Objekt entscheidet, ob der Aufrufer es sehen darf.
  let customModelUrl: string | null = null;
  if (village.zentrale_style === "custom" && village.zentrale_model_meta) {
    const { data } = await supabase.storage
      .from("village-models")
      .createSignedUrl(`${village.id}/zentrale.glb`, 600);
    customModelUrl = data?.signedUrl ?? null;
  }

  return { supabase, me, owner, village, houses, artifacts, isOwner, customModelUrl };
}

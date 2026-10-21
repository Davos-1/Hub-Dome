import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleOption, Village } from "@/lib/types";

/** Daten, die die Dialoge der Welt-Shell brauchen (unabhängig davon, welches Dorf gerade gezeigt wird). */

export type ShellVillage = {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  houseCount: number;
  objectCount: number;
  /** Zeitpunkt der letzten Änderung (ISO) oder `null`. */
  last: string | null;
  mine: boolean;
};

export type ShellViewer = {
  viewerId: string;
  grantedAt: string;
  username: string;
  displayName: string;
};

export type ShellInvite = { id: string; expiresAt: string; maxUses: number; uses: number };

/** Nur für das eigene Dorf: Einstellungen, Freigaben, Auswahllisten für Formulare. */
export type ShellOwn = {
  villageId: string;
  zentraleStyle: Village["zentrale_style"];
  modelMeta: Village["zentrale_model_meta"];
  viewers: ShellViewer[];
  invites: ShellInvite[];
  modules: ModuleOption[];
};

export type ShellData = {
  me: { id: string; username: string; displayName: string };
  villages: ShellVillage[];
  own: ShellOwn | null;
};

type VillageRow = {
  id: string;
  name: string;
  owner_id: string;
  owner: { username: string; display_name: string } | null;
  houses: { id: string; kind: string; created_at: string; artifacts: { created_at: string }[] }[];
};

/**
 * Lädt alles für Start-, Reise-, Einstellungs- und Hinzufügen-Dialoge. Läuft mit dem RLS-Client:
 * Dörfer und Freigaben sehen nur, wer sie sehen darf.
 */
export async function loadShell(
  supabase: SupabaseClient,
  profile: { id: string; username: string; display_name: string },
): Promise<ShellData> {
  const [villagesRes, ownRes] = await Promise.all([
    supabase
      .from("villages")
      .select(
        "id, name, owner_id, owner:profiles!villages_owner_id_fkey(username, display_name), houses(id, kind, created_at, artifacts(created_at))",
      )
      .order("created_at"),
    supabase
      .from("villages")
      .select("id, zentrale_style, zentrale_model_meta")
      .eq("owner_id", profile.id)
      .maybeSingle(),
  ]);

  const rows = (villagesRes.data ?? []) as unknown as VillageRow[];
  const villages: ShellVillage[] = rows
    .filter((v) => v.owner)
    .map((v) => {
      const artifacts = v.houses.flatMap((h) => h.artifacts);
      const last = [...artifacts.map((a) => a.created_at), ...v.houses.map((h) => h.created_at)]
        .sort()
        .at(-1);
      return {
        id: v.id,
        name: v.name,
        ownerId: v.owner_id,
        ownerUsername: v.owner!.username,
        ownerName: v.owner!.display_name,
        houseCount: v.houses.filter((h) => h.kind !== "zentrale").length,
        objectCount: artifacts.length,
        last: last ?? null,
        mine: v.owner_id === profile.id,
      };
    })
    // Eigenes Dorf zuerst
    .sort((a, b) => Number(b.mine) - Number(a.mine));

  let own: ShellOwn | null = null;
  const ownVillage = ownRes.data;
  if (ownVillage) {
    const [viewerRes, inviteRes, moduleRes] = await Promise.all([
      supabase
        .from("village_access")
        .select("viewer_id, granted_at, viewer:profiles(username, display_name)")
        .eq("village_id", ownVillage.id)
        .order("granted_at"),
      supabase
        .from("invites")
        .select("id, expires_at, max_uses, uses")
        .eq("village_id", ownVillage.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("module_catalog").select("code, title").order("title"),
    ]);
    const viewers = (viewerRes.data ?? []) as unknown as {
      viewer_id: string;
      granted_at: string;
      viewer: { username: string; display_name: string } | null;
    }[];
    own = {
      villageId: ownVillage.id,
      zentraleStyle: ownVillage.zentrale_style,
      modelMeta: ownVillage.zentrale_model_meta,
      viewers: viewers.map((v) => ({
        viewerId: v.viewer_id,
        grantedAt: v.granted_at,
        username: v.viewer?.username ?? "",
        displayName: v.viewer?.display_name ?? "",
      })),
      invites: (inviteRes.data ?? []).map((i) => ({
        id: i.id,
        expiresAt: i.expires_at,
        maxUses: i.max_uses,
        uses: i.uses,
      })),
      modules: moduleRes.data ?? [],
    };
  }

  return {
    me: { id: profile.id, username: profile.username, displayName: profile.display_name },
    villages,
    own,
  };
}

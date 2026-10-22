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

/** Eine Beziehung zu einer anderen Person: Freund, eingehende oder ausgehende Anfrage. */
export type ShellFriend = {
  friendshipId: string;
  otherId: string;
  username: string;
  displayName: string;
  status: "freund" | "eingehend" | "ausgehend";
  /** Seit wann befreundet bzw. wann angefragt (ISO). */
  since: string;
};

/** Ein von dir erzeugter Freundschaftslink (nur Metadaten, der Klartext ist nicht gespeichert). */
export type ShellLink = { id: string; expiresAt: string; maxUses: number; uses: number };

/** Ein Connector-Token (ohne Klartext und Hash). */
export type ShellToken = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** Nur für das eigene Dorf: Einstellungen und Auswahllisten für Formulare. */
export type ShellOwn = {
  villageId: string;
  zentraleStyle: Village["zentrale_style"];
  modules: ModuleOption[];
};

export type ShellData = {
  me: { id: string; username: string; displayName: string };
  villages: ShellVillage[];
  friends: ShellFriend[];
  links: ShellLink[];
  tokens: ShellToken[];
  own: ShellOwn | null;
};

type VillageRow = {
  id: string;
  name: string;
  owner_id: string;
  owner: { username: string; display_name: string } | null;
  houses: { id: string; kind: string; created_at: string; artifacts: { created_at: string }[] }[];
};

/** Freundschaften und Anfragen der angemeldeten Person (leer, falls die Tabelle noch fehlt). */
async function loadFriends(supabase: SupabaseClient, meId: string): Promise<ShellFriend[]> {
  const { data: rows, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, responded_at")
    .order("created_at");
  if (error || !rows?.length) return [];
  const otherIds = rows.map((r) => (r.requester_id === meId ? r.addressee_id : r.requester_id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", otherIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return rows.flatMap((r) => {
    const otherId = r.requester_id === meId ? r.addressee_id : r.requester_id;
    const p = byId.get(otherId);
    if (!p) return [];
    const status: ShellFriend["status"] =
      r.status === "accepted" ? "freund" : r.requester_id === meId ? "ausgehend" : "eingehend";
    return [
      {
        friendshipId: r.id as string,
        otherId: otherId as string,
        username: p.username as string,
        displayName: p.display_name as string,
        status,
        since: (r.responded_at ?? r.created_at) as string,
      },
    ];
  });
}

/** Eigene, noch gültige Freundschaftslinks (leer, falls die Tabelle noch fehlt). */
async function loadLinks(supabase: SupabaseClient): Promise<ShellLink[]> {
  const { data, error } = await supabase
    .from("friend_links")
    .select("id, expires_at, max_uses, uses")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((l) => ({
    id: l.id as string,
    expiresAt: l.expires_at as string,
    maxUses: l.max_uses as number,
    uses: l.uses as number,
  }));
}

/** Aktive Connector-Tokens der Person (leer, falls die Tabelle fehlt). */
async function loadTokens(supabase: SupabaseClient): Promise<ShellToken[]> {
  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, label, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((t) => ({
    id: t.id as string,
    label: t.label as string,
    createdAt: t.created_at as string,
    lastUsedAt: (t.last_used_at as string | null) ?? null,
  }));
}

/**
 * Lädt alles für Start-, Reise-, Einstellungs- und Hinzufügen-Dialoge. Läuft mit dem RLS-Client:
 * Dörfer und Freundschaften sehen nur die Beteiligten.
 */
export async function loadShell(
  supabase: SupabaseClient,
  profile: { id: string; username: string; display_name: string },
): Promise<ShellData> {
  const [villagesRes, ownRes, friends, links, tokens] = await Promise.all([
    supabase
      .from("villages")
      .select(
        "id, name, owner_id, owner:profiles!villages_owner_id_fkey(username, display_name), houses(id, kind, created_at, artifacts(created_at))",
      )
      .order("created_at"),
    supabase.from("villages").select("id, zentrale_style").eq("owner_id", profile.id).maybeSingle(),
    loadFriends(supabase, profile.id),
    loadLinks(supabase),
    loadTokens(supabase),
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
    const { data: modules } = await supabase
      .from("module_catalog")
      .select("code, title")
      .order("title");
    own = {
      villageId: ownVillage.id,
      zentraleStyle: ownVillage.zentrale_style,
      modules: modules ?? [],
    };
  }

  return {
    me: { id: profile.id, username: profile.username, displayName: profile.display_name },
    villages,
    friends,
    links,
    tokens,
    own,
  };
}

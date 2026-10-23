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

export type VillageRow = {
  id: string;
  name: string;
  owner_id: string;
  owner: { username: string; display_name: string } | null;
  houses: { id: string; kind: string; created_at: string; artifacts: { created_at: string }[] }[];
};
export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
};
type ProfileRow = { id: string; username: string; display_name: string };
type LinkRow = { id: string; expires_at: string; max_uses: number; uses: number };
type TokenRow = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
};

/** Dörfer mit Besitzer, Zähler und letzter Änderung; das eigene Dorf steht zuerst. */
export function toShellVillages(rows: VillageRow[], meId: string): ShellVillage[] {
  return rows
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
        mine: v.owner_id === meId,
      };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine));
}

/** Die andere Person einer Freundschaft. */
export function otherPartyId(row: FriendshipRow, meId: string): string {
  return row.requester_id === meId ? row.addressee_id : row.requester_id;
}

/** Freundschaften mit Profil der Gegenseite; Einträge ohne sichtbares Profil entfallen. */
export function toShellFriends(
  rows: FriendshipRow[],
  profiles: ProfileRow[],
  meId: string,
): ShellFriend[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.flatMap((r) => {
    const otherId = otherPartyId(r, meId);
    const p = byId.get(otherId);
    if (!p) return [];
    const status: ShellFriend["status"] =
      r.status === "accepted" ? "freund" : r.requester_id === meId ? "ausgehend" : "eingehend";
    return [
      {
        friendshipId: r.id,
        otherId,
        username: p.username,
        displayName: p.display_name,
        status,
        since: r.responded_at ?? r.created_at,
      },
    ];
  });
}

export function toShellLinks(rows: LinkRow[]): ShellLink[] {
  return rows.map((l) => ({
    id: l.id,
    expiresAt: l.expires_at,
    maxUses: l.max_uses,
    uses: l.uses,
  }));
}

export function toShellTokens(rows: TokenRow[]): ShellToken[] {
  return rows.map((t) => ({
    id: t.id,
    label: t.label,
    createdAt: t.created_at,
    lastUsedAt: t.last_used_at ?? null,
  }));
}

/** Freundschaften und Anfragen der angemeldeten Person (leer, falls die Tabelle noch fehlt). */
async function loadFriends(supabase: SupabaseClient, meId: string): Promise<ShellFriend[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, responded_at")
    .order("created_at");
  const rows = (data ?? []) as FriendshipRow[];
  if (error || !rows.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in(
      "id",
      rows.map((r) => otherPartyId(r, meId)),
    );
  return toShellFriends(rows, (profiles ?? []) as ProfileRow[], meId);
}

/** Eigene, noch gültige Freundschaftslinks (leer, falls die Tabelle noch fehlt). */
async function loadLinks(supabase: SupabaseClient): Promise<ShellLink[]> {
  const { data, error } = await supabase
    .from("friend_links")
    .select("id, expires_at, max_uses, uses")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) return [];
  return toShellLinks((data ?? []) as LinkRow[]);
}

/** Aktive Connector-Tokens der Person (leer, falls die Tabelle fehlt). */
async function loadTokens(supabase: SupabaseClient): Promise<ShellToken[]> {
  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, label, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) return [];
  return toShellTokens((data ?? []) as TokenRow[]);
}

/**
 * Lädt alles für Start-, Reise-, Einstellungs- und Hinzufügen-Dialoge. Läuft mit dem RLS-Client:
 * Dörfer und Freundschaften sehen nur die Beteiligten.
 */
export async function loadShell(
  supabase: SupabaseClient,
  profile: { id: string; username: string; display_name: string },
): Promise<ShellData> {
  const [villagesRes, ownRes, modulesRes, friends, links, tokens] = await Promise.all([
    supabase
      .from("villages")
      .select(
        "id, name, owner_id, owner:profiles!villages_owner_id_fkey(username, display_name), houses(id, kind, created_at, artifacts(created_at))",
      )
      .order("created_at"),
    supabase.from("villages").select("id, zentrale_style").eq("owner_id", profile.id).maybeSingle(),
    supabase.from("module_catalog").select("code, title").order("title"),
    loadFriends(supabase, profile.id),
    loadLinks(supabase),
    loadTokens(supabase),
  ]);

  const villages = toShellVillages((villagesRes.data ?? []) as unknown as VillageRow[], profile.id);
  const ownVillage = ownRes.data;
  const own: ShellOwn | null = ownVillage
    ? {
        villageId: ownVillage.id,
        zentraleStyle: ownVillage.zentrale_style,
        modules: modulesRes.data ?? [],
      }
    : null;

  return {
    me: { id: profile.id, username: profile.username, displayName: profile.display_name },
    villages,
    friends,
    links,
    tokens,
    own,
  };
}

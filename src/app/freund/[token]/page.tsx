import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { VillageView } from "@/components/village/village-view";
import type { FriendLinkInfo } from "@/components/world/friend-link-dialog";
import { friendTokenFrom, type FriendLinkState } from "@/lib/friend-links";
import { createClient } from "@/lib/supabase/server";
import { loadShell } from "@/lib/shell-data";
import { loadVillage } from "@/lib/village-data";

export const metadata = { title: "Freundschaft – Hub Dome" };

type InfoRow = { username: string | null; display_name: string | null; state: string };

/**
 * Freundschaftslink: eigenes Dorf im Hintergrund, darüber der Dialog zum Annehmen. Ohne Konto geht es über
 * Login und Onboarding und danach zurück hierher (`next`).
 */
async function FreundContent({ params }: Pick<PageProps<"/freund/[token]">, "params">) {
  const { token: raw } = await params;
  const token = friendTokenFrom(raw) ?? raw;
  const here = `/freund/${encodeURIComponent(token)}`;
  await connection(); // Auth nutzt die aktuelle Zeit: erst zur Anfragezeit rendern
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(here)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarded")
    .eq("id", data.user.id)
    .single();
  if (!profile?.onboarded) redirect(`/onboarding?next=${encodeURIComponent(here)}`);

  const v = await loadVillage(profile.username);
  const shell = await loadShell(v.supabase, v.me);
  const { data: info } = await v.supabase.rpc("friend_link_info", { p_token: token });
  const row = (info as InfoRow[] | null)?.[0];
  const friendLink: FriendLinkInfo = {
    token,
    state: (row?.state as FriendLinkState | undefined) ?? "ungueltig",
    username: row?.username ?? null,
    displayName: row?.display_name ?? null,
  };

  return (
    <VillageView
      villageId={v.village.id}
      villageName={v.village.name}
      ownerUsername={v.owner.username}
      ownerName={v.owner.display_name}
      avatarSeed={v.owner.avatar_seed}
      isOwner={v.isOwner}
      zentraleStyle={v.village.zentrale_style}
      houses={v.houses}
      artifacts={v.artifacts}
      previews={{}}
      shell={shell}
      friendLink={friendLink}
    />
  );
}

export default function FreundPage(props: PageProps<"/freund/[token]">) {
  return (
    <Suspense>
      <FreundContent params={props.params} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { VillageView } from "@/components/village/village-view";
import { loadShell } from "@/lib/shell-data";
import { loadVillage } from "@/lib/village-data";

export const metadata = { title: "Einladung – Hub Dome" };

/** Einladungslink: dein eigenes Dorf im Hintergrund, darüber der Dialog zum Annehmen. */
async function EinladungContent({ params }: Pick<PageProps<"/einladung/[token]">, "params">) {
  const { token } = await params;
  const { profile } = await requireProfile();
  const { supabase, me, owner, village, houses, artifacts, isOwner, customModelUrl } =
    await loadVillage(profile.username);
  const shell = await loadShell(supabase, me);

  return (
    <VillageView
      villageId={village.id}
      villageName={village.name}
      ownerUsername={owner.username}
      ownerName={owner.display_name}
      avatarSeed={owner.avatar_seed}
      isOwner={isOwner}
      zentraleStyle={village.zentrale_style}
      customModelUrl={customModelUrl}
      houses={houses}
      artifacts={artifacts}
      previews={{}}
      shell={shell}
      inviteToken={token}
    />
  );
}

export default function EinladungPage(props: PageProps<"/einladung/[token]">) {
  return (
    <Suspense>
      <EinladungContent params={props.params} />
    </Suspense>
  );
}

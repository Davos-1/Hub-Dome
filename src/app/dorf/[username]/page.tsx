import { Suspense } from "react";
import { ObjectPreview } from "@/components/list/object-preview";
import { VillageView } from "@/components/village/village-view";
import { loadVillage } from "@/lib/village-data";

export const metadata = { title: "Dorf – Hub Dome" };

async function DorfContent({ params }: Pick<PageProps<"/dorf/[username]">, "params">) {
  const { username } = await params;
  const { owner, village, houses, artifacts, isOwner, customModelUrl } =
    await loadVillage(username);

  // Vorschauen (README, Gist-Code) werden auf dem Server gerendert und dem Detail-Fenster übergeben.
  const previews = Object.fromEntries(
    artifacts
      .filter((a) => a.item_type === "github_repo" || a.item_type === "gist")
      .map((a) => [a.id, <ObjectPreview key={a.id} artifact={a} />]),
  );

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
      previews={previews}
    />
  );
}

export default function DorfPage(props: PageProps<"/dorf/[username]">) {
  return (
    <Suspense>
      <DorfContent params={props.params} />
    </Suspense>
  );
}

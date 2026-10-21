import { Suspense } from "react";
import { AppHeader } from "@/components/ui/app-header";
import { ObjectPreview } from "@/components/list/object-preview";
import { VillageView } from "@/components/village/village-view";
import { loadVillage } from "@/lib/village-data";

export const metadata = { title: "Dorf – Hub Dome" };

async function DorfContent({ params }: Pick<PageProps<"/dorf/[username]">, "params">) {
  const { username } = await params;
  const { me, owner, village, houses, artifacts, isOwner } = await loadVillage(username);

  // Vorschauen (README, Gist-Code) werden auf dem Server gerendert und dem Detail-Panel übergeben.
  const previews = Object.fromEntries(
    artifacts
      .filter((a) => a.item_type === "github_repo" || a.item_type === "gist")
      .map((a) => [a.id, <ObjectPreview key={a.id} artifact={a} />]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4">
      <AppHeader displayName={me.display_name} />
      <h1 className="text-2xl font-bold">
        {village.name}{" "}
        <span className="text-base font-normal text-zinc-500">@{owner.username}</span>
      </h1>
      <VillageView
        villageId={village.id}
        villageName={village.name}
        ownerUsername={owner.username}
        ownerName={owner.display_name}
        avatarSeed={owner.avatar_seed}
        isOwner={isOwner}
        houses={houses}
        artifacts={artifacts}
        previews={previews}
      />
    </main>
  );
}

export default function DorfPage(props: PageProps<"/dorf/[username]">) {
  return (
    <Suspense>
      <DorfContent params={props.params} />
    </Suspense>
  );
}

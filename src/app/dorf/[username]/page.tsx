import { Suspense } from "react";
import { ObjectPreview } from "@/components/list/object-preview";
import { VillageView } from "@/components/village/village-view";
import { loadShell } from "@/lib/shell-data";
import { loadVillage } from "@/lib/village-data";

export const metadata = { title: "Dorf – Hub Dome" };

async function DorfContent({ params }: Pick<PageProps<"/dorf/[username]">, "params">) {
  const { username } = await params;
  const { supabase, me, owner, village, houses, artifacts, isOwner } = await loadVillage(username);
  const shell = await loadShell(supabase, me);

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
      houses={houses}
      artifacts={artifacts}
      previews={previews}
      shell={shell}
    />
  );
}

export default function DorfPage(props: PageProps<"/dorf/[username]">) {
  return (
    <Suspense fallback={<WorldLoading />}>
      <DorfContent params={props.params} />
    </Suspense>
  );
}

/** Ruhiger Ladezustand, solange Dorf und Dialogdaten geladen werden. */
function WorldLoading() {
  return (
    <div className="hubdome-ui hd-fade-in fixed inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#6fb1ec] via-[#b9dcf7] to-[#e8f3fb] text-[#1c1b19]">
      <div className="text-2xl font-semibold">Hub Dome</div>
      <p role="status" className="text-[14px] text-[#3a3732]">
        Dorf wird aufgebaut…
      </p>
    </div>
  );
}

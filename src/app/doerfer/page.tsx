import { Suspense } from "react";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/ui/app-header";
import { ActionForm, subtleButton } from "@/components/ui/action-form";
import { leaveVillage } from "./actions";

export const metadata = { title: "Meine Dörfer – Hub Dome" };

type VillageRow = {
  id: string;
  name: string;
  owner_id: string;
  owner: { username: string; display_name: string } | null;
  houses: { id: string; kind: string; created_at: string; artifacts: { created_at: string }[] }[];
};

const fmt = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

function VillageCard({ v, mine }: { v: VillageRow; mine: boolean }) {
  const artifacts = v.houses.flatMap((h) => h.artifacts);
  const houseCount = v.houses.filter((h) => h.kind !== "zentrale").length;
  const last = [...artifacts.map((a) => a.created_at), ...v.houses.map((h) => h.created_at)]
    .sort()
    .at(-1);
  const href = `/dorf/${v.owner?.username}/liste`;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-4">
      <Link href={href} className="text-xl font-semibold hover:underline">
        {v.name}
      </Link>
      <p className="text-sm text-zinc-500">
        @{v.owner?.username} · {houseCount} Häuser · {artifacts.length} Objekte
        {last && ` · zuletzt ${fmt.format(new Date(last))}`}
      </p>
      {!mine && (
        <ActionForm
          action={leaveVillage}
          submitLabel="Dorf verlassen"
          confirm={`Dorf «${v.name}» verlassen? Du verlierst den Zugriff, bis du erneut eingeladen wirst.`}
          buttonClassName={subtleButton}
          className="self-start"
        >
          <input type="hidden" name="villageId" value={v.id} />
        </ActionForm>
      )}
    </li>
  );
}

async function DoerferContent() {
  const { supabase, profile } = await requireProfile();

  // RLS liefert nur eigene und freigegebene Dörfer (private Objekte nur dem Besitzer).
  const { data } = await supabase
    .from("villages")
    .select(
      "id, name, owner_id, owner:profiles!villages_owner_id_fkey(username, display_name), houses(id, kind, created_at, artifacts(created_at))",
    )
    .order("created_at");
  const villages = (data ?? []) as unknown as VillageRow[];
  const mine = villages.filter((v) => v.owner_id === profile.id);
  const shared = villages.filter((v) => v.owner_id !== profile.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <AppHeader displayName={profile.display_name} />
      <h1 className="text-3xl font-bold">Meine Dörfer</h1>
      <ul className="flex flex-col gap-3">
        {mine.map((v) => (
          <VillageCard key={v.id} v={v} mine />
        ))}
      </ul>
      <h2 className="text-xl font-semibold">Mit mir geteilt</h2>
      {shared.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Noch niemand hat sein Dorf mit dir geteilt. Öffne einen Einladungslink, um ein Dorf zu
          sehen.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shared.map((v) => (
            <VillageCard key={v.id} v={v} mine={false} />
          ))}
        </ul>
      )}
    </main>
  );
}

export default function DoerferPage() {
  return (
    <Suspense>
      <DoerferContent />
    </Suspense>
  );
}

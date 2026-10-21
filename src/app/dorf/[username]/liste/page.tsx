import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/ui/app-header";
import { HouseCreateForm } from "@/components/list/house-create-form";
import { HouseSection } from "@/components/list/house-section";
import type { Artifact, House, ModuleOption, Village } from "@/lib/types";

export const metadata = { title: "Dorf – Hub Dome" };

async function ListeContent({ params }: Pick<PageProps<"/dorf/[username]/liste">, "params">) {
  const { username } = await params;
  const { supabase, profile: me } = await requireProfile();

  // RLS: ohne Besitz oder Freigabe kommt hier nichts zurück → 404 (verrät nicht, ob das Dorf existiert).
  const { data: owner } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .maybeSingle();
  if (!owner) notFound();

  const { data: village } = await supabase
    .from("villages")
    .select("id, owner_id, name, theme")
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
  let modules: ModuleOption[] = [];
  if (isOwner) {
    const { data } = await supabase.from("module_catalog").select("code, title").order("title");
    modules = data ?? [];
  }
  const houseOptions = houses.map((h) => ({ id: h.id, title: h.title }));

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <AppHeader displayName={me.display_name} />
      <div>
        <h1 className="text-3xl font-bold">{village.name}</h1>
        <p className="text-sm text-zinc-500">
          @{owner.username}
          {!isOwner && " · mit dir geteilt"}
        </p>
      </div>

      {houses.map((house) => (
        <HouseSection
          key={house.id}
          house={house}
          artifacts={artifacts.filter((a) => a.house_id === house.id)}
          houses={houseOptions}
          isOwner={isOwner}
        />
      ))}

      {isOwner && (
        <section className="rounded-xl border border-dashed border-zinc-400 p-4">
          <h2 className="mb-3 text-xl font-semibold">
            {houses.length <= 1 ? "Lege dein erstes Modulhaus an" : "Neues Haus anlegen"}
          </h2>
          <HouseCreateForm modules={modules} />
        </section>
      )}
    </main>
  );
}

export default function ListePage(props: PageProps<"/dorf/[username]/liste">) {
  return (
    <Suspense>
      <ListeContent params={props.params} />
    </Suspense>
  );
}

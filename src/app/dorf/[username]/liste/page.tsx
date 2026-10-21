import { Suspense } from "react";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/ui/app-header";
import { HouseCreateForm } from "@/components/list/house-create-form";
import { HouseSection } from "@/components/list/house-section";
import {
  ITEM_TYPES,
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
  needsRefresh,
  type ItemType,
} from "@/lib/item-types";
import { refreshArtifactMeta } from "@/lib/previews.server";
import type { Artifact, House, ModuleOption, Village } from "@/lib/types";

export const metadata = { title: "Dorf – Hub Dome" };

async function ListeContent({
  params,
  searchParams,
}: Pick<PageProps<"/dorf/[username]/liste">, "params" | "searchParams">) {
  const { username } = await params;
  const { typ } = await searchParams;
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
  const allArtifacts = (artifactRows ?? []) as Artifact[];
  const filter = ITEM_TYPES.find((t) => t === typ);
  const artifacts = filter ? allArtifacts.filter((a) => a.item_type === filter) : allArtifacts;
  const presentTypes = ITEM_TYPES.filter((t) => allArtifacts.some((a) => a.item_type === t));

  const isOwner = me.id === owner.id;
  if (isOwner) {
    // Veraltete GitHub-/Gist-Vorschauen (älter als 24 h) nach der Antwort aktualisieren.
    const stale = allArtifacts
      .filter(
        (a) =>
          (a.item_type === "github_repo" || a.item_type === "gist") &&
          needsRefresh(a.meta_refreshed_at),
      )
      .slice(0, 5);
    if (stale.length) after(() => Promise.all(stale.map((a) => refreshArtifactMeta(a.id, me.id))));
  }
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

      {presentTypes.length > 1 && (
        <nav aria-label="Nach Objekttyp filtern" className="flex flex-wrap gap-2 text-sm">
          <FilterLink href={`/dorf/${owner.username}/liste`} active={!filter} label="Alle" />
          {presentTypes.map((t: ItemType) => (
            <FilterLink
              key={t}
              href={`/dorf/${owner.username}/liste?typ=${t}`}
              active={filter === t}
              label={`${ITEM_TYPE_ICONS[t]} ${ITEM_TYPE_LABELS[t]}`}
            />
          ))}
        </nav>
      )}

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

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1 ${active ? "bg-blue-600 text-white" : "border-zinc-300"}`}
    >
      {label}
    </Link>
  );
}

export default function ListePage(props: PageProps<"/dorf/[username]/liste">) {
  return (
    <Suspense>
      <ListeContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

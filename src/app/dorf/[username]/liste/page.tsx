import { Suspense } from "react";
import Link from "next/link";
import { loadVillage } from "@/lib/village-data";
import { AppHeader } from "@/components/ui/app-header";
import { HouseCreateForm } from "@/components/list/house-create-form";
import { HouseSection } from "@/components/list/house-section";
import { ITEM_TYPES, ITEM_TYPE_ICONS, ITEM_TYPE_LABELS, type ItemType } from "@/lib/item-types";
import type { ModuleOption } from "@/lib/types";

export const metadata = { title: "Dorf – Hub Dome" };

async function ListeContent({
  params,
  searchParams,
}: Pick<PageProps<"/dorf/[username]/liste">, "params" | "searchParams">) {
  const { username } = await params;
  const { typ } = await searchParams;
  const {
    supabase,
    me,
    owner,
    village,
    houses,
    artifacts: allArtifacts,
    isOwner,
  } = await loadVillage(username);

  const filter = ITEM_TYPES.find((t) => t === typ);
  const artifacts = filter ? allArtifacts.filter((a) => a.item_type === filter) : allArtifacts;
  const presentTypes = ITEM_TYPES.filter((t) => allArtifacts.some((a) => a.item_type === t));

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
          {!isOwner && " · mit dir geteilt"} ·{" "}
          <Link href={`/dorf/${owner.username}`} className="underline">
            3D-Ansicht
          </Link>
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

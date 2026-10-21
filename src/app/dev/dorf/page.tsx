import { Suspense } from "react";
import { notFound } from "next/navigation";
import { VillageView } from "@/components/village/village-view";
import { HOUSE_STYLES, ZENTRALE_STYLES } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";

export const metadata = { title: "Dorf-Vorschau (Entwicklung)" };

const KINDS = [
  "rechner",
  "quiz",
  "zusammenfassung",
  "cheatsheet",
  "tool",
  "visualisierung",
] as const;
const TYPES = ["claude_artifact", "github_repo", "gist", "cloud_ordner", "link"] as const;

/** Entwickler-Vorschau mit erfundenen Daten (ohne Datenbank): ?h=Häuser&o=Objekte pro Haus&haus=…&zentrale=… */
async function Content({ searchParams }: Pick<PageProps<"/dev/dorf">, "searchParams">) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const num = (v: unknown, d: number) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : d);
  const houseCount = Math.min(num(q.h, 8), 40);
  const perHouse = Math.min(num(q.o, 4), 20);
  const houseStyle = HOUSE_STYLES.find((s) => s === q.haus) ?? "haus";
  const zentraleStyle = ZENTRALE_STYLES.find((s) => s === q.zentrale) ?? "rathaus";

  const village = "00000000-0000-4000-8000-000000000001";
  const now = "2026-01-01T00:00:00Z";
  const colors = ["#8fb3ff", "#ffb38f", "#a5d6a7", "#f5d06f", "#d1a3ff"];
  const houses: House[] = [
    {
      id: "z-0",
      village_id: village,
      kind: "zentrale",
      title: "Zentrale",
      module_code: null,
      color: "#8fb3ff",
      position_index: 0,
      created_at: now,
    },
    ...Array.from({ length: houseCount }, (_, i): House => ({
      id: `h-${i}-abcdef`,
      village_id: village,
      kind: "modul",
      title: `Haus ${i + 1}`,
      module_code: null,
      color: colors[i % colors.length],
      position_index: i + 1,
      created_at: now,
    })),
  ];
  const artifacts: Artifact[] = houses.flatMap((h, hi) =>
    h.kind === "zentrale"
      ? []
      : Array.from({ length: hi === 2 ? 0 : perHouse + (hi % 3) * 2 }, (_, i): Artifact => ({
          id: `a-${hi}-${i}`,
          house_id: h.id,
          owner_id: "u",
          url: `https://example.com/${hi}/${i}`,
          title: `Objekt ${hi + 1}.${i + 1}`,
          description: null,
          kind: KINDS[i % KINDS.length],
          item_type: TYPES[(hi + i) % TYPES.length],
          meta: {},
          meta_refreshed_at: null,
          tags: [],
          visibility: "shared",
          sort: i,
          created_at: now,
        })),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4">
      <VillageView
        villageId={village}
        villageName="Dorf-Vorschau"
        ownerUsername="vorschau"
        ownerName="Vorschau"
        avatarSeed="seed"
        isOwner={false}
        houseStyle={houseStyle}
        zentraleStyle={zentraleStyle}
        houses={houses}
        artifacts={artifacts}
        previews={{}}
      />
    </main>
  );
}

export default function Page(props: PageProps<"/dev/dorf">) {
  return (
    <Suspense>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

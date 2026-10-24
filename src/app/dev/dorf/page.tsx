import { EMPTY_EXTRAS } from "@/lib/item-extras";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VillageView } from "@/components/village/village-view";
import type { TimeKey } from "@/lib/daytime";
import { pruneDoc, toLayoutHouses } from "@/lib/world/layout-houses";
import { sampleDoc } from "@/lib/world/sample";
import { ZENTRALE_STYLES } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { GENERATOR_VERSION, isSeed } from "@/lib/world/seed";
import { generateWorld } from "@/lib/world/generate";
import { WEGFORMEN, type QuarterRoad } from "@/lib/world/roads";
import { pinsFromSettlement } from "@/lib/world/settlement";
import type { WorldDoc } from "@/lib/world/doc";
import { devRerollWorld, devSaveWorld } from "./actions";
import { devDoc } from "./dev-store";

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
/** Modulcodes aus allen Fachbereichen, damit die Vorschau jeden Haustyp zeigt. */
const CODES = [
  "TA.BA_BAUSTATIK1",
  "TA.BA_NABA",
  "TA.BA_GA",
  "TA.BA_DC_STUD1",
  "TA.BA_VWL",
  "TA.BA_MATH1A",
  "TA.BA_SP1",
  "TA.BA_DATA1_MM",
  "TA.BA_BS",
  "TA.BA_OEK",
  "TA.BA_ET",
  "TA.BA_WISSARB",
];
const ZEITEN: TimeKey[] = ["morgen", "mittag", "abend", "nacht"];

/** Erfundene Freunde und Anfragen für die Reise-Karte (`freunde=1`). */
function devFriends(village: string) {
  const day = 864e5;
  const now = Date.now();
  const iso = (d: number) => new Date(now - d * day).toISOString();
  const people = [
    ["mia", "Mia Frei", "Mias Atelier", 9, 31, 1],
    ["lea", "Lea Müller", "Leas Dorf", 7, 24, 6],
    ["noah", "Noah Keller", "Noahs Werkhof", 5, 17, 20],
    ["luca", "Luca Brunner", "Lucas Dorf", 3, 8, 90],
  ] as const;
  return {
    villages: [
      {
        id: village,
        name: "Dorf-Vorschau",
        ownerId: "u",
        ownerUsername: "vorschau",
        ownerName: "Vorschau",
        houseCount: 8,
        objectCount: 30,
        last: iso(0),
        mine: true,
      },
      ...people.map(([u, n, d, hs, os, ago]) => ({
        id: `v-${u}`,
        name: d,
        ownerId: `p-${u}`,
        ownerUsername: u,
        ownerName: n,
        houseCount: hs,
        objectCount: os,
        last: iso(ago),
        mine: false,
      })),
    ],
    friends: [
      ...people.map(([u, n], i) => ({
        friendshipId: `f-${u}`,
        otherId: `p-${u}`,
        username: u,
        displayName: n,
        status: "freund" as const,
        since: iso(30 + i),
      })),
      {
        friendshipId: "f-sara",
        otherId: "p-sara",
        username: "sara",
        displayName: "Sara Meier",
        status: "eingehend" as const,
        since: iso(1),
      },
    ],
  };
}
/** Welt-Dokument mit einer Wegform in allen Quartieren (Quartiere an ihrem heutigen Ausgang fixiert). */
function formDoc(
  seed: string,
  version: number,
  houses: ReturnType<typeof toLayoutHouses>,
  road: QuarterRoad,
): WorldDoc {
  const w = generateWorld({ seed, version, houses });
  const quartiere = pinsFromSettlement(w.settlement).quartiere;
  const quarterRoads = Object.fromEntries(Object.keys(quartiere).map((k) => [k, road]));
  return { v: 1, quartiere, quarterRoads };
}

const KAMERAS =
  /^(uebersicht|vogel|strasse|quartier|ufer|zentrale|panorama|weg|haus-(werkstatt|block|solar|atelier|stadt|haus|turm|digital|baustelle))$/;

/**
 * Entwickler-Vorschau mit erfundenen Daten (ohne Datenbank). Parameter: `h` Häuser, `o` Objekte pro Haus,
 * `zentrale` Stil, `seed` Welt-Seed, `zeit` Tageszeit, `kamera` feste Pose, `bewegung=0` friert alles ein,
 * `besitzer=1` zeigt die Bedienelemente des Besitzers, `deko=1` setzt Beispiel-Deko (gültig eingerastet),
 * `v=1`/`v=2` rechnet mit Generator v1 bzw. v2 (Standard: aktuelle Version), `wege=ring|halbkreis|intelligent`
 * setzt diese Wegform in allen Quartieren (Quartiere fixiert, wie nach dem Bau-Modus).
 */
async function Content({ searchParams }: Pick<PageProps<"/dev/dorf">, "searchParams">) {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();
  const q = await searchParams;
  const num = (v: unknown, d: number) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : d);
  const houseCount = Math.min(num(q.h, 8), 50);
  const perHouse = Math.min(num(q.o, 4), 20);
  const zentraleStyle = ZENTRALE_STYLES.find((s) => s === q.zentrale) ?? "rathaus";
  const seed = isSeed(q.seed) ? q.seed : "hubdome1";
  const zeit = ZEITEN.find((z) => z === q.zeit);
  const kamera = typeof q.kamera === "string" && KAMERAS.test(q.kamera) ? q.kamera : undefined;
  // Generator-Version: Standard die aktuelle, `v=1` zeigt ein Dorf auf dem eingefrorenen Generator v1
  const version = q.v === "1" ? 1 : q.v === "2" ? 2 : GENERATOR_VERSION;
  const form = WEGFORMEN.find((f) => f === q.wege);

  const village = "00000000-0000-4000-8000-000000000001";
  const old = "2026-01-01T00:00:00Z";
  const recent = new Date().toISOString();
  const colors = ["#8fb3ff", "#ffb38f", "#a5d6a7", "#f5d06f", "#d1a3ff"];
  const houses: House[] = [
    {
      id: "z-0",
      village_id: village,
      kind: "zentrale",
      title: "Zentrale",
      module_code: null,
      color: "#8fb3ff",
      semester: null,
      position_index: 0,
      created_at: old,
    },
    ...Array.from({ length: houseCount }, (_, i): House => ({
      id: `h-${i}-abcdef`,
      village_id: village,
      kind: "modul",
      title: `Haus ${i + 1}`,
      module_code: CODES[i % CODES.length],
      color: colors[i % colors.length],
      semester: (i % 6) + 1,
      position_index: i + 1,
      // Häuser in der Reihenfolge der Entstehung (ein Tag Abstand)
      created_at: new Date(Date.parse(old) + i * 86_400_000).toISOString(),
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
          // einzelne neue Objekte (Kaminrauch, Anschlagbrett)
          created_at: hi % 4 === 1 && i === 0 ? recent : old,
        })),
  );

  return (
    <VillageView
      villageId={village}
      villageName="Dorf-Vorschau"
      ownerUsername="vorschau"
      ownerName="Vorschau"
      avatarSeed="seed"
      isOwner={q.besitzer === "1"}
      zentraleStyle={zentraleStyle}
      houses={houses}
      artifacts={artifacts}
      previews={{}}
      extras={EMPTY_EXTRAS}
      world={{
        seed,
        version,
        // Beispiel-Deko, sonst das im Dev-Server Gespeicherte (ohne Häuser, die es hier nicht gibt)
        doc: form
          ? formDoc(seed, version, toLayoutHouses(houses, artifacts), { form })
          : q.deko === "1"
            ? sampleDoc({ seed, version, houses: toLayoutHouses(houses, artifacts) })
            : pruneDoc(devDoc(seed) ?? { v: 1 }, new Set(houses.map((h) => h.id))),
      }}
      worldActions={{ save: devSaveWorld.bind(null, seed), reroll: devRerollWorld }}
      dev={{ kamera, zeit, bewegung: q.bewegung === "0" ? false : undefined }}
      shell={{
        me: { id: "u", username: "vorschau", displayName: "Vorschau", timeMode: "auto" },
        ...(q.freunde === "1" ? devFriends(village) : { villages: [], friends: [] }),
        links: [],
        tokens: [],
        own:
          q.besitzer === "1"
            ? {
                villageId: village,
                zentraleStyle,
                modules: CODES.map((code) => ({ code, title: `Modul ${code.slice(6)}` })),
              }
            : null,
      }}
    />
  );
}

export default function Page(props: PageProps<"/dev/dorf">) {
  return (
    <Suspense>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { FACHBEREICHE, type FachbereichId } from "@/lib/fachbereiche";
import { worldDocSchema, type WorldDoc } from "@/lib/world/doc";
import { generateWorld, type World } from "@/lib/world/generate";
import { checkVarianten } from "@/lib/world/kit";
import { pruneDoc } from "@/lib/world/layout-houses";
import { GENERATOR_VERSION, seedSchema } from "@/lib/world/seed";
import { loadOwnWorld, writeWorld } from "@/lib/world/server-data";
import type { Abgewiesen, RerollWorldResult, SaveWorldResult } from "@/lib/world/types";

/**
 * Welt speichern und neu würfeln. Der Server vertraut dem Client nie: Besitzer aus der Sitzung, Häuser und
 * Objekte aus der Datenbank, Welt serverseitig neu gerechnet. Geschrieben wird mit Service Role und
 * `owner_id`-Filter (die Tabelle hat für Clients keine Schreibrechte).
 */

const TXT = {
  keinDorf: "Dorf nicht gefunden.",
  laden: "Das Dorf konnte nicht geladen werden.",
  speichern: "Die Welt konnte nicht gespeichert werden.",
  keineTabelleSpeichern: "Speichern ist erst nach dem Datenbank-Update möglich.",
  keineTabelleWuerfeln: "Neu würfeln ist erst nach dem Datenbank-Update möglich.",
  ungueltig: "Die Platzierungen sind ungültig.",
  eingabe: "Ungültige Eingabe.",
  zuGross: "Die Platzierungen sind zu umfangreich.",
  passtNicht: "Einige Elemente passen nicht an ihren Platz.",
  passtNichtNeu: "Einige Elemente passen in der neuen Landschaft nicht an ihren Platz.",
};

/** Obergrenze des Dokuments; die Datenbank erlaubt 64 KB (`pg_column_size`). */
const MAX_DOC_CHARS = 60_000;

const loadError = (reason: "no-village" | "no-table" | "error", noTable: string) =>
  reason === "no-village" ? TXT.keinDorf : reason === "no-table" ? noTable : TXT.laden;

/** Abgewiesene Deko und ungültige Fixierungen als Liste mit kurzem Grund. */
function rejections(world: World): Abgewiesen {
  const list: Abgewiesen = world.rejected.map(({ id, grund }) => ({ id, grund }));
  for (const pin of world.settlement.droppedPins) {
    // «<fachbereich>:<ausgang>» = Quartier, sonst die Id eines Hauses
    const [fach, dir] = pin.split(":");
    list.push({
      id: pin,
      grund:
        dir !== undefined && fach in FACHBEREICHE
          ? `Quartier «${FACHBEREICHE[fach as FachbereichId].name}» passt nicht an die gewählte Seite.`
          : "Das Haus passt nicht auf den gewählten Bauplatz.",
    });
  }
  return list;
}

/**
 * Platzierungen des eigenen Dorfs speichern. Der Server rechnet die Welt mit dem gespeicherten Seed neu;
 * passt ein Element nicht (Deko abgewiesen, Fixierung ungültig), wird nichts gespeichert.
 */
export async function saveWorld(input: unknown): Promise<SaveWorldResult> {
  const parsed = worldDocSchema.safeParse(input);
  if (!parsed.success) return { error: TXT.ungueltig };
  const { supabase, user } = await requireUser();

  const own = await loadOwnWorld(supabase, user.id);
  if (!own.ok) return { error: loadError(own.reason, TXT.keineTabelleSpeichern) };

  const doc = pruneDoc(parsed.data, new Set(own.houses.map((h) => h.id)));
  if (JSON.stringify(doc).length > MAX_DOC_CHARS) return { error: TXT.zuGross };

  const world = generateWorld({
    seed: own.world.seed,
    version: own.world.version,
    houses: own.houses,
    doc,
  });
  const abgewiesen = [...rejections(world), ...checkVarianten(own.houses, doc.varianten)];
  if (abgewiesen.length) return { error: TXT.passtNicht, abgewiesen };

  const res = await writeWorld(own.villageId, user.id, { placements: doc });
  if (!res.ok)
    return { error: res.reason === "no-table" ? TXT.keineTabelleSpeichern : TXT.speichern };
  revalidatePath("/", "layout");
  return { ok: true };
}

const rerollSchema = z.object({
  /** Der in der Vorschau gezeigte Seed: Der Besitzer bekommt genau das, was er gesehen hat. */
  seed: seedSchema,
  /** Auch eigene Deko, Fixierungen und Varianten löschen. */
  resetPlacements: z.boolean(),
  /** Deko, die in der neuen Landschaft ungültig wäre, entfernen statt abzulehnen. */
  dropInvalid: z.boolean().optional(),
});

/**
 * Welt mit dem Seed aus der Vorschau neu würfeln. Fixierte Quartiere und Häuser fallen immer weg (die Gassen
 * hängen am Seed), Varianten bleiben. Eigene Deko bleibt, sofern sie im neuen Gelände gültig ist; sonst
 * Fehler mit Liste, ausser `dropInvalid`: Dann werden genau diese Elemente entfernt (Anzahl in `entfernt`).
 */
export async function rerollWorld(input: unknown): Promise<RerollWorldResult> {
  const parsed = rerollSchema.safeParse(input);
  if (!parsed.success) return { error: TXT.eingabe };
  const { seed, resetPlacements, dropInvalid } = parsed.data;
  const { supabase, user } = await requireUser();

  const own = await loadOwnWorld(supabase, user.id);
  if (!own.ok) return { error: loadError(own.reason, TXT.keineTabelleWuerfeln) };

  const current = own.world.doc;
  const draft: WorldDoc = { v: 1 };
  if (!resetPlacements) {
    if (current.deko) draft.deko = current.deko;
    if (current.varianten) draft.varianten = current.varianten;
  }
  const doc = pruneDoc(draft, new Set(own.houses.map((h) => h.id)));

  let entfernt = 0;
  if (doc.deko?.length) {
    const world = generateWorld({ seed, version: GENERATOR_VERSION, houses: own.houses, doc });
    if (world.rejected.length) {
      if (!dropInvalid) return { error: TXT.passtNichtNeu, abgewiesen: rejections(world) };
      // Ungültige Elemente belegen keinen Platz: Die übrigen bleiben gültig, auch ohne erneute Prüfung.
      entfernt = world.rejected.length;
      doc.deko = world.deko;
    }
  }

  const res = await writeWorld(own.villageId, user.id, {
    placements: doc,
    seed,
    generator_version: GENERATOR_VERSION,
  });
  if (!res.ok)
    return { error: res.reason === "no-table" ? TXT.keineTabelleWuerfeln : TXT.speichern };
  revalidatePath("/", "layout");
  return { ok: true, entfernt };
}

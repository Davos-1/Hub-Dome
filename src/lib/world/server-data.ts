import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_DOC, parseDoc, type WorldDoc } from "./doc";
import {
  toLayoutHouses,
  type ArtifactRow,
  type HouseRow,
  type OrderedLayoutHouse,
} from "./layout-houses";
import { isSeed } from "./seed";
import { legacySeed } from "./seed.server";
import type { VillageWorld } from "./types";

/**
 * Serverseitige Datenzugriffe auf `village_worlds` und die Häuser eines Dorfs. Lesen läuft mit dem RLS-Client
 * des Users, Schreiben nur mit Service Role (die Tabelle hat für Clients keine Schreibrechte), immer mit
 * `owner_id`-Filter.
 */

type DbError = { code?: string; message?: string } | null | undefined;

/**
 * Fehlt die Tabelle (Migration noch nicht eingespielt)? Postgres meldet `42P01`, PostgREST `PGRST205`
 * («Could not find the table … in the schema cache»); als Rückfall dient der Meldungstext.
 */
export function isMissingTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("village_worlds") &&
    (m.includes("does not exist") || m.includes("could not find the table"))
  );
}

export type WorldRow = { seed: string; generator_version: number; placements: unknown };
export type WorldRowResult =
  { ok: true; row: WorldRow | null } | { ok: false; reason: "no-table" | "error" };

/** Liest die Zeile `village_worlds` eines Dorfs (RLS: Besitzer und Freunde). */
export async function loadWorldRow(
  supabase: SupabaseClient,
  villageId: string,
): Promise<WorldRowResult> {
  const { data, error } = await supabase
    .from("village_worlds")
    .select("seed, generator_version, placements")
    .eq("village_id", villageId)
    .maybeSingle<WorldRow>();
  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "no-table" };
    console.error("village_worlds lesen fehlgeschlagen:", error.message);
    return { ok: false, reason: "error" };
  }
  return { ok: true, row: data ?? null };
}

/** Welt aus einer gelesenen Zeile; ohne brauchbare Zeile der Ersatz (Seed aus der Dorf-ID, keine Platzierungen). */
export function worldFromRow(villageId: string, row: WorldRow | null): VillageWorld {
  if (!row || !isSeed(row.seed))
    return { seed: legacySeed(villageId), version: 1, doc: { ...EMPTY_DOC }, stored: false };
  return {
    seed: row.seed,
    version: Number.isInteger(row.generator_version) ? row.generator_version : 1,
    doc: parseDoc(row.placements),
    stored: true,
  };
}

/**
 * Welt für die Anzeige: Fehlt die Zeile oder die Tabelle, gilt der Ersatz (`stored: false`). Wirft nie,
 * damit ein Fehler hier das Dorf nicht unsichtbar macht.
 */
export async function loadVillageWorld(
  supabase: SupabaseClient,
  villageId: string,
): Promise<VillageWorld> {
  try {
    const res = await loadWorldRow(supabase, villageId);
    return worldFromRow(villageId, res.ok ? res.row : null);
  } catch (e) {
    console.error("village_worlds lesen fehlgeschlagen:", e);
    return worldFromRow(villageId, null);
  }
}

export type OwnWorld =
  | { ok: true; villageId: string; houses: OrderedLayoutHouse[]; world: VillageWorld }
  | { ok: false; reason: "no-village" | "no-table" | "error" };

/**
 * Eigenes Dorf des Users mit Häusern (als `LayoutHouse[]`) und gespeicherter Welt, für `saveWorld` und
 * `rerollWorld`. Schlägt eine Abfrage fehl, wird nichts gerechnet: Mit unvollständigen Häusern käme eine
 * andere Welt heraus, und der Server würde auf falscher Grundlage prüfen.
 */
export async function loadOwnWorld(supabase: SupabaseClient, userId: string): Promise<OwnWorld> {
  const { data: village, error: vErr } = await supabase
    .from("villages")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle<{ id: string }>();
  if (vErr) return { ok: false, reason: "error" };
  if (!village) return { ok: false, reason: "no-village" };

  const { data: houseRows, error: hErr } = await supabase
    .from("houses")
    .select("id, kind, module_code, position_index, created_at")
    .eq("village_id", village.id);
  if (hErr || !houseRows) return { ok: false, reason: "error" };

  const houseIds = houseRows.map((h) => h.id as string);
  let artifactRows: ArtifactRow[] = [];
  if (houseIds.length) {
    const { data, error } = await supabase
      .from("artifacts")
      .select("id, house_id, kind, sort, created_at")
      .in("house_id", houseIds)
      .order("sort")
      .order("created_at");
    if (error || !data) return { ok: false, reason: "error" };
    artifactRows = data;
  }

  const res = await loadWorldRow(supabase, village.id);
  if (!res.ok) return { ok: false, reason: res.reason };

  return {
    ok: true,
    villageId: village.id,
    houses: toLayoutHouses(houseRows as HouseRow[], artifactRows),
    world: worldFromRow(village.id, res.row),
  };
}

export type WorldPatch = { placements: WorldDoc; seed?: string; generator_version?: number };

/**
 * Schreibt die Welt eines Dorfs mit Service Role: erst `update` (Filter `village_id` und `owner_id`), trifft
 * das keine Zeile, `insert` (der Trigger setzt `owner_id` ohnehin aus dem Dorf). Ohne `seed` bekommt eine neue
 * Zeile den Ersatz-Seed, damit sich die Landschaft nicht ändert.
 */
export async function writeWorld(
  villageId: string,
  ownerId: string,
  patch: WorldPatch,
): Promise<{ ok: true } | { ok: false; reason: "no-table" | "error" }> {
  const fail = (error: NonNullable<DbError>) => {
    if (isMissingTable(error)) return { ok: false, reason: "no-table" } as const;
    console.error("village_worlds schreiben fehlgeschlagen:", error.message);
    return { ok: false, reason: "error" } as const;
  };

  const db = createAdminClient();
  const upd = await db
    .from("village_worlds")
    .update(patch)
    .eq("village_id", villageId)
    .eq("owner_id", ownerId)
    .select("village_id");
  if (upd.error) return fail(upd.error);
  if (upd.data && upd.data.length > 0) return { ok: true };

  const ins = await db.from("village_worlds").insert({
    village_id: villageId,
    owner_id: ownerId,
    seed: patch.seed ?? legacySeed(villageId),
    generator_version: patch.generator_version ?? 1,
    placements: patch.placements,
  });
  if (ins.error) return fail(ins.error);
  return { ok: true };
}

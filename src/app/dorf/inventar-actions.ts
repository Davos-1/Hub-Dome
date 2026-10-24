"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ARTIFACT_KINDS } from "@/lib/types";

/**
 * Massenaktionen der Liste und des Inventars (Phase 4h): mehrere eigene Objekte auf einmal verschieben,
 * umsortieren, einer Kategorie zuordnen, freigeben bzw. auf «Nur ich» setzen oder löschen. Alle Abfragen mit
 * dem RLS-Client des Users und zusätzlich mit `owner_id`-Filter; das Zielhaus muss im eigenen Dorf stehen.
 */

export type BulkResult = { ok: true; count: number } | { error: string };

const ids = z
  .array(z.uuid())
  .min(1, "Keine Objekte gewählt.")
  .max(200, "Höchstens 200 Objekte auf einmal.");

const bulkMoveSchema = z.object({ ids, houseId: z.uuid() });
const bulkVisibilitySchema = z.object({ ids, visibility: z.enum(["shared", "private"]) });
const bulkKindSchema = z.object({ ids, kind: z.enum(ARTIFACT_KINDS) });
const bulkDeleteSchema = z.object({ ids });
const reorderSchema = z.object({ houseId: z.uuid(), ids });

const firstError = (e: { issues: { message: string }[] }) => e.issues[0].message;
const done = (count: number): BulkResult => {
  revalidatePath("/", "layout");
  return { ok: true, count };
};

type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Gehört das Haus zum eigenen Dorf? */
async function ownHouse(supabase: Db, userId: string, houseId: string): Promise<boolean> {
  const { data } = await supabase
    .from("houses")
    .select("id, villages!inner(owner_id)")
    .eq("id", houseId)
    .eq("villages.owner_id", userId)
    .maybeSingle();
  return !!data;
}

/** Objekte in ein anderes Haus verschieben (ans Ende). */
export async function bulkMoveArtifacts(input: unknown): Promise<BulkResult> {
  const parsed = bulkMoveSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();
  if (!(await ownHouse(supabase, user.id, parsed.data.houseId)))
    return { error: "Bitte eines deiner eigenen Häuser wählen." };
  const { data, error } = await supabase
    .from("artifacts")
    .update({ house_id: parsed.data.houseId })
    .in("id", parsed.data.ids)
    .eq("owner_id", user.id)
    .select("id");
  if (error) return { error: "Die Objekte konnten nicht verschoben werden." };
  return done(data?.length ?? 0);
}

/** Für Freunde freigeben bzw. auf «Nur ich» setzen (Topdorf fällt bei «Nur ich» weg, siehe Trigger). */
export async function bulkSetVisibility(input: unknown): Promise<BulkResult> {
  const parsed = bulkVisibilitySchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();
  let q = supabase
    .from("artifacts")
    .update({ visibility: parsed.data.visibility })
    .in("id", parsed.data.ids)
    .eq("owner_id", user.id);
  // Übernahmen bleiben privat
  if (parsed.data.visibility === "shared") q = q.eq("is_copy", false);
  const { data, error } = await q.select("id");
  if (error) return { error: "Die Sichtbarkeit konnte nicht geändert werden." };
  return done(data?.length ?? 0);
}

export async function bulkSetKind(input: unknown): Promise<BulkResult> {
  const parsed = bulkKindSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("artifacts")
    .update({ kind: parsed.data.kind })
    .in("id", parsed.data.ids)
    .eq("owner_id", user.id)
    .select("id");
  if (error) return { error: "Die Kategorie konnte nicht geändert werden." };
  return done(data?.length ?? 0);
}

export async function bulkDelete(input: unknown): Promise<BulkResult> {
  const parsed = bulkDeleteSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("artifacts")
    .delete()
    .in("id", parsed.data.ids)
    .eq("owner_id", user.id)
    .select("id");
  if (error) return { error: "Die Objekte konnten nicht gelöscht werden." };
  return done(data?.length ?? 0);
}

/**
 * Reihenfolge der Objekte eines Hauses (Liste: Ziehen zum Umsortieren). `ids` ist die neue Reihenfolge; Objekte
 * aus anderen eigenen Häusern ziehen dabei mit ins Haus. Die Reihenfolge bestimmt die Plätze im Garten.
 */
export async function reorderArtifacts(input: unknown): Promise<BulkResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();
  if (!(await ownHouse(supabase, user.id, parsed.data.houseId)))
    return { error: "Bitte eines deiner eigenen Häuser wählen." };
  let count = 0;
  for (const [i, id] of parsed.data.ids.entries()) {
    const { data, error } = await supabase
      .from("artifacts")
      .update({ sort: i, house_id: parsed.data.houseId })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id");
    if (error) return { error: "Die Reihenfolge konnte nicht gespeichert werden." };
    count += data?.length ?? 0;
  }
  return done(count);
}

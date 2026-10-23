"use server";

import { after } from "next/server";
import { z } from "zod";
import { refreshAll } from "@/lib/action-utils";
import { requireUser } from "@/lib/auth";
import { refreshArtifactMeta } from "@/lib/previews.server";
import type { ActionState } from "@/lib/types";
import {
  artifactSchema,
  copySchema,
  firstIssue,
  houseSchema,
  houseUpdateSchema,
  uuidSchema,
} from "@/lib/validation";

const fields = (fd: FormData) => Object.fromEntries(fd.entries());

const houseIdSchema = uuidSchema("Ungültiges Haus.");
const artifactIdSchema = uuidSchema("Ungültiges Objekt.");

/**
 * Alle Mutationen laufen mit dem RLS-Client des Users. Objekte filtern zusätzlich explizit nach
 * `owner_id`; Häuser haben keine eigene Besitzerspalte, dort schützt RLS (`is_village_owner`).
 */

export async function createHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = houseSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, user } = await requireUser();

  const { data: village } = await supabase
    .from("villages")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!village) return { error: "Dorf nicht gefunden." };

  let title = parsed.data.title;
  let moduleCode: string | null = null;
  if (parsed.data.kind === "modul") {
    const { data: mod } = await supabase
      .from("module_catalog")
      .select("code, title")
      .eq("code", parsed.data.moduleCode!)
      .single();
    if (!mod) return { error: "Unbekanntes Modul." };
    moduleCode = mod.code;
    title = title || mod.title;
  }

  const { count } = await supabase
    .from("houses")
    .select("id", { count: "exact", head: true })
    .eq("village_id", village.id);

  const { error } = await supabase.from("houses").insert({
    village_id: village.id,
    kind: parsed.data.kind,
    title: title!,
    module_code: moduleCode,
    color: parsed.data.color,
    // Spalte `semester` nur schreiben, wenn gesetzt (ältere Datenbanken ohne Migration 5 funktionieren weiter)
    ...(parsed.data.semester === null ? {} : { semester: parsed.data.semester }),
    position_index: count ?? 0,
  });
  if (error) return { error: "Das Haus konnte nicht angelegt werden." };
  refreshAll();
  return { ok: true };
}

export async function updateHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = houseIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: firstIssue(id.error) };
  const parsed = houseUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("houses")
    .update(parsed.data)
    .eq("id", id.data)
    .neq("kind", "zentrale")
    .select("id");
  if (error || !data?.length) return { error: "Das Haus konnte nicht geändert werden." };
  refreshAll();
  return { ok: true };
}

export async function deleteHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = houseIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: firstIssue(id.error) };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("houses")
    .delete()
    .eq("id", id.data)
    .neq("kind", "zentrale")
    .select("id");
  if (error || !data?.length) return { error: "Das Haus konnte nicht gelöscht werden." };
  refreshAll();
  return { ok: true };
}

export async function createArtifact(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = artifactSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, user } = await requireUser();

  const { houseId, itemType, allowCopy, topdorfOk, ...rest } = parsed.data;
  const { data: created, error } = await supabase
    .from("artifacts")
    .insert({
      ...rest,
      house_id: houseId,
      item_type: itemType,
      owner_id: user.id,
      allow_copy: allowCopy,
      topdorf_ok: topdorfOk,
    })
    .select("id")
    .single();
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Dieser Link ist schon in deinem Dorf."
          : "Das Objekt konnte nicht gespeichert werden.",
    };
  }
  after(() => refreshArtifactMeta(created.id, user.id));
  refreshAll();
  return { ok: true };
}

export async function updateArtifact(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = artifactIdSchema.safeParse(formData.get("id"));
  if (!parsedId.success) return { error: firstIssue(parsedId.error) };
  const id = parsedId.data;
  const parsed = artifactSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, user } = await requireUser();

  const { houseId, itemType, allowCopy, topdorfOk, ...rest } = parsed.data;
  const { data: before } = await supabase
    .from("artifacts")
    .select("url, is_copy")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  // Übernahmen: Herkunft regelt die Datenbank; Erlaubnisse bleiben aus (bis eine eigene Version verknüpft ist).
  const copyFields =
    before?.is_copy && before.url === rest.url
      ? { visibility: "private" as const }
      : { allow_copy: allowCopy, topdorf_ok: topdorfOk };
  // Neue URL → alte Vorschau verwerfen, damit sie neu geladen wird.
  const resetMeta = before && before.url !== rest.url ? { meta: {}, meta_refreshed_at: null } : {};
  const { data, error } = await supabase
    .from("artifacts")
    .update({ ...rest, ...copyFields, ...resetMeta, house_id: houseId, item_type: itemType })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) {
    return {
      error:
        error?.code === "23505"
          ? "Dieser Link ist schon in deinem Dorf."
          : "Das Objekt konnte nicht geändert werden.",
    };
  }
  after(() => refreshArtifactMeta(id, user.id));
  refreshAll();
  return { ok: true };
}

export async function deleteArtifact(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = artifactIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: firstIssue(id.error) };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("artifacts")
    .delete()
    .eq("id", id.data)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Das Objekt konnte nicht gelöscht werden." };
  refreshAll();
  return { ok: true };
}

const COPY_ERRORS: Record<string, string> = {
  nicht_gefunden: "Dieses Objekt ist für dich nicht (mehr) sichtbar.",
  eigenes_objekt: "Das ist schon dein eigenes Objekt.",
  nicht_erlaubt: "Der Besitzer hat das Übernehmen für dieses Objekt deaktiviert.",
  haus_ungueltig: "Bitte eines deiner eigenen Häuser wählen.",
  bereits_vorhanden: "Dieser Link ist schon in deinem Dorf.",
};

export type CopyState = ActionState & { houseTitle?: string };

/**
 * Objekt aus einem fremden Dorf ins eigene übernehmen. `house` ist die ID eines eigenen Hauses
 * oder `neu:<Modulcode>` («Haus anlegen und übernehmen»).
 */
export async function copyArtifact(_: CopyState, formData: FormData): Promise<CopyState> {
  const parsed = copySchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, user } = await requireUser();
  const { source, house } = parsed.data;

  let houseId: string;
  let houseTitle: string;
  if (house.startsWith("neu:")) {
    const code = house.slice(4);
    const [{ data: village }, { data: mod }] = await Promise.all([
      supabase.from("villages").select("id").eq("owner_id", user.id).single(),
      supabase.from("module_catalog").select("code, title").eq("code", code).single(),
    ]);
    if (!village || !mod) return { error: "Das Haus konnte nicht angelegt werden." };
    // Gibt es das Modulhaus inzwischen schon, wird es verwendet.
    const { data: existing } = await supabase
      .from("houses")
      .select("id, title")
      .eq("village_id", village.id)
      .eq("module_code", mod.code)
      .maybeSingle();
    if (existing) {
      houseId = existing.id;
      houseTitle = existing.title;
    } else {
      const { count } = await supabase
        .from("houses")
        .select("id", { count: "exact", head: true })
        .eq("village_id", village.id);
      const { data: created, error } = await supabase
        .from("houses")
        .insert({
          village_id: village.id,
          kind: "modul",
          title: mod.title,
          module_code: mod.code,
          position_index: count ?? 0,
        })
        .select("id, title")
        .single();
      if (error || !created) return { error: "Das Haus konnte nicht angelegt werden." };
      houseId = created.id;
      houseTitle = created.title;
    }
  } else {
    const { data: own } = await supabase
      .from("houses")
      .select("id, title, villages!inner(owner_id)")
      .eq("id", house)
      .eq("villages.owner_id", user.id)
      .maybeSingle();
    if (!own) return { error: COPY_ERRORS.haus_ungueltig };
    houseId = own.id;
    houseTitle = own.title;
  }

  const { error } = await supabase.rpc("copy_artifact", { p_source: source, p_house: houseId });
  if (error) {
    const code = Object.keys(COPY_ERRORS).find((k) => error.message.includes(k));
    return { error: code ? COPY_ERRORS[code] : "Das Objekt konnte nicht übernommen werden." };
  }
  refreshAll();
  return { ok: true, houseTitle };
}

/** Alle eigenen geteilten Objekte fürs Topdorf freigeben bzw. zurückziehen. */
export async function setTopdorfAll(_: ActionState, formData: FormData): Promise<ActionState> {
  const on = z.enum(["an", "aus"]).safeParse(formData.get("topdorf"));
  if (!on.success) return { error: "Ungültige Eingabe." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_topdorf_all", { p_on: on.data === "an" });
  if (error) return { error: "Die Freigabe konnte nicht geändert werden." };
  refreshAll();
  return { ok: true };
}

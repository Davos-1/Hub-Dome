"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/types";
import { artifactSchema, houseSchema, houseUpdateSchema } from "@/lib/validation";

const firstError = (e: { issues: { message: string }[] }) => e.issues[0].message;

function refresh() {
  revalidatePath("/", "layout");
}

const fields = (fd: FormData) => Object.fromEntries(fd.entries());

/** Alle Mutationen laufen mit dem RLS-Client des Users; zusätzlich wird explizit nach Besitzer gefiltert. */

export async function createHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = houseSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
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
    position_index: count ?? 0,
  });
  if (error) return { error: "Das Haus konnte nicht angelegt werden." };
  refresh();
  return { ok: true };
}

export async function updateHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const parsed = houseUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("houses")
    .update(parsed.data)
    .eq("id", id)
    .neq("kind", "zentrale")
    .select("id");
  if (error || !data?.length) return { error: "Das Haus konnte nicht geändert werden." };
  refresh();
  return { ok: true };
}

export async function deleteHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("houses")
    .delete()
    .eq("id", id)
    .neq("kind", "zentrale")
    .select("id");
  if (error || !data?.length) return { error: "Das Haus konnte nicht gelöscht werden." };
  refresh();
  return { ok: true };
}

export async function createArtifact(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = artifactSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();

  const { houseId, ...rest } = parsed.data;
  const { error } = await supabase
    .from("artifacts")
    .insert({ ...rest, house_id: houseId, owner_id: user.id });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Dieser Link ist schon in deinem Dorf."
          : "Das Artifact konnte nicht gespeichert werden.",
    };
  }
  refresh();
  return { ok: true };
}

export async function updateArtifact(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const parsed = artifactSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, user } = await requireUser();

  const { houseId, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("artifacts")
    .update({ ...rest, house_id: houseId })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) {
    return {
      error:
        error?.code === "23505"
          ? "Dieser Link ist schon in deinem Dorf."
          : "Das Artifact konnte nicht geändert werden.",
    };
  }
  refresh();
  return { ok: true };
}

export async function deleteArtifact(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("artifacts")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Das Artifact konnte nicht gelöscht werden." };
  refresh();
  return { ok: true };
}

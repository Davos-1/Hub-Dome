"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/types";
import { zentraleStyleSchema } from "@/lib/styles";

export async function updateDisplayName(_: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("displayName") ?? "").trim();
  if (name.length < 1 || name.length > 60)
    return { error: "Der Name muss 1–60 Zeichen lang sein." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) return { error: "Der Name konnte nicht gespeichert werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Stil der Zentrale speichern (Haustypen ergeben sich aus dem Fachbereich). */
export async function updateVillageStyle(_: ActionState, formData: FormData): Promise<ActionState> {
  const zentrale = zentraleStyleSchema.safeParse(formData.get("zentraleStyle"));
  if (!zentrale.success) return { error: "Ungültige Stilauswahl." };
  const { supabase, user } = await requireUser();

  const { data: village } = await supabase
    .from("villages")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!village) return { error: "Dorf nicht gefunden." };

  const { error } = await supabase
    .from("villages")
    .update({ zentrale_style: zentrale.data })
    .eq("id", village.id)
    .eq("owner_id", user.id);
  if (error) return { error: "Die Stile konnten nicht gespeichert werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

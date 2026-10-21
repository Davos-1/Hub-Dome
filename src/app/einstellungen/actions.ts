"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { generateToken, hashToken } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";
import { zentraleStyleSchema } from "@/lib/styles";
import { inviteSchema } from "@/lib/validation";

const INVITE_DAYS = 7;

export async function createInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Bitte eine Anzahl zwischen 1 und 100 angeben." };
  const { supabase, user } = await requireUser();

  const { data: village } = await supabase
    .from("villages")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!village) return { error: "Dorf nicht gefunden." };

  const token = generateToken();
  const { error } = await supabase.from("invites").insert({
    village_id: village.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString(),
    max_uses: parsed.data.maxUses,
  });
  if (error) return { error: "Die Einladung konnte nicht erstellt werden." };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  revalidatePath("/einstellungen");
  return { ok: true, inviteUrl: `${base}/einladung/${token}` };
}

export async function revokeAccess(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewerId = String(formData.get("viewerId"));
  const { supabase, user } = await requireUser();

  const { data: village } = await supabase
    .from("villages")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!village) return { error: "Dorf nicht gefunden." };

  const { error } = await supabase
    .from("village_access")
    .delete()
    .eq("village_id", village.id)
    .eq("viewer_id", viewerId);
  if (error) return { error: "Der Zugriff konnte nicht entzogen werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) return { error: "Die Einladung konnte nicht gelöscht werden." };
  revalidatePath("/einstellungen");
  return { ok: true };
}

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
    .select("id, zentrale_model_meta")
    .eq("owner_id", user.id)
    .single();
  if (!village) return { error: "Dorf nicht gefunden." };
  if (zentrale.data === "custom" && !village.zentrale_model_meta) {
    return { error: "Lade zuerst ein eigenes Modell hoch, bevor du «Eigenes Modell» wählst." };
  }

  const { error } = await supabase
    .from("villages")
    .update({ zentrale_style: zentrale.data })
    .eq("id", village.id)
    .eq("owner_id", user.id);
  if (error) return { error: "Die Stile konnten nicht gespeichert werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

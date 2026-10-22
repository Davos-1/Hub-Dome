"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^@/, ""))
  .pipe(z.string().regex(/^[a-z0-9_-]{3,24}$/, "Bitte einen gültigen Benutzernamen eingeben."));

const idSchema = z.uuid({ message: "Ungültige Anfrage." });

/** Freundschaftsanfrage an einen Benutzernamen senden. */
export async function sendFriendRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("send_friend_request", { p_username: parsed.data });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Eine eingehende Anfrage annehmen oder ablehnen. */
export async function respondFriendRequest(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: id.error.issues[0].message };
  const accept = formData.get("accept") === "1";
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_id: id.data,
    p_accept: accept,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Eine eigene, noch offene Anfrage zurückziehen. */
export async function cancelFriendRequest(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: id.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cancel_friend_request", { p_id: id.data });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Freundschaft beenden: beide verlieren den Zugriff auf das Dorf der anderen Person. */
export async function removeFriend(_: ActionState, formData: FormData): Promise<ActionState> {
  const other = idSchema.safeParse(formData.get("otherId"));
  if (!other.success) return { error: other.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("remove_friend", { p_other: other.data });
  if (error) return { error: "Die Freundschaft konnte nicht beendet werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

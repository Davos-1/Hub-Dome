"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { FRIEND_LINK_DAYS, friendLinkSchema, friendTokenFrom } from "@/lib/friend-links";
import { generateToken, hashToken } from "@/lib/tokens";
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

/** Freundschaftslink erzeugen (7 Tage, 1–100 Personen). Der Klartext steht nur in dieser Antwort. */
export async function createFriendLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = friendLinkSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const token = generateToken();
  const { error } = await supabase.from("friend_links").insert({
    owner_id: user.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + FRIEND_LINK_DAYS * 864e5).toISOString(),
    max_uses: parsed.data.maxUses,
  });
  if (error) return { error: "Der Freundschaftslink konnte nicht erstellt werden." };
  const base = await siteUrl();
  revalidatePath("/", "layout");
  return { ok: true, inviteUrl: `${base}/freund/${token}` };
}

/** Freundschaftslink widerrufen. */
export async function deleteFriendLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: id.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("friend_links").delete().eq("id", id.data);
  if (error) return { error: "Der Freundschaftslink konnte nicht widerrufen werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Freundschaftslink annehmen und direkt in das Dorf der anderen Person reisen. */
export async function acceptFriendLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = friendTokenFrom(String(formData.get("token") ?? ""));
  if (!token) return { error: "Dieser Freundschaftslink ist ungültig." };
  const { supabase } = await requireUser();
  const { data: username, error } = await supabase.rpc("accept_friend_link", { p_token: token });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(typeof username === "string" ? `/dorf/${username}` : "/start");
}

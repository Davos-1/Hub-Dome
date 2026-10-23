"use server";

import { z } from "zod";
import { raisedMessage, refreshAll } from "@/lib/action-utils";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { generateMcpToken, hashMcpToken } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";
import { firstIssue, uuidSchema } from "@/lib/validation";

const labelSchema = z
  .string()
  .trim()
  .max(40, "Maximal 40 Zeichen.")
  .transform((s) => s || "Claude");
const idSchema = uuidSchema("Ungültiges Token.");

/** Connector-Token erzeugen. Die fertige Connector-URL steht nur in dieser Antwort (Klartext wird nie gespeichert). */
export async function createMcpToken(_: ActionState, formData: FormData): Promise<ActionState> {
  const label = labelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) return { error: firstIssue(label.error) };
  const { supabase, user } = await requireUser();
  const token = generateMcpToken();
  const { error } = await supabase
    .from("mcp_tokens")
    .insert({ user_id: user.id, token_hash: hashMcpToken(token), label: label.data });
  // Das Limit von 5 aktiven Tokens meldet der Trigger `mcp_tokens_limit` selbst.
  if (error) return { error: raisedMessage(error, "Das Token konnte nicht erstellt werden.") };
  const base = await siteUrl();
  refreshAll();
  return { ok: true, inviteUrl: `${base}/api/mcp/${token}` };
}

/** Connector-Token widerrufen: der Connector funktioniert danach sofort nicht mehr. */
export async function revokeMcpToken(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: firstIssue(id.error) };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("mcp_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Das Token konnte nicht widerrufen werden." };
  refreshAll();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { generateMcpToken, hashMcpToken } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";

const labelSchema = z
  .string()
  .trim()
  .max(40, "Maximal 40 Zeichen.")
  .transform((s) => s || "Claude");
const idSchema = z.uuid({ message: "Ungültiges Token." });

/** Connector-Token erzeugen. Die fertige Connector-URL steht nur in dieser Antwort (Klartext wird nie gespeichert). */
export async function createMcpToken(_: ActionState, formData: FormData): Promise<ActionState> {
  const label = labelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) return { error: label.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const token = generateMcpToken();
  const { error } = await supabase
    .from("mcp_tokens")
    .insert({ user_id: user.id, token_hash: hashMcpToken(token), label: label.data });
  if (error) {
    return {
      error: error.message.includes("5 aktive")
        ? error.message
        : "Das Token konnte nicht erstellt werden.",
    };
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  revalidatePath("/", "layout");
  return { ok: true, inviteUrl: `${base}/api/mcp/${token}` };
}

/** Connector-Token widerrufen: der Connector funktioniert danach sofort nicht mehr. */
export async function revokeMcpToken(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: id.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("mcp_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return { error: "Das Token konnte nicht widerrufen werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

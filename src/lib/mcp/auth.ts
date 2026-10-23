import type { SupabaseClient } from "@supabase/supabase-js";
import { hashMcpToken, MCP_TOKEN_PATTERN } from "@/lib/tokens";

/** Aufrufe (tools/call) pro Token und Stunde. */
export const RATE_LIMIT_PER_HOUR = 60;

type McpIdentity = { tokenId: string; userId: string };

/**
 * Prüft ein Connector-Token: Format, Hash (HMAC mit Pepper) und nicht widerrufen. Gibt die Identität des
 * Besitzers zurück oder `null`. `last_used_at` wird höchstens einmal pro Minute geschrieben.
 */
export async function authenticateToken(
  db: SupabaseClient,
  token: string,
): Promise<McpIdentity | null> {
  if (!MCP_TOKEN_PATTERN.test(token)) return null;
  const { data } = await db
    .from("mcp_tokens")
    .select("id, user_id, last_used_at")
    .eq("token_hash", hashMcpToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  const last = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - last > 60_000) {
    await db
      .from("mcp_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", data.user_id);
  }
  return { tokenId: data.id, userId: data.user_id };
}

/** Zählt einen Aufruf und sagt, ob das Limit überschritten ist. */
export async function hitRateLimit(
  db: SupabaseClient,
  tokenId: string,
): Promise<{ allowed: boolean; calls: number }> {
  const { data, error } = await db.rpc("mcp_hit", { p_token: tokenId });
  // Bei einem Fehler im Zähler lieber durchlassen als alle Aufrufe zu blockieren
  if (error || typeof data !== "number") return { allowed: true, calls: 0 };
  return { allowed: data <= RATE_LIMIT_PER_HOUR, calls: data };
}

/** Enthält die JSON-RPC-Nachricht (oder der Stapel) einen Werkzeugaufruf? Nur diese zählen fürs Limit. */
export function countsAsCall(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (m) =>
      typeof m === "object" && m !== null && (m as { method?: unknown }).method === "tools/call",
  );
}

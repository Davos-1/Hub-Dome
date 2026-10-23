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

/**
 * Zählt `calls` Aufrufe und sagt, ob das Limit überschritten ist. Bricht ab, sobald es erreicht ist,
 * damit ein grosser Stapel nicht beliebig viele Zählerschritte auslöst.
 */
export async function hitRateLimit(
  db: SupabaseClient,
  tokenId: string,
  calls = 1,
): Promise<{ allowed: boolean; calls: number }> {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    const { data, error } = await db.rpc("mcp_hit", { p_token: tokenId });
    // Bei einem Fehler im Zähler lieber durchlassen als alle Aufrufe zu blockieren
    if (error || typeof data !== "number") {
      console.error("mcp_hit fehlgeschlagen", error?.code, error?.message);
      return { allowed: true, calls: total };
    }
    total = data;
    if (total > RATE_LIMIT_PER_HOUR) return { allowed: false, calls: total };
  }
  return { allowed: true, calls: total };
}

/** Anzahl Werkzeugaufrufe (tools/call) in der JSON-RPC-Nachricht oder im Stapel. Nur diese zählen fürs Limit. */
export function countCalls(body: unknown): number {
  const messages = Array.isArray(body) ? body : [body];
  return messages.filter(
    (m) =>
      typeof m === "object" && m !== null && (m as { method?: unknown }).method === "tools/call",
  ).length;
}

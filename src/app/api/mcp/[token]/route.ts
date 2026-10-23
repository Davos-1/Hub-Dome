import { after } from "next/server";
import { authenticateToken, countCalls, hitRateLimit, RATE_LIMIT_PER_HOUR } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { refreshArtifactMeta } from "@/lib/previews.server";
import { envSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/** Maximale Grösse einer Anfrage (Schutz vor Missbrauch). */
const MAX_BODY_BYTES = 256 * 1024;

const rpcError = (status: number, code: number, message: string, headers: HeadersInit = {}) =>
  Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers });

/**
 * MCP-Endpunkt (Streamable HTTP, zustandslos): `POST /api/mcp/<token>`. Das persönliche Token im Pfad
 * bestimmt den Besitzer; alle Zugriffe laufen danach nur auf dessen Daten (siehe `src/lib/mcp/tools.ts`).
 */
export async function POST(request: Request, { params }: RouteContext<"/api/mcp/[token]">) {
  const { token } = await params;
  const db = createAdminClient();

  const identity = await authenticateToken(db, token);
  if (!identity) return rpcError(401, -32001, "Ungültiges oder widerrufenes Token.");

  // Zuerst die angegebene Länge prüfen (liest nichts), danach die tatsächlichen Bytes
  const tooLarge = () => rpcError(413, -32600, "Anfrage zu gross.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return tooLarge();
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return tooLarge();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(400, -32700, "Ungültiges JSON.");
  }

  const calls = countCalls(body);
  if (calls > 0) {
    const { allowed } = await hitRateLimit(db, identity.tokenId, calls);
    if (!allowed) {
      return rpcError(
        429,
        -32002,
        `Zu viele Aufrufe (höchstens ${RATE_LIMIT_PER_HOUR} pro Stunde). Versuche es später erneut.`,
        { "Retry-After": "3600" },
      );
    }
  }

  return handleMcpRequest(
    request,
    {
      db,
      userId: identity.userId,
      siteUrl: envSiteUrl(),
      afterPlace: (id) => after(() => refreshArtifactMeta(id, identity.userId)),
    },
    body,
  );
}

// Zustandsloser Server: kein Server-Stream und keine Sitzungen
const notAllowed = () => rpcError(405, -32000, "Nur POST wird unterstützt.", { Allow: "POST" });
export const GET = notAllowed;
export const DELETE = notAllowed;

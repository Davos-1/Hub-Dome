import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  createHouse,
  createHouseInputShape,
  listHouses,
  placeArtifact,
  placeInputShape,
  recentArtifacts,
  recentInputShape,
  type McpContext,
  type ToolResult,
} from "./tools";

const asContent = (r: ToolResult) => ({
  content: [{ type: "text" as const, text: r.text }],
  ...(r.data !== undefined ? { structuredContent: r.data as Record<string, unknown> } : {}),
  isError: !r.ok,
});

const PLACE_DESCRIPTION =
  "Platziert einen Link in einem Haus des Hub-Dome-Dorfs des Users (Claude-Artifact, GitHub-Repo, Gist, Cloud-Ordner oder Website). " +
  "Gib haus_id oder haus_titel aus dorf_haeuser_auflisten an. Existiert die URL schon im Dorf, wird der Eintrag aktualisiert statt doppelt angelegt. " +
  "Bei unbekanntem Haus gibt es einen Fehler mit den vorhandenen Häusern (es wird nichts automatisch angelegt).";

/** Baut den MCP-Server für genau einen Aufruf; `ctx` enthält die Identität des Token-Besitzers. */
function buildMcpServer(ctx: McpContext) {
  const server = new McpServer({ name: "hub-dome", version: "1.0.0" });

  server.registerTool(
    "dorf_haeuser_auflisten",
    {
      title: "Häuser des Dorfs auflisten",
      description:
        "Liefert die Häuser im Hub-Dome-Dorf des Users (id, Titel, Art, Anzahl Objekte) und den Link zum Dorf. Zuerst aufrufen, bevor etwas platziert wird.",
      annotations: { readOnlyHint: true },
    },
    async () => asContent(await listHouses(ctx)),
  );

  server.registerTool(
    "artifact_platzieren",
    {
      title: "Artifact platzieren",
      description: PLACE_DESCRIPTION,
      inputSchema: placeInputShape,
      annotations: { idempotentHint: true },
    },
    async (args) => asContent(await placeArtifact(ctx, args)),
  );

  server.registerTool(
    "objekt_platzieren",
    {
      title: "Objekt platzieren",
      description:
        "Platziert einen Link (Claude-Artifact, GitHub-Repo, Gist, Cloud-Ordner, Website) in einem Haus des Dorfs. Gleiche Wirkung wie artifact_platzieren, mit neutraler Beschreibung. " +
        "Haus per haus_id oder haus_titel aus dorf_haeuser_auflisten.",
      inputSchema: placeInputShape,
      annotations: { idempotentHint: true },
    },
    async (args) => asContent(await placeArtifact(ctx, args)),
  );

  server.registerTool(
    "haus_erstellen",
    {
      title: "Haus erstellen",
      description:
        "Legt ein Haus im Dorf an: ein Modulhaus (mit modul_code aus dem Katalog) oder ein Themenhaus (ohne Code). Nur auf ausdrücklichen Wunsch des Users nutzen.",
      inputSchema: createHouseInputShape,
    },
    async (args) => asContent(await createHouse(ctx, args)),
  );

  server.registerTool(
    "letzte_artifacts",
    {
      title: "Zuletzt platzierte Objekte",
      description: "Die zuletzt platzierten Objekte des Users (höchstens 20).",
      inputSchema: recentInputShape,
      annotations: { readOnlyHint: true },
    },
    async (args) => asContent(await recentArtifacts(ctx, args)),
  );

  return server;
}

/**
 * Beantwortet eine MCP-Anfrage (Streamable HTTP, ohne Sitzung, JSON-Antworten). `parsedBody` kann übergeben
 * werden, wenn der Body schon gelesen wurde.
 */
export async function handleMcpRequest(
  request: Request,
  ctx: McpContext,
  parsedBody?: unknown,
): Promise<Response> {
  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, { parsedBody });
  } finally {
    // Antwort ist fertig (JSON-Modus); Ressourcen freigeben
    void transport.close();
  }
}

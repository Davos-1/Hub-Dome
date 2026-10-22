import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authenticateToken, countsAsCall, hitRateLimit, RATE_LIMIT_PER_HOUR } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import {
  createHouse,
  listHouses,
  placeArtifact,
  recentArtifacts,
  type McpContext,
} from "@/lib/mcp/tools";
import { generateMcpToken, hashMcpToken } from "@/lib/tokens";

// Integrationstests des MCP-Connectors gegen das echte Supabase-Projekt (Service Role wie im Betrieb).
// Besonders wichtig: jede Aktion wirkt nur auf Daten des Token-Besitzers.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);

const run = randomBytes(3).toString("hex");
const password = randomBytes(16).toString("hex");

type TestUser = { id: string; client: SupabaseClient; username: string; villageId: string };

async function makeUser(tag: string): Promise<TestUser> {
  const email = `mcp-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(url, publishableKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const username = `mcp_${tag}_${run}`;
  const { data: villageId, error: obErr } = await client.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: `Mcp ${tag}`,
  });
  if (obErr) throw obErr;
  return { id: data.user.id, client, username, villageId };
}

let a: TestUser;
let b: TestUser;
let houseA: string;
let houseA2: string;
let houseB: string;
const ids: string[] = [];
const placed: string[] = [];

const ctxFor = (u: TestUser): McpContext => ({
  db: admin,
  userId: u.id,
  siteUrl: "https://hub.example",
  afterPlace: (id) => placed.push(id),
});

beforeAll(async () => {
  [a, b] = await Promise.all([makeUser("a"), makeUser("b")]);
  ids.push(a.id, b.id);
  const mk = async (u: TestUser, title: string) => {
    const { data, error } = await u.client
      .from("houses")
      .insert({ village_id: u.villageId, kind: "thema", title })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  };
  houseA = await mk(a, "Python");
  houseA2 = await mk(a, "Statistik");
  houseB = await mk(b, "Fremdes Haus");
}, 60_000);

afterAll(async () => {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
});

async function makeToken(u: TestUser, revoke = false) {
  const token = generateMcpToken();
  const { data, error } = await u.client
    .from("mcp_tokens")
    .insert({ user_id: u.id, token_hash: hashMcpToken(token), label: "Test" })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (revoke) {
    await u.client
      .from("mcp_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data!.id);
  }
  return { token, id: data!.id as string };
}

describe("Token-Prüfung", () => {
  it("gültiges Token ergibt die Identität des Besitzers", async () => {
    const { token, id } = await makeToken(a);
    expect(await authenticateToken(admin, token)).toEqual({ tokenId: id, userId: a.id });
    const row = await admin.from("mcp_tokens").select("last_used_at").eq("id", id).single();
    expect(row.data?.last_used_at).not.toBeNull();
  });
  it("widerrufene, unbekannte und falsch geformte Tokens werden abgelehnt", async () => {
    const { token } = await makeToken(a, true);
    expect(await authenticateToken(admin, token)).toBeNull();
    expect(await authenticateToken(admin, generateMcpToken())).toBeNull();
    expect(await authenticateToken(admin, "falsch")).toBeNull();
    expect(await authenticateToken(admin, "")).toBeNull();
  });
  it("im Klartext oder mit anderem Pepper gespeicherte Tokens funktionieren nicht", async () => {
    const token = generateMcpToken();
    await a.client
      .from("mcp_tokens")
      .insert({ user_id: a.id, token_hash: token, label: "Klartext" });
    expect(await authenticateToken(admin, token)).toBeNull();
  });
  it("Fremde sehen die Tokens anderer nicht", async () => {
    await makeToken(a);
    expect((await b.client.from("mcp_tokens").select("id")).data).toEqual([]);
  });
  it("Nutzer können Tokens nicht für andere anlegen", async () => {
    const { error } = await b.client
      .from("mcp_tokens")
      .insert({ user_id: a.id, token_hash: hashMcpToken(generateMcpToken()), label: "Fake" });
    expect(error).not.toBeNull();
  });
});

describe("Platzieren nur im eigenen Dorf", () => {
  it("lehnt ein Haus eines anderen Nutzers ab und schreibt nichts", async () => {
    const r = await placeArtifact(ctxFor(a), {
      url: "https://claude.ai/artifact/fremd1",
      titel: "Eindringling",
      haus_id: houseB,
    });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("gehört nicht zu deinem Dorf");
    const rows = await admin
      .from("artifacts")
      .select("id")
      .eq("url", "https://claude.ai/artifact/fremd1");
    expect(rows.data).toEqual([]);
  });

  it("unbekannter Haustitel: Fehler mit der Liste der vorhandenen Häuser, kein automatisches Anlegen", async () => {
    const r = await placeArtifact(ctxFor(a), {
      url: "https://claude.ai/artifact/x2",
      titel: "X",
      haus_titel: "Gibt es nicht",
    });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("«Python»");
    expect(r.text).toContain("«Statistik»");
    expect(r.text).not.toContain("Fremdes Haus");
    const houses = await admin
      .from("houses")
      .select("id")
      .eq("village_id", a.villageId)
      .eq("title", "Gibt es nicht");
    expect(houses.data).toEqual([]);
  });

  it("ohne Haus kommt ein Fehler", async () => {
    const r = await placeArtifact(ctxFor(a), { url: "https://claude.ai/artifact/x3", titel: "X" });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("haus_id oder haus_titel");
  });

  it("platziert per Haustitel (ohne Beachtung der Gross-/Kleinschreibung) für den Token-Besitzer", async () => {
    const r = await placeArtifact(ctxFor(a), {
      url: "https://claude.ai/artifact/ok1",
      titel: "Regression",
      beschreibung: "Eine Regression erklärt.",
      typ: "rechner",
      tags: ["statistik", "regression"],
      haus_titel: "statistik",
    });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("https://hub.example/dorf/" + a.username);
    expect(r.text).toContain("Jeder mit dem Link");
    const row = await admin
      .from("artifacts")
      .select("owner_id, house_id, kind, item_type, tags, visibility")
      .eq("url", "https://claude.ai/artifact/ok1")
      .single();
    expect(row.data).toEqual({
      owner_id: a.id,
      house_id: houseA2,
      kind: "rechner",
      item_type: "claude_artifact",
      tags: ["statistik", "regression"],
      visibility: "shared",
    });
    expect(placed).toHaveLength(1);
  });

  it("gleiche URL aktualisiert den Eintrag statt zu duplizieren (auch Haus und Sichtbarkeit)", async () => {
    const first = await admin
      .from("artifacts")
      .select("id")
      .eq("url", "https://claude.ai/artifact/ok1")
      .single();
    const r = await placeArtifact(ctxFor(a), {
      url: "https://claude.ai/artifact/ok1",
      titel: "Regression 2",
      haus_id: houseA,
      sichtbarkeit: "private",
    });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Aktualisiert");
    expect(r.text).not.toContain("Jeder mit dem Link");
    const rows = await admin
      .from("artifacts")
      .select("id, title, house_id, visibility")
      .eq("url", "https://claude.ai/artifact/ok1");
    expect(rows.data).toEqual([
      { id: first.data!.id, title: "Regression 2", house_id: houseA, visibility: "private" },
    ]);
  });

  it("dieselbe URL bei einem anderen Nutzer ist ein eigener Eintrag und berührt den ersten nicht", async () => {
    const r = await placeArtifact(ctxFor(b), {
      url: "https://claude.ai/artifact/ok1",
      titel: "Von B",
      haus_id: houseB,
    });
    expect(r.ok).toBe(true);
    const rows = await admin
      .from("artifacts")
      .select("owner_id, title")
      .eq("url", "https://claude.ai/artifact/ok1");
    expect(rows.data!.sort((x, y) => x.title.localeCompare(y.title))).toEqual([
      { owner_id: a.id, title: "Regression 2" },
      { owner_id: b.id, title: "Von B" },
    ]);
  });

  it("GitHub-Repo wird automatisch erkannt; ungültige Typ/URL-Kombinationen werden abgelehnt", async () => {
    const ok = await placeArtifact(ctxFor(a), {
      url: "https://github.com/octocat/Hello-World",
      titel: "Hello World",
      haus_id: houseA,
    });
    expect(ok.ok).toBe(true);
    const row = await admin
      .from("artifacts")
      .select("item_type")
      .eq("owner_id", a.id)
      .eq("url", "https://github.com/octocat/Hello-World")
      .single();
    expect(row.data?.item_type).toBe("github_repo");

    const wrong = await placeArtifact(ctxFor(a), {
      url: "https://claude.ai/artifact/zz",
      titel: "Falsch",
      haus_id: houseA,
      objekt_typ: "github_repo",
    });
    expect(wrong.ok).toBe(false);
    expect(wrong.text).toContain("passt nicht zum gewählten Objekttyp");
    const http = await placeArtifact(ctxFor(a), {
      url: "http://example.com",
      titel: "Unsicher",
      haus_id: houseA,
    });
    expect(http.ok).toBe(false);
  });

  it("Eingaben werden validiert (Titel, Tags, Kategorie)", async () => {
    const base = { url: "https://example.com/v", haus_id: houseA };
    expect((await placeArtifact(ctxFor(a), { ...base, titel: "" })).ok).toBe(false);
    expect((await placeArtifact(ctxFor(a), { ...base, titel: "x".repeat(121) })).ok).toBe(false);
    expect((await placeArtifact(ctxFor(a), { ...base, titel: "T", typ: "unsinn" })).ok).toBe(false);
    expect(
      (
        await placeArtifact(ctxFor(a), {
          ...base,
          titel: "T",
          tags: ["a", "b", "c", "d", "e", "f"],
        })
      ).ok,
    ).toBe(false);
  });
});

describe("Häuser auflisten, erstellen und letzte Objekte", () => {
  it("zeigt nur eigene Häuser mit Anzahl", async () => {
    const r = await listHouses(ctxFor(a));
    expect(r.ok).toBe(true);
    const houses = (r.data as { haeuser: { id: string; titel: string; anzahl_objekte: number }[] })
      .haeuser;
    const titles = houses.map((h) => h.titel);
    expect(titles).toContain("Zentrale");
    expect(titles).toContain("Python");
    expect(titles).not.toContain("Fremdes Haus");
    expect(houses.find((h) => h.id === houseA)!.anzahl_objekte).toBeGreaterThan(0);
  });

  it("legt Themenhaus und Modulhaus an, lehnt Doppelte und unbekannte Codes ab", async () => {
    const t = await createHouse(ctxFor(a), { titel: "Neues Thema" });
    expect(t.ok).toBe(true);
    expect((await createHouse(ctxFor(a), { titel: "neues thema" })).ok).toBe(false);
    expect((await createHouse(ctxFor(a), { titel: "X", modul_code: "GIBT.ES_NICHT" })).ok).toBe(
      false,
    );
    const m = await createHouse(ctxFor(a), { titel: "Baustoffe", modul_code: "TA.BA_BS" });
    expect(m.ok).toBe(true);
    expect(
      (await createHouse(ctxFor(a), { titel: "Noch ein Baustoffe", modul_code: "TA.BA_BS" })).ok,
    ).toBe(false);
    const rows = await admin
      .from("houses")
      .select("village_id, kind")
      .eq("village_id", a.villageId)
      .in("title", ["Neues Thema", "Baustoffe"]);
    expect(rows.data!.map((h) => h.kind).sort()).toEqual(["modul", "thema"]);
  });

  it("letzte_artifacts zeigt nur eigene Objekte, begrenzt auf die gewünschte Anzahl", async () => {
    const r = await recentArtifacts(ctxFor(a), { anzahl: 2 });
    expect(r.ok).toBe(true);
    const items = (r.data as { objekte: { titel: string }[] }).objekte;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.titel)).not.toContain("Von B");
    expect((await recentArtifacts(ctxFor(a), { anzahl: 21 })).ok).toBe(false);
  });
});

describe("MCP-Protokoll (Streamable HTTP)", () => {
  const call = async (u: TestUser, body: unknown) => {
    const req = new Request("https://hub.example/api/mcp/x", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    });
    const res = await handleMcpRequest(req, ctxFor(u), body);
    return { res, json: await res.json() };
  };
  const init = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    },
  };

  it("initialize und tools/list liefern die fünf Tools mit deutschen Beschreibungen", async () => {
    const { json } = await call(a, init);
    expect(json.result.serverInfo.name).toBe("hub-dome");
    const list = await call(a, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = list.json.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(
      [
        "artifact_platzieren",
        "dorf_haeuser_auflisten",
        "haus_erstellen",
        "letzte_artifacts",
        "objekt_platzieren",
      ].sort(),
    );
    const place = list.json.result.tools.find(
      (t: { name: string }) => t.name === "artifact_platzieren",
    );
    expect(place.description).toContain("Haus");
    expect(Object.keys(place.inputSchema.properties)).toEqual(
      expect.arrayContaining([
        "url",
        "titel",
        "haus_id",
        "haus_titel",
        "typ",
        "objekt_typ",
        "tags",
        "sichtbarkeit",
      ]),
    );
  });

  it("tools/call platziert ein Objekt über objekt_platzieren (GitHub) und liefert den Dorf-Link", async () => {
    const { json } = await call(a, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "objekt_platzieren",
        arguments: {
          url: "https://gist.github.com/octocat/6cad326836d38bd3a7ae",
          titel: "Gist",
          haus_id: houseA,
        },
      },
    });
    expect(json.result.isError).toBe(false);
    expect(json.result.content[0].text).toContain("https://hub.example/dorf/" + a.username);
    const row = await admin
      .from("artifacts")
      .select("item_type, owner_id")
      .eq("url", "https://gist.github.com/octocat/6cad326836d38bd3a7ae")
      .single();
    expect(row.data).toEqual({ item_type: "gist", owner_id: a.id });
  });

  it("Fehler werden als isError mit deutscher Meldung zurückgegeben", async () => {
    const { json } = await call(a, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "artifact_platzieren",
        arguments: { url: "https://claude.ai/artifact/q", titel: "Q", haus_id: houseB },
      },
    });
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain("gehört nicht zu deinem Dorf");
  });

  it("nur tools/call zählt fürs Limit", () => {
    expect(countsAsCall({ method: "tools/call" })).toBe(true);
    expect(countsAsCall([{ method: "tools/list" }, { method: "tools/call" }])).toBe(true);
    expect(countsAsCall({ method: "initialize" })).toBe(false);
    expect(countsAsCall("x")).toBe(false);
    expect(countsAsCall(null)).toBe(false);
  });
});

describe("Rate-Limit und Token-Grenze", () => {
  it("zählt Aufrufe pro Token und blockiert über dem Limit", async () => {
    const { id } = await makeToken(b);
    for (let i = 1; i <= 3; i++) {
      expect(await hitRateLimit(admin, id)).toEqual({ allowed: true, calls: i });
    }
    // Zähler direkt auf das Limit setzen (schneller als 60 Aufrufe)
    await admin.from("mcp_rate").update({ calls: RATE_LIMIT_PER_HOUR }).eq("token_id", id);
    expect((await hitRateLimit(admin, id)).allowed).toBe(false);
  });

  it("Clients können den Zähler weder lesen noch ändern", async () => {
    expect((await a.client.from("mcp_rate").select("calls")).data ?? []).toEqual([]);
    const { error } = await a.client.rpc("mcp_hit", {
      p_token: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
  });

  it("höchstens 5 aktive Tokens pro Person", async () => {
    const c = await makeUser("c");
    ids.push(c.id);
    for (let i = 0; i < 5; i++) await makeToken(c);
    const { error } = await c.client
      .from("mcp_tokens")
      .insert({ user_id: c.id, token_hash: hashMcpToken(generateMcpToken()), label: "Sechstes" });
    expect(error?.message).toContain("5 aktive");
  });
});

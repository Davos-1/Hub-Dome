import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// RLS-Integrationstests gegen das echte Supabase-Projekt (.env.local).
// Es werden temporäre Testuser angelegt und am Ende samt Daten gelöscht.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const run = randomBytes(3).toString("hex");
const password = randomBytes(16).toString("hex");

type TestUser = { id: string; client: SupabaseClient; username: string; villageId: string };

async function makeUser(tag: string): Promise<TestUser> {
  const email = `rls-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(url, publishableKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const username = `rls_${tag}_${run}`;
  const { data: villageId, error: obErr } = await client.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: `Test ${tag}`,
  });
  if (obErr) throw obErr;
  return { id: data.user.id, client, username, villageId };
}

let a: TestUser;
let b: TestUser;
let c: TestUser;
let houseA: string;
let sharedArtifact: string;
let privateArtifact: string;
const userIds: string[] = [];

beforeAll(async () => {
  [a, b, c] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);
  userIds.push(a.id, b.id, c.id);

  const house = await a.client
    .from("houses")
    .insert({ village_id: a.villageId, kind: "thema", title: "Testhaus" })
    .select()
    .single();
  expect(house.error).toBeNull();
  houseA = house.data!.id;

  const shared = await a.client
    .from("artifacts")
    .insert({ house_id: houseA, owner_id: a.id, url: "https://claude.ai/a/1", title: "Geteilt" })
    .select()
    .single();
  const priv = await a.client
    .from("artifacts")
    .insert({
      house_id: houseA,
      owner_id: a.id,
      url: "https://claude.ai/a/2",
      title: "Privat",
      visibility: "private",
    })
    .select()
    .single();
  expect(shared.error).toBeNull();
  expect(priv.error).toBeNull();
  sharedArtifact = shared.data!.id;
  privateArtifact = priv.data!.id;
}, 60_000);

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

async function invite(maxUses = 1, expiresInMs = 7 * 864e5) {
  const token = randomBytes(32).toString("base64url");
  const { error } = await a.client.from("invites").insert({
    village_id: a.villageId,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    max_uses: maxUses,
  });
  expect(error).toBeNull();
  return token;
}

describe("Onboarding", () => {
  it("legt Dorf und genau eine Zentrale an", async () => {
    const { data } = await a.client.from("houses").select("kind").eq("village_id", a.villageId);
    expect(data!.filter((h) => h.kind === "zentrale")).toHaveLength(1);
  });
  it("lehnt vergebenen Benutzernamen ab", async () => {
    const { error } = await b.client.rpc("complete_onboarding", {
      p_username: a.username,
      p_display_name: "X",
    });
    expect(error?.message).toContain("bereits vergeben");
  });
  it("Zentrale kann nicht manuell doppelt angelegt oder gelöscht werden", async () => {
    const dup = await a.client
      .from("houses")
      .insert({ village_id: a.villageId, kind: "zentrale", title: "Zweite" });
    expect(dup.error).not.toBeNull();
    const del = await a.client
      .from("houses")
      .delete()
      .eq("village_id", a.villageId)
      .eq("kind", "zentrale")
      .select();
    expect(del.data).toEqual([]);
  });
});

describe("Fremder User ohne Freigabe", () => {
  it("sieht weder Dorf, Häuser noch Artifacts", async () => {
    for (const table of ["villages", "houses", "artifacts", "village_access"]) {
      const { data, error } = await c.client
        .from(table)
        .select("*")
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (table === "village_access") continue;
      expect(error).toBeNull();
      expect(data!.every((r: { owner_id?: string; id: string }) => r.id !== undefined)).toBe(true);
      expect(data!.some((r: { owner_id?: string }) => r.owner_id === a.id)).toBe(false);
    }
    const art = await c.client.from("artifacts").select("id").eq("id", sharedArtifact);
    expect(art.data).toEqual([]);
    const hs = await c.client.from("houses").select("id").eq("village_id", a.villageId);
    expect(hs.data).toEqual([]);
  });
  it("kann nichts in fremde Häuser schreiben", async () => {
    const { error } = await c.client
      .from("artifacts")
      .insert({ house_id: houseA, owner_id: c.id, url: "https://claude.ai/c/1", title: "Hack" });
    expect(error).not.toBeNull();
    const asOwner = await c.client
      .from("artifacts")
      .insert({ house_id: houseA, owner_id: a.id, url: "https://claude.ai/c/2", title: "Hack" });
    expect(asOwner.error).not.toBeNull();
  });
  it("kann Einladungen und MCP-Tokens anderer nicht sehen", async () => {
    await invite();
    await a.client.from("mcp_tokens").insert({ user_id: a.id, token_hash: sha256(run) });
    expect((await c.client.from("invites").select("id")).data).toEqual([]);
    expect((await c.client.from("mcp_tokens").select("id")).data).toEqual([]);
  });
  it("anon sieht nichts", async () => {
    const anon = createClient(url, publishableKey, opts);
    const { data } = await anon.from("artifacts").select("id");
    expect(data ?? []).toEqual([]);
    const p = await anon.from("profiles").select("id");
    expect(p.data ?? []).toEqual([]);
  });
});

describe("Einladung und Freigabe", () => {
  let token: string;
  it("B ohne Freigabe sieht nichts", async () => {
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
  });
  it("B kann sich nicht selbst in village_access eintragen", async () => {
    const { error } = await b.client
      .from("village_access")
      .insert({ village_id: a.villageId, viewer_id: b.id });
    expect(error).not.toBeNull();
  });
  it("Besitzer kann sich nicht selbst einladen", async () => {
    token = await invite();
    const { error } = await a.client.rpc("accept_invite", { p_token: token });
    expect(error?.message).toContain("selbst einladen");
  });
  it("ungültiges Token wird abgelehnt", async () => {
    const { error } = await b.client.rpc("accept_invite", { p_token: "falsch" });
    expect(error?.message).toContain("ungültig");
  });
  it("B nimmt Einladung an und sieht geteilte, aber keine privaten Artifacts", async () => {
    const { error } = await b.client.rpc("accept_invite", { p_token: token });
    expect(error).toBeNull();
    const { data } = await b.client.from("artifacts").select("id").eq("owner_id", a.id);
    const ids = data!.map((r) => r.id);
    expect(ids).toContain(sharedArtifact);
    expect(ids).not.toContain(privateArtifact);
    expect((await b.client.from("villages").select("id").eq("id", a.villageId)).data).toHaveLength(
      1,
    );
    expect(
      (await b.client.from("houses").select("id").eq("village_id", a.villageId)).data!.length,
    ).toBeGreaterThan(0);
  });
  it("Einladung mit max_uses=1 ist danach aufgebraucht", async () => {
    const { error } = await c.client.rpc("accept_invite", { p_token: token });
    expect(error?.message).toContain("aufgebraucht");
  });
  it("abgelaufene Einladung wird abgelehnt", async () => {
    const expired = await invite(1, -1000);
    const { error } = await c.client.rpc("accept_invite", { p_token: expired });
    expect(error?.message).toContain("abgelaufen");
  });
  it("Viewer B kann fremde Daten nicht ändern oder löschen", async () => {
    const upd = await b.client
      .from("artifacts")
      .update({ title: "Gehackt" })
      .eq("id", sharedArtifact)
      .select();
    expect(upd.data).toEqual([]);
    const del = await b.client.from("artifacts").delete().eq("id", sharedArtifact).select();
    expect(del.data).toEqual([]);
    const hs = await b.client.from("houses").update({ title: "X" }).eq("id", houseA).select();
    expect(hs.data).toEqual([]);
    const ins = await b.client
      .from("artifacts")
      .insert({ house_id: houseA, owner_id: b.id, url: "https://claude.ai/b/1", title: "X" });
    expect(ins.error).not.toBeNull();
  });
  it("Besitzer entzieht den Zugriff, B sieht danach nichts mehr", async () => {
    const del = await a.client.from("village_access").delete().eq("viewer_id", b.id).select();
    expect(del.data).toHaveLength(1);
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
    expect((await b.client.from("villages").select("id").eq("id", a.villageId)).data).toEqual([]);
  });
  it("Viewer kann das Dorf selbst verlassen", async () => {
    const t = await invite();
    expect((await b.client.rpc("accept_invite", { p_token: t })).error).toBeNull();
    const del = await b.client.from("village_access").delete().eq("viewer_id", b.id).select();
    expect(del.data).toHaveLength(1);
  });
});

describe("Daten-Validierung und Profile", () => {
  it("nur claude.ai-URLs", async () => {
    const { error } = await a.client
      .from("artifacts")
      .insert({ house_id: houseA, owner_id: a.id, url: "https://evil.com/claude.ai/", title: "X" });
    expect(error).not.toBeNull();
  });
  it("Objekttypen: bestehende Einträge sind claude_artifact, URL muss zum Typ passen", async () => {
    const { data } = await a.client
      .from("artifacts")
      .select("item_type")
      .eq("id", sharedArtifact)
      .single();
    expect(data?.item_type).toBe("claude_artifact");

    const ok = await a.client.from("artifacts").insert({
      house_id: houseA,
      owner_id: a.id,
      url: "https://github.com/octocat/Hello-World",
      title: "Repo",
      item_type: "github_repo",
    });
    expect(ok.error).toBeNull();

    const wrong1 = await a.client.from("artifacts").insert({
      house_id: houseA,
      owner_id: a.id,
      url: "https://claude.ai/x/9",
      title: "X",
      item_type: "github_repo",
    });
    expect(wrong1.error).not.toBeNull();
    const wrong2 = await a.client.from("artifacts").insert({
      house_id: houseA,
      owner_id: a.id,
      url: "https://github.com/a/b",
      title: "X",
      item_type: "claude_artifact",
    });
    expect(wrong2.error).not.toBeNull();
    const http = await a.client.from("artifacts").insert({
      house_id: houseA,
      owner_id: a.id,
      url: "http://example.com",
      title: "X",
      item_type: "link",
    });
    expect(http.error).not.toBeNull();
  });
  it("github_repo-Objekte unterliegen derselben Freigabe (Viewer ohne Zugriff sieht nichts)", async () => {
    const { data } = await c.client.from("artifacts").select("id").eq("item_type", "github_repo");
    expect(data).toEqual([]);
  });
  it("doppelte URL pro Besitzer wird abgelehnt", async () => {
    const { error } = await a.client
      .from("artifacts")
      .insert({ house_id: houseA, owner_id: a.id, url: "https://claude.ai/a/1", title: "Dupe" });
    expect(error).not.toBeNull();
  });
  it("Profile sind für Eingeloggte lesbar, onboarded/username nicht direkt änderbar", async () => {
    expect((await b.client.from("profiles").select("username").eq("id", a.id)).data).toHaveLength(
      1,
    );
    const own = await b.client.from("profiles").update({ onboarded: false }).eq("id", b.id);
    expect(own.error).not.toBeNull();
    const other = await b.client
      .from("profiles")
      .update({ display_name: "X" })
      .eq("id", a.id)
      .select();
    expect(other.data).toEqual([]);
  });
});

describe("Stile und eigene Modelle", () => {
  const blob = () =>
    new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])], { type: "model/gltf-binary" });
  const bucket = (u: TestUser) => u.client.storage.from("village-models");

  it("Besitzer darf Stile ändern, ungültige Werte werden abgelehnt, andere nicht", async () => {
    const ok = await a.client
      .from("villages")
      .update({ house_style: "blockhuette", zentrale_style: "schule" })
      .eq("id", a.villageId)
      .select();
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);

    const bad = await a.client
      .from("villages")
      .update({ house_style: "palast" })
      .eq("id", a.villageId);
    expect(bad.error).not.toBeNull();

    const other = await c.client
      .from("villages")
      .update({ house_style: "tinyhaus" })
      .eq("id", a.villageId)
      .select();
    expect(other.data).toEqual([]);
  });

  it("nur der Besitzer lädt hoch; fremde und falsch benannte Dateien werden abgelehnt", async () => {
    const path = `${a.villageId}/zentrale.glb`;
    expect(
      (await bucket(a).upload(path, blob(), { upsert: true, contentType: "model/gltf-binary" }))
        .error,
    ).toBeNull();
    expect(
      (
        await bucket(a).upload(`${a.villageId}/boese.glb`, blob(), {
          contentType: "model/gltf-binary",
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await bucket(c).upload(path, blob(), { upsert: true, contentType: "model/gltf-binary" }))
        .error,
    ).not.toBeNull();
    expect(
      (await bucket(c).upload(`${a.villageId}/zentrale.glb`, blob(), { upsert: true })).error,
    ).not.toBeNull();
  });

  it("ohne Freigabe gibt es keine signierte URL und keinen Download", async () => {
    const path = `${a.villageId}/zentrale.glb`;
    const signed = await bucket(c).createSignedUrl(path, 60);
    expect(signed.data?.signedUrl).toBeUndefined();
    expect((await bucket(c).download(path)).error).not.toBeNull();
    expect((await bucket(a).createSignedUrl(path, 60)).data?.signedUrl).toBeTruthy();
  });

  it("Freigegebene dürfen laden, nach dem Entzug nicht mehr; Fremde dürfen nicht löschen", async () => {
    const path = `${a.villageId}/zentrale.glb`;
    const token = await invite();
    expect((await c.client.rpc("accept_invite", { p_token: token })).error).toBeNull();
    expect((await bucket(c).download(path)).error).toBeNull();
    expect((await bucket(c).createSignedUrl(path, 60)).data?.signedUrl).toBeTruthy();
    expect((await bucket(c).remove([path])).data ?? []).toEqual([]);

    await a.client.from("village_access").delete().eq("viewer_id", c.id);
    expect((await bucket(c).download(path)).error).not.toBeNull();

    // Aufräumen
    expect((await bucket(a).remove([path])).error).toBeNull();
  });
});

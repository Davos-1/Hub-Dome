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
  it("kann MCP-Tokens anderer nicht sehen", async () => {
    await a.client.from("mcp_tokens").insert({ user_id: a.id, token_hash: sha256(run) });
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

describe("Freundschaft und Freigabe", () => {
  const request = (from: TestUser, to: TestUser) =>
    from.client.rpc("send_friend_request", { p_username: to.username });
  const pendingFor = async (u: TestUser) =>
    (await u.client.from("friendships").select("id, requester_id, status").eq("addressee_id", u.id))
      .data ?? [];

  it("B ohne Freundschaft sieht nichts", async () => {
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
  });
  it("B kann sich nicht selbst in village_access oder friendships eintragen", async () => {
    const access = await b.client
      .from("village_access")
      .insert({ village_id: a.villageId, viewer_id: b.id });
    expect(access.error).not.toBeNull();
    const fr = await b.client
      .from("friendships")
      .insert({ requester_id: b.id, addressee_id: a.id, status: "accepted" });
    expect(fr.error).not.toBeNull();
  });
  it("Anfrage an sich selbst oder an unbekannte Namen wird abgelehnt", async () => {
    expect((await request(a, a)).error?.message).toContain("selbst");
    const unknown = await a.client.rpc("send_friend_request", { p_username: "gibt_es_nicht_xyz" });
    expect(unknown.error?.message).toContain("gibt es nicht");
  });
  it("offene Anfrage gibt keinen Zugriff, nur die beiden Beteiligten sehen sie", async () => {
    expect((await request(a, b)).error).toBeNull();
    expect((await request(a, b)).error?.message).toContain("bereits angefragt");
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
    expect(await pendingFor(b)).toHaveLength(1);
    expect((await c.client.from("friendships").select("id")).data).toEqual([]);
  });
  it("nur die angefragte Person kann antworten, andere und der Absender nicht", async () => {
    const [f] = await pendingFor(b);
    expect(
      (await a.client.rpc("respond_friend_request", { p_id: f.id, p_accept: true })).error,
    ).not.toBeNull();
    expect(
      (await c.client.rpc("respond_friend_request", { p_id: f.id, p_accept: true })).error,
    ).not.toBeNull();
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
  });
  it("Ablehnen löscht die Anfrage ohne Zugriff, danach kann erneut angefragt werden", async () => {
    const [f] = await pendingFor(b);
    expect(
      (await b.client.rpc("respond_friend_request", { p_id: f.id, p_accept: false })).error,
    ).toBeNull();
    expect(await pendingFor(b)).toEqual([]);
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
    expect((await request(a, b)).error).toBeNull();
  });
  it("Absender kann seine Anfrage zurückziehen", async () => {
    const [f] = await pendingFor(b);
    expect((await b.client.rpc("cancel_friend_request", { p_id: f.id })).error).not.toBeNull();
    expect((await a.client.rpc("cancel_friend_request", { p_id: f.id })).error).toBeNull();
    expect(await pendingFor(b)).toEqual([]);
  });
  it("B nimmt an: beide sehen geteilte, aber keine privaten Objekte der anderen Person", async () => {
    expect((await request(a, b)).error).toBeNull();
    const [f] = await pendingFor(b);
    expect(
      (await b.client.rpc("respond_friend_request", { p_id: f.id, p_accept: true })).error,
    ).toBeNull();

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
    // gegenseitig: A sieht das Dorf von B
    expect((await a.client.from("villages").select("id").eq("id", b.villageId)).data).toHaveLength(
      1,
    );
  });
  it("Bereits Befreundete können nicht erneut anfragen; C bleibt ohne Zugriff", async () => {
    expect((await request(b, a)).error?.message).toContain("bereits befreundet");
    expect((await c.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
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
  it("Zugriff lässt sich nicht einseitig löschen, nur über remove_friend (beide Richtungen)", async () => {
    const del = await b.client.from("village_access").delete().eq("viewer_id", b.id).select();
    expect(del.data ?? []).toEqual([]);
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).not.toEqual(
      [],
    );

    expect((await b.client.rpc("remove_friend", { p_other: a.id })).error).toBeNull();
    expect((await b.client.from("artifacts").select("id").eq("owner_id", a.id)).data).toEqual([]);
    expect((await b.client.from("villages").select("id").eq("id", a.villageId)).data).toEqual([]);
    expect((await a.client.from("villages").select("id").eq("id", b.villageId)).data).toEqual([]);
    expect((await a.client.from("friendships").select("id")).data).toEqual([]);
  });
  it("gegenseitige Anfragen bestätigen sich sofort", async () => {
    expect((await request(a, b)).error).toBeNull();
    // B fragt zurück, ohne die Anfrage von A gesehen zu haben: Freundschaft entsteht
    expect((await request(b, a)).error).toBeNull();
    expect((await b.client.from("villages").select("id").eq("id", a.villageId)).data).toHaveLength(
      1,
    );
    expect((await b.client.rpc("remove_friend", { p_other: a.id })).error).toBeNull();
  });
});

describe("Freundschaftslink", () => {
  const newToken = () => randomBytes(32).toString("base64url");
  async function makeLink(owner: TestUser, maxUses = 1, expiresInMs = 7 * 864e5) {
    const token = newToken();
    const { error } = await owner.client.from("friend_links").insert({
      owner_id: owner.id,
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + expiresInMs).toISOString(),
      max_uses: maxUses,
    });
    expect(error).toBeNull();
    return token;
  }
  const seesVillage = async (viewer: TestUser, owner: TestUser) =>
    (await viewer.client.from("villages").select("id").eq("id", owner.villageId)).data!.length ===
    1;
  const cleanup = async () => {
    await admin.from("friendships").delete().in("requester_id", [a.id, b.id, c.id]);
    await admin.from("village_access").delete().in("viewer_id", [a.id, b.id, c.id]);
  };

  it("nur der Besitzer sieht und erzeugt Links, Fremde nicht", async () => {
    const token = await makeLink(a);
    expect((await b.client.from("friend_links").select("id")).data).toEqual([]);
    expect((await a.client.from("friend_links").select("id")).data!.length).toBeGreaterThan(0);
    const fake = await b.client.from("friend_links").insert({
      owner_id: a.id,
      token_hash: sha256(newToken()),
      expires_at: new Date(Date.now() + 864e5).toISOString(),
    });
    expect(fake.error).not.toBeNull();
    const tooLong = await a.client.from("friend_links").insert({
      owner_id: a.id,
      token_hash: sha256(newToken()),
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
    expect(tooLong.error).not.toBeNull();
    const used = await a.client.from("friend_links").insert({
      owner_id: a.id,
      token_hash: sha256(newToken()),
      expires_at: new Date(Date.now() + 864e5).toISOString(),
      uses: 5,
    });
    expect(used.error).not.toBeNull();
    // Nutzungen lassen sich nicht von Hand ändern
    const upd = await a.client
      .from("friend_links")
      .update({ uses: 0 })
      .eq("token_hash", sha256(token));
    expect(upd.error).not.toBeNull();
  });

  it("friend_link_info zeigt den Absender, ohne etwas zu verbrauchen", async () => {
    const token = await makeLink(a);
    const info = await b.client.rpc("friend_link_info", { p_token: token });
    expect(info.data).toEqual([{ username: a.username, display_name: "Test a", state: "ok" }]);
    expect(await seesVillage(b, a)).toBe(false);
    const bad = await b.client.rpc("friend_link_info", { p_token: "falsch" });
    expect(bad.data).toEqual([{ username: null, display_name: null, state: "ungueltig" }]);
    const own = await a.client.rpc("friend_link_info", { p_token: token });
    expect(own.data![0].state).toBe("selbst");
  });

  it("ungültig, selbst, abgelaufen und aufgebraucht werden abgelehnt", async () => {
    expect(
      (await b.client.rpc("accept_friend_link", { p_token: "falsch" })).error?.message,
    ).toContain("ungültig");
    const t = await makeLink(a);
    expect((await a.client.rpc("accept_friend_link", { p_token: t })).error?.message).toContain(
      "eigener",
    );
    const expired = await makeLink(a, 1, -1000);
    expect(
      (await b.client.rpc("accept_friend_link", { p_token: expired })).error?.message,
    ).toContain("abgelaufen");
    expect((await b.client.rpc("friend_link_info", { p_token: expired })).data![0].state).toBe(
      "abgelaufen",
    );
  });

  it("Annehmen macht beide gegenseitig zu Freunden und verbraucht eine Nutzung", async () => {
    const t = await makeLink(a, 1);
    const r = await b.client.rpc("accept_friend_link", { p_token: t });
    expect(r.error).toBeNull();
    expect(r.data).toBe(a.username);
    expect(await seesVillage(b, a)).toBe(true);
    expect(await seesVillage(a, b)).toBe(true);
    const link = await admin
      .from("friend_links")
      .select("uses")
      .eq("token_hash", sha256(t))
      .single();
    expect(link.data?.uses).toBe(1);
    // Schon befreundet: nochmal annehmen verbraucht nichts und schlägt nicht fehl
    expect((await b.client.rpc("accept_friend_link", { p_token: t })).error).toBeNull();
    // aufgebraucht für Dritte
    expect((await c.client.rpc("accept_friend_link", { p_token: t })).error?.message).toContain(
      "aufgebraucht",
    );
    expect((await c.client.rpc("friend_link_info", { p_token: t })).data![0].state).toBe(
      "aufgebraucht",
    );
    expect(await seesVillage(c, a)).toBe(false);
    await cleanup();
  });

  it("ein Link mit mehreren Nutzungen funktioniert für mehrere Personen", async () => {
    const t = await makeLink(a, 2);
    expect((await b.client.rpc("accept_friend_link", { p_token: t })).error).toBeNull();
    expect((await c.client.rpc("accept_friend_link", { p_token: t })).error).toBeNull();
    expect(await seesVillage(b, a)).toBe(true);
    expect(await seesVillage(c, a)).toBe(true);
    await cleanup();
  });

  it("eine offene Anfrage wird durch den Link angenommen", async () => {
    expect(
      (await b.client.rpc("send_friend_request", { p_username: a.username })).error,
    ).toBeNull();
    const t = await makeLink(a, 1);
    expect((await b.client.rpc("accept_friend_link", { p_token: t })).error).toBeNull();
    expect(await seesVillage(b, a)).toBe(true);
    const rows = await admin.from("friendships").select("status").in("requester_id", [a.id, b.id]);
    expect(rows.data).toEqual([{ status: "accepted" }]);
    await cleanup();
  });

  it("widerrufene Links funktionieren nicht mehr", async () => {
    const t = await makeLink(a, 5);
    const del = await a.client.from("friend_links").delete().eq("token_hash", sha256(t)).select();
    expect(del.data).toHaveLength(1);
    expect((await b.client.rpc("accept_friend_link", { p_token: t })).error?.message).toContain(
      "ungültig",
    );
    expect(await seesVillage(b, a)).toBe(false);
    // Fremde können keine Links anderer löschen
    const t2 = await makeLink(a, 5);
    const foreign = await b.client
      .from("friend_links")
      .delete()
      .eq("token_hash", sha256(t2))
      .select();
    expect(foreign.data).toEqual([]);
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

describe("Zentrale-Stil und gesperrter Modell-Speicher", () => {
  const blob = () =>
    new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])], { type: "model/gltf-binary" });
  const bucket = (u: TestUser) => u.client.storage.from("village-models");

  it("Besitzer darf den Stil ändern, ungültige Werte werden abgelehnt, andere nicht", async () => {
    const ok = await a.client
      .from("villages")
      .update({ zentrale_style: "schule" })
      .eq("id", a.villageId)
      .select();
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);

    const bad = await a.client
      .from("villages")
      .update({ zentrale_style: "palast" })
      .eq("id", a.villageId);
    expect(bad.error).not.toBeNull();

    const other = await c.client
      .from("villages")
      .update({ zentrale_style: "villa" })
      .eq("id", a.villageId)
      .select();
    expect(other.data).toEqual([]);
  });

  it("niemand kann Modelle hochladen, auch nicht der Besitzer", async () => {
    const path = `${a.villageId}/zentrale.glb`;
    expect(
      (await bucket(a).upload(path, blob(), { upsert: true, contentType: "model/gltf-binary" }))
        .error,
    ).not.toBeNull();
    expect(
      (await bucket(c).upload(path, blob(), { upsert: true, contentType: "model/gltf-binary" }))
        .error,
    ).not.toBeNull();
  });

  it("es gibt keine signierte URL und keinen Download", async () => {
    const path = `${a.villageId}/zentrale.glb`;
    expect((await bucket(a).createSignedUrl(path, 60)).data?.signedUrl).toBeUndefined();
    expect((await bucket(a).download(path)).error).not.toBeNull();
  });
});

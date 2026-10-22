import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Phase 5b: Übernehmen und Nutzungsdaten (PLAN-ERWEITERUNG-2.md, A5).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const run = randomBytes(3).toString("hex");
const password = randomBytes(16).toString("hex");

type TestUser = { id: string; client: SupabaseClient; username: string; villageId: string; house: string };

async function makeUser(tag: string): Promise<TestUser> {
  const email = `rls-ue-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, publishableKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const username = `ue_${tag}_${run}`;
  const { data: villageId, error: obErr } = await client.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: `Test ${tag}`,
  });
  if (obErr) throw obErr;
  const house = await client
    .from("houses")
    .insert({ village_id: villageId, kind: "thema", title: `Haus ${tag}` })
    .select("id")
    .single();
  if (house.error) throw house.error;
  return { id: data.user.id, client, username, villageId, house: house.data.id };
}

async function befriend(x: TestUser, y: TestUser) {
  const sent = await x.client.rpc("send_friend_request", { p_username: y.username });
  expect(sent.error).toBeNull();
  const res = await y.client.rpc("respond_friend_request", { p_id: sent.data, p_accept: true });
  expect(res.error).toBeNull();
}

async function addItem(u: TestUser, fields: Record<string, unknown> = {}) {
  const res = await u.client
    .from("artifacts")
    .insert({
      house_id: u.house,
      owner_id: u.id,
      url: `https://claude.ai/artifact/${randomBytes(8).toString("hex")}`,
      title: "Objekt",
      ...fields,
    })
    .select("id, url")
    .single();
  expect(res.error).toBeNull();
  return res.data!;
}

const stats = async (u: TestUser, id: string) => {
  const res = await u.client.rpc("item_stats", { p_ids: [id] });
  expect(res.error).toBeNull();
  return res.data?.[0] ?? null;
};

let a: TestUser; // Besitzer
let b: TestUser; // befreundet mit A
let c: TestUser; // fremd
const userIds: string[] = [];

beforeAll(async () => {
  [a, b, c] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);
  userIds.push(a.id, b.id, c.id);
  await befriend(a, b);
});

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

describe("copy_artifact", () => {
  it("B übernimmt ein geteiltes Objekt von A: privat, gehört B, Quelle gesetzt; A sieht es nicht", async () => {
    const src = await addItem(a);
    const res = await b.client.rpc("copy_artifact", { p_source: src.id, p_house: b.house });
    expect(res.error).toBeNull();
    const copy = await b.client.from("artifacts").select("*").eq("id", res.data).single();
    expect(copy.data).toMatchObject({
      owner_id: b.id,
      visibility: "private",
      is_copy: true,
      source_artifact_id: src.id,
      source_owner_id: a.id,
      allow_copy: false,
      topdorf_ok: false,
      url: src.url,
    });
    expect((await a.client.from("artifacts").select("id").eq("id", res.data)).data).toEqual([]);
    expect(await stats(a, src.id)).toMatchObject({ uebernommen: 1 });
  });

  it("Fehlercodes: nicht_gefunden, eigenes_objekt, nicht_erlaubt, haus_ungueltig, bereits_vorhanden", async () => {
    const src = await addItem(a);
    const err = async (u: TestUser, source: string, house: string) =>
      (await u.client.rpc("copy_artifact", { p_source: source, p_house: house })).error?.message;

    expect(await err(c, src.id, c.house)).toContain("nicht_gefunden");
    expect(await err(a, src.id, a.house)).toContain("eigenes_objekt");
    expect(await err(b, src.id, a.house)).toContain("haus_ungueltig");
    const priv = await addItem(a, { visibility: "private" });
    expect(await err(b, priv.id, b.house)).toContain("nicht_gefunden");
    const locked = await addItem(a, { allow_copy: false });
    expect(await err(b, locked.id, b.house)).toContain("nicht_erlaubt");

    expect(await err(b, src.id, b.house)).toBeUndefined();
    expect(await err(b, src.id, b.house)).toContain("bereits_vorhanden");
  });

  it("eine Übernahme lässt sich nicht weiter übernehmen", async () => {
    const src = await addItem(a);
    const copy = await b.client.rpc("copy_artifact", { p_source: src.id, p_house: b.house });
    await befriend(b, c);
    const res = await c.client.rpc("copy_artifact", { p_source: copy.data, p_house: c.house });
    expect(res.error?.message).toContain("nicht_gefunden");
    await b.client.rpc("remove_friend", { p_other: c.id });
  });
});

describe("Herkunftsfelder", () => {
  it("Client kann is_copy/source_* per Insert nicht setzen", async () => {
    const src = await addItem(a);
    const own = await addItem(b, { is_copy: true, source_artifact_id: src.id, source_owner_id: a.id });
    const row = await b.client.from("artifacts").select("is_copy, source_artifact_id, source_owner_id").eq("id", own.id).single();
    expect(row.data).toEqual({ is_copy: false, source_artifact_id: null, source_owner_id: null });
  });

  it("Client kann is_copy/source_* per Update nicht setzen", async () => {
    const src = await addItem(a);
    const own = await addItem(b);
    await b.client
      .from("artifacts")
      .update({ is_copy: true, source_artifact_id: src.id, source_owner_id: a.id })
      .eq("id", own.id);
    const row = await b.client.from("artifacts").select("is_copy, source_artifact_id, source_owner_id").eq("id", own.id).single();
    expect(row.data).toEqual({ is_copy: false, source_artifact_id: null, source_owner_id: null });
  });

  it("URL-Änderung an einer Übernahme setzt is_copy=false, die Quelle bleibt", async () => {
    const src = await addItem(a);
    const copy = await b.client.rpc("copy_artifact", { p_source: src.id, p_house: b.house });
    const newUrl = `https://claude.ai/artifact/${randomBytes(8).toString("hex")}`;
    const upd = await b.client.from("artifacts").update({ url: newUrl }).eq("id", copy.data);
    expect(upd.error).toBeNull();
    const row = await b.client.from("artifacts").select("is_copy, source_artifact_id, source_owner_id").eq("id", copy.data).single();
    expect(row.data).toEqual({ is_copy: false, source_artifact_id: src.id, source_owner_id: a.id });
  });

  it("Übernahme kann nicht auf shared oder topdorf_ok gesetzt werden", async () => {
    const src = await addItem(a);
    const copy = await b.client.rpc("copy_artifact", { p_source: src.id, p_house: b.house });
    expect((await b.client.from("artifacts").update({ visibility: "shared" }).eq("id", copy.data)).error).not.toBeNull();
    // topdorf_ok wird bei privaten Objekten vom Trigger auf false gehalten
    await b.client.from("artifacts").update({ topdorf_ok: true }).eq("id", copy.data);
    const row = await b.client.from("artifacts").select("visibility, topdorf_ok").eq("id", copy.data).single();
    expect(row.data).toEqual({ visibility: "private", topdorf_ok: false });
  });

  it("privat machen nimmt das Objekt aus dem Topdorf", async () => {
    const own = await addItem(a, { topdorf_ok: true });
    await a.client.from("artifacts").update({ visibility: "private" }).eq("id", own.id);
    const row = await a.client.from("artifacts").select("topdorf_ok").eq("id", own.id).single();
    expect(row.data?.topdorf_ok).toBe(false);
  });

  it("bestehende Übernahmen bleiben, wenn das Original gelöscht wird (Original entfernt)", async () => {
    const src = await addItem(a);
    const copy = await b.client.rpc("copy_artifact", { p_source: src.id, p_house: b.house });
    await a.client.from("artifacts").delete().eq("id", src.id);
    const row = await b.client.from("artifacts").select("is_copy, source_artifact_id, source_owner_id").eq("id", copy.data).single();
    expect(row.data).toEqual({ is_copy: true, source_artifact_id: null, source_owner_id: a.id });
  });
});

describe("Nutzungsereignisse", () => {
  it("Besitzer zählt nicht; doppeltes Öffnen ergibt eine Zeile; ohne Sichtrecht keine Zeile", async () => {
    const src = await addItem(a);
    await a.client.rpc("record_item_event", { p_artifact: src.id, p_event: "geoeffnet" });
    await b.client.rpc("record_item_event", { p_artifact: src.id, p_event: "geoeffnet" });
    await b.client.rpc("record_item_event", { p_artifact: src.id, p_event: "geoeffnet" });
    await c.client.rpc("record_item_event", { p_artifact: src.id, p_event: "geoeffnet" });
    expect(await stats(a, src.id)).toEqual({ artifact_id: src.id, geoeffnet: 1, uebernommen: 0 });
  });

  it("Öffnen über eine Übernahme zählt für die Quelle", async () => {
    const src = await addItem(a);
    const copy = await b.client.rpc("copy_artifact", { p_source: src.id, p_house: b.house });
    await b.client.rpc("record_item_event", { p_artifact: copy.data, p_event: "geoeffnet" });
    expect(await stats(a, src.id)).toMatchObject({ geoeffnet: 1, uebernommen: 1 });
    expect(await stats(b, copy.data)).toEqual({ artifact_id: copy.data, geoeffnet: 0, uebernommen: 0 });
  });

  it("item_stats nur für eigene Objekte; item_events ist für Clients nicht lesbar", async () => {
    const src = await addItem(a);
    expect(await stats(b, src.id)).toBeNull();
    const direct = await b.client.from("item_events").select("*");
    expect(direct.error ?? direct.data?.length === 0).toBeTruthy();
    expect((await b.client.from("item_events").insert({ artifact_id: src.id, user_id: b.id, event: "geoeffnet" })).error).not.toBeNull();
  });
});

describe("Topdorf-Sichtbarkeit", () => {
  it("topdorf_ok-Original ist für Fremde lesbar, ein privates nicht; Übernehmen geht", async () => {
    const top = await addItem(a, { topdorf_ok: true });
    const priv = await addItem(a, { visibility: "private" });
    expect((await c.client.from("artifacts").select("id").eq("id", top.id)).data).toHaveLength(1);
    expect((await c.client.from("artifacts").select("id").eq("id", priv.id)).data).toEqual([]);
    expect((await c.client.from("houses").select("id").eq("village_id", a.villageId)).data).toEqual([]);
    const res = await c.client.rpc("copy_artifact", { p_source: top.id, p_house: c.house });
    expect(res.error).toBeNull();
  });

  it("set_topdorf_all betrifft nur eigene geteilte Originale", async () => {
    const shared = await addItem(b);
    const priv = await addItem(b, { visibility: "private" });
    const on = await b.client.rpc("set_topdorf_all", { p_on: true });
    expect(on.error).toBeNull();
    const rows = await b.client.from("artifacts").select("id, topdorf_ok").in("id", [shared.id, priv.id]);
    const byId = Object.fromEntries((rows.data ?? []).map((r) => [r.id, r.topdorf_ok]));
    expect(byId).toEqual({ [shared.id]: true, [priv.id]: false });
    await b.client.rpc("set_topdorf_all", { p_on: false });
  });
});

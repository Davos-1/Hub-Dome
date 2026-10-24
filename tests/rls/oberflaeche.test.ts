import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Phase 4h: Quartier pro Haus (`houses.quarter_override`), Tageszeit-Modus (`profiles.time_mode`) und die
// Massenaktionen des Inventars (mehrere Objekte auf einmal; RLS muss fremde Ids stillschweigend auslassen).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const run = randomBytes(3).toString("hex");
const password = randomBytes(16).toString("hex");

type TestUser = { id: string; client: SupabaseClient; username: string; villageId: string };

async function makeUser(tag: string): Promise<TestUser> {
  const email = `rls-ui-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(url, publishableKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const username = `ui_${tag}_${run}`;
  const { data: villageId, error: obErr } = await client.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: `Test ${tag}`,
  });
  if (obErr) throw obErr;
  return { id: data.user.id, client, username, villageId };
}

// Ein Schreibversuch gilt als abgewiesen, wenn er einen Fehler liefert oder keine Zeile trifft.
const rejected = (res: { error: unknown; data: unknown }) =>
  res.error !== null || !Array.isArray(res.data) || res.data.length === 0;

let a: TestUser; // Besitzer
let b: TestUser; // befreundet mit A
const userIds: string[] = [];
let houseA: string;
let zentraleA: string;

beforeAll(async () => {
  [a, b] = await Promise.all([makeUser("a"), makeUser("b")]);
  userIds.push(a.id, b.id);
  const sent = await a.client.rpc("send_friend_request", { p_username: b.username });
  expect(sent.error).toBeNull();
  const res = await b.client.rpc("respond_friend_request", { p_id: sent.data, p_accept: true });
  expect(res.error).toBeNull();
  const ins = await a.client
    .from("houses")
    .insert({ village_id: a.villageId, kind: "thema", title: "Notizen", position_index: 1 })
    .select("id")
    .single();
  expect(ins.error).toBeNull();
  houseA = ins.data!.id;
  const z = await a.client
    .from("houses")
    .select("id")
    .eq("village_id", a.villageId)
    .eq("kind", "zentrale")
    .single();
  zentraleA = z.data!.id;
}, 60_000);

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

describe("houses.quarter_override", () => {
  it("Besitzer setzt ein gültiges Quartier und wieder null", async () => {
    const set = await a.client
      .from("houses")
      .update({ quarter_override: "digital" })
      .eq("id", houseA)
      .select("quarter_override");
    expect(set.error).toBeNull();
    expect(set.data).toEqual([{ quarter_override: "digital" }]);
    const reset = await a.client
      .from("houses")
      .update({ quarter_override: null })
      .eq("id", houseA)
      .select("quarter_override");
    expect(reset.data).toEqual([{ quarter_override: null }]);
  });

  it("unbekannte Quartiere und die Zentrale werden abgewiesen", async () => {
    const bad = await a.client
      .from("houses")
      .update({ quarter_override: "mond" })
      .eq("id", houseA)
      .select();
    expect(rejected(bad)).toBe(true);
    const zentrale = await a.client
      .from("houses")
      .update({ quarter_override: "tragwerk" })
      .eq("id", zentraleA)
      .select();
    expect(rejected(zentrale)).toBe(true);
  });

  it("Freunde können das Quartier eines fremden Hauses nicht ändern", async () => {
    const upd = await b.client
      .from("houses")
      .update({ quarter_override: "sprache" })
      .eq("id", houseA)
      .select();
    expect(rejected(upd)).toBe(true);
    const row = await admin.from("houses").select("quarter_override").eq("id", houseA).single();
    expect(row.data?.quarter_override).toBeNull();
  });
});

describe("profiles.time_mode", () => {
  it("Standard ist «auto», die Person setzt «fest» und zurück", async () => {
    const before = await a.client.from("profiles").select("time_mode").eq("id", a.id).single();
    expect(before.data?.time_mode).toBe("auto");
    const set = await a.client
      .from("profiles")
      .update({ time_mode: "fest" })
      .eq("id", a.id)
      .select("time_mode");
    expect(set.data).toEqual([{ time_mode: "fest" }]);
    const back = await a.client
      .from("profiles")
      .update({ time_mode: "auto" })
      .eq("id", a.id)
      .select("time_mode");
    expect(back.data).toEqual([{ time_mode: "auto" }]);
  });

  it("nur erlaubte Werte, nur das eigene Profil, Benutzername bleibt gesperrt", async () => {
    const bad = await a.client
      .from("profiles")
      .update({ time_mode: "nacht" })
      .eq("id", a.id)
      .select();
    expect(rejected(bad)).toBe(true);
    const other = await b.client
      .from("profiles")
      .update({ time_mode: "fest" })
      .eq("id", a.id)
      .select();
    expect(rejected(other)).toBe(true);
    const name = await a.client
      .from("profiles")
      .update({ username: `x_${run}` })
      .eq("id", a.id)
      .select();
    expect(rejected(name)).toBe(true);
  });
});

describe("Massenaktionen des Inventars", () => {
  it("Freunde verschieben, ändern oder löschen keine fremden Objekte, auch nicht in einer Liste", async () => {
    const ins = await a.client
      .from("artifacts")
      .insert([
        {
          house_id: houseA,
          owner_id: a.id,
          url: `https://claude.ai/artifact/ui-${run}-1`,
          title: "Eins",
          kind: "quiz",
          item_type: "claude_artifact",
          visibility: "shared",
        },
        {
          house_id: houseA,
          owner_id: a.id,
          url: `https://claude.ai/artifact/ui-${run}-2`,
          title: "Zwei",
          kind: "tool",
          item_type: "claude_artifact",
          visibility: "shared",
        },
      ])
      .select("id");
    expect(ins.error).toBeNull();
    const ids = ins.data!.map((r) => r.id as string);

    for (const patch of [{ kind: "rechner" }, { visibility: "private" }, { title: "fremd" }]) {
      const upd = await b.client.from("artifacts").update(patch).in("id", ids).select();
      expect(rejected(upd)).toBe(true);
    }
    const del = await b.client.from("artifacts").delete().in("id", ids).select();
    expect(rejected(del)).toBe(true);

    // Der Besitzer ändert alle auf einmal
    const own = await a.client
      .from("artifacts")
      .update({ kind: "cheatsheet" })
      .in("id", ids)
      .eq("owner_id", a.id)
      .select("id");
    expect(own.data).toHaveLength(2);
  });
});

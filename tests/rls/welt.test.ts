import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Phase 4f: Welt pro Dorf (village_worlds). Clients lesen nur, geschrieben wird nur mit Service Role.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const run = randomBytes(3).toString("hex");
const password = randomBytes(16).toString("hex");

type TestUser = { id: string; client: SupabaseClient; username: string; villageId: string };

async function makeUser(tag: string): Promise<TestUser> {
  const email = `rls-welt-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(url, publishableKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const username = `we_${tag}_${run}`;
  const { data: villageId, error: obErr } = await client.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: `Test ${tag}`,
  });
  if (obErr) throw obErr;
  return { id: data.user.id, client, username, villageId };
}

async function befriend(x: TestUser, y: TestUser) {
  const sent = await x.client.rpc("send_friend_request", { p_username: y.username });
  expect(sent.error).toBeNull();
  const res = await y.client.rpc("respond_friend_request", { p_id: sent.data, p_accept: true });
  expect(res.error).toBeNull();
}

// Die Zeile eines Dorfs, wie sie wirklich in der Datenbank steht (Service Role, mit owner_id-Filter).
async function world(u: TestUser) {
  const { data, error } = await admin
    .from("village_worlds")
    .select("*")
    .eq("village_id", u.villageId)
    .eq("owner_id", u.id)
    .maybeSingle();
  expect(error).toBeNull();
  return data;
}

// Ein Schreibversuch gilt als abgewiesen, wenn er einen Fehler liefert oder keine Zeile trifft.
const rejected = (res: { error: unknown; data: unknown }) =>
  res.error !== null || !Array.isArray(res.data) || res.data.length === 0;

const SEED_RE = /^[a-z0-9]{8}$/;

let a: TestUser; // Besitzer
let b: TestUser; // befreundet mit A (ab dem Block «Freund»)
let c: TestUser; // fremd
const userIds: string[] = [];

beforeAll(async () => {
  [a, b, c] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);
  userIds.push(a.id, b.id, c.id);
}, 60_000);

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

describe("Anlegen mit dem Dorf", () => {
  it("jedes neue Dorf hat eine Welt mit gültigem Seed, Version 1 und leeren Platzierungen", async () => {
    const seeds: string[] = [];
    for (const u of [a, b, c]) {
      const res = await u.client.from("village_worlds").select("*").eq("village_id", u.villageId);
      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      const row = res.data![0];
      expect(row.owner_id).toBe(u.id);
      expect(row.seed).toMatch(SEED_RE);
      expect(row.generator_version).toBe(1);
      expect(row.placements).toEqual({});
      seeds.push(row.seed);
    }
    // Zufalls-Seed pro Dorf, kein fester Wert
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("zweites Onboarding lässt die Welt unverändert (kein neuer Seed, keine zweite Zeile)", async () => {
    const before = await world(a);
    const again = await a.client.rpc("complete_onboarding", {
      p_username: a.username,
      p_display_name: "Test a",
    });
    expect(again.error).toBeNull();
    const rows = await admin.from("village_worlds").select("*").eq("owner_id", a.id);
    expect(rows.data).toEqual([before]);
  });
});

describe("Besitzer", () => {
  it("kann die eigene Zeile weder ändern noch löschen", async () => {
    const before = await world(a);
    expect(before).not.toBeNull();

    const patches = [
      { seed: "zzzzzzzz" },
      { generator_version: 2 },
      { placements: { v: 1, deko: [{ id: "x", typ: "bank", x: 0, z: 0, r: 0 }] } },
      { owner_id: b.id },
    ];
    for (const patch of patches) {
      const upd = await a.client
        .from("village_worlds")
        .update(patch)
        .eq("village_id", a.villageId)
        .select();
      expect(rejected(upd)).toBe(true);
    }
    const del = await a.client
      .from("village_worlds")
      .delete()
      .eq("village_id", a.villageId)
      .select();
    expect(rejected(del)).toBe(true);

    // Unverändert, auch der Zeitstempel
    expect(await world(a)).toEqual(before);
  });

  it("niemand ausser dem Server kann eine Zeile einfügen", async () => {
    const before = await world(a);
    expect(before).not.toBeNull();
    // Ohne vorhandene Zeile prüfen wir echtes Einfügen (sonst würde der Primärschlüssel abweisen).
    const gone = await admin
      .from("village_worlds")
      .delete()
      .eq("village_id", a.villageId)
      .eq("owner_id", a.id);
    expect(gone.error).toBeNull();
    try {
      for (const u of [a, c]) {
        const ins = await u.client
          .from("village_worlds")
          .insert({ village_id: a.villageId, owner_id: u.id, seed: "abcd1234" })
          .select();
        expect(rejected(ins)).toBe(true);
      }
      expect(await world(a)).toBeNull();
    } finally {
      // Zeile mit dem ursprünglichen Stand wiederherstellen
      const restore = await admin.from("village_worlds").upsert(
        {
          village_id: a.villageId,
          owner_id: a.id,
          seed: before!.seed,
          generator_version: before!.generator_version,
          placements: before!.placements,
        },
        { onConflict: "village_id" },
      );
      expect(restore.error).toBeNull();
    }
  });
});

describe("Freund", () => {
  beforeAll(async () => {
    await befriend(a, b);
  });

  it("liest die Welt des Dorfs, und zwar gegenseitig", async () => {
    const own = await world(a);
    const read = await b.client.from("village_worlds").select("*").eq("village_id", a.villageId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);
    expect(read.data![0]).toMatchObject({
      owner_id: a.id,
      seed: own!.seed,
      generator_version: own!.generator_version,
      placements: own!.placements,
    });

    const back = await a.client.from("village_worlds").select("seed").eq("village_id", b.villageId);
    expect(back.data).toEqual([{ seed: (await world(b))!.seed }]);
  });

  it("kann die Welt des Dorfs nicht ändern, löschen oder einfügen", async () => {
    const before = await world(a);
    const patches = [
      { seed: "zzzzzzzz" },
      { placements: { v: 1, deko: [] } },
      { generator_version: 2 },
      { owner_id: b.id },
    ];
    for (const patch of patches) {
      const upd = await b.client
        .from("village_worlds")
        .update(patch)
        .eq("village_id", a.villageId)
        .select();
      expect(rejected(upd)).toBe(true);
    }
    const del = await b.client
      .from("village_worlds")
      .delete()
      .eq("village_id", a.villageId)
      .select();
    expect(rejected(del)).toBe(true);
    const ins = await b.client
      .from("village_worlds")
      .insert({ village_id: a.villageId, owner_id: b.id, seed: "abcd1234" })
      .select();
    expect(rejected(ins)).toBe(true);
    expect(await world(a)).toEqual(before);
  });

  it("verliert den Lesezugriff, sobald die Freundschaft endet", async () => {
    expect((await b.client.rpc("remove_friend", { p_other: a.id })).error).toBeNull();
    const read = await b.client.from("village_worlds").select("seed").eq("village_id", a.villageId);
    expect(read.data ?? []).toEqual([]);
  });
});

describe("Fremde Person ohne Freundschaft", () => {
  it("sieht die Welt eines fremden Dorfs nicht, nur die eigene", async () => {
    const one = await c.client.from("village_worlds").select("*").eq("village_id", a.villageId);
    expect(one.error).toBeNull();
    expect(one.data).toEqual([]);

    const all = await c.client.from("village_worlds").select("village_id");
    expect(all.error).toBeNull();
    expect(all.data).toEqual([{ village_id: c.villageId }]);
  });

  it("kann sie auch nicht ändern oder löschen", async () => {
    const before = await world(a);
    const upd = await c.client
      .from("village_worlds")
      .update({ seed: "zzzzzzzz" })
      .eq("village_id", a.villageId)
      .select();
    expect(rejected(upd)).toBe(true);
    const del = await c.client
      .from("village_worlds")
      .delete()
      .eq("village_id", a.villageId)
      .select();
    expect(rejected(del)).toBe(true);
    expect(await world(a)).toEqual(before);
  });
});

describe("Anonym", () => {
  it("sieht nichts und schreibt nichts", async () => {
    const anon = createClient(url, publishableKey, opts);
    const all = await anon.from("village_worlds").select("village_id");
    expect(all.data ?? []).toEqual([]);
    const one = await anon.from("village_worlds").select("seed").eq("village_id", a.villageId);
    expect(one.data ?? []).toEqual([]);

    const before = await world(a);
    const upd = await anon
      .from("village_worlds")
      .update({ seed: "zzzzzzzz" })
      .eq("village_id", a.villageId)
      .select();
    expect(rejected(upd)).toBe(true);
    const ins = await anon
      .from("village_worlds")
      .insert({ village_id: a.villageId, owner_id: a.id, seed: "abcd1234" });
    expect(ins.error).not.toBeNull();
    expect(await world(a)).toEqual(before);
  });
});

describe("Service Role (Server Action)", () => {
  // Gleiche Abfrage wie auf dem Server: immer nach Dorf und Besitzer gefiltert.
  const save = (u: TestUser, patch: Record<string, unknown>) =>
    admin
      .from("village_worlds")
      .update(patch)
      .eq("village_id", u.villageId)
      .eq("owner_id", u.id)
      .select();

  it("speichert Platzierungen mit explizitem Filter; der Besitzer liest sie danach", async () => {
    const before = await world(a);
    const placements = {
      v: 1,
      quartiere: {},
      haeuser: {},
      deko: [{ id: "d1", typ: "bank", x: 1.5, z: -2, r: 90 }],
      varianten: {},
    };
    const res = await save(a, { placements });
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(res.data![0].placements).toEqual(placements);
    expect(res.data![0].seed).toBe(before!.seed);
    // Zeitstempel kommt vom Trigger
    expect(Date.parse(res.data![0].updated_at)).toBeGreaterThan(Date.parse(before!.updated_at));

    const read = await a.client
      .from("village_worlds")
      .select("placements")
      .eq("village_id", a.villageId);
    expect(read.data).toEqual([{ placements }]);
  });

  it("ein falscher owner_id-Filter trifft nichts", async () => {
    const before = await world(a);
    const res = await admin
      .from("village_worlds")
      .update({ seed: "abcd1234" })
      .eq("village_id", a.villageId)
      .eq("owner_id", c.id)
      .select();
    expect(res.error).toBeNull();
    expect(res.data).toEqual([]);
    expect(await world(a)).toEqual(before);
  });

  it("lehnt ungültige Seeds ab", async () => {
    const before = await world(a);
    for (const seed of ["ABC", "ABCDEFGH", "abcdefg", "abcdefghi", "abcd-123", ""]) {
      const res = await save(a, { seed });
      expect(res.error, `Seed «${seed}»`).not.toBeNull();
    }
    expect(await world(a)).toEqual(before);
    // Ein gültiger Seed geht dagegen durch
    const ok = await save(a, { seed: "abcd1234" });
    expect(ok.error).toBeNull();
    expect(ok.data![0].seed).toBe("abcd1234");
    expect((await world(a))!.seed).toBe("abcd1234");
  });

  it("lehnt ungültige Version und ungültige Platzierungen ab", async () => {
    const before = await world(a);
    for (const generator_version of [0, 1000]) {
      expect((await save(a, { generator_version })).error).not.toBeNull();
    }
    // Muss ein Objekt sein, höchstens 64 KB
    for (const placements of [[], "text", 42, { pad: "x".repeat(70_000) }]) {
      expect((await save(a, { placements })).error).not.toBeNull();
    }
    expect(await world(a)).toEqual(before);
  });

  it("setzt owner_id auf den echten Besitzer, auch wenn ein anderer Wert mitgeschickt wird", async () => {
    const res = await save(a, { owner_id: c.id, placements: { v: 1 } });
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(res.data![0].owner_id).toBe(a.id);
    expect((await world(a))!.owner_id).toBe(a.id);
    const ofC = await admin.from("village_worlds").select("village_id").eq("owner_id", c.id);
    expect(ofC.data).toEqual([{ village_id: c.villageId }]);

    // Auch beim Einfügen (Zeile vorher entfernen und mit demselben Seed zurückschreiben)
    const row = await world(a);
    await admin.from("village_worlds").delete().eq("village_id", a.villageId).eq("owner_id", a.id);
    const ins = await admin
      .from("village_worlds")
      .insert({ village_id: a.villageId, owner_id: c.id, seed: row!.seed })
      .select();
    expect(ins.error).toBeNull();
    expect(ins.data![0].owner_id).toBe(a.id);
    expect((await world(a))!.seed).toBe(row!.seed);
  });

  it("kann keine Zeile für ein nicht vorhandenes Dorf anlegen", async () => {
    const ins = await admin.from("village_worlds").insert({
      village_id: "00000000-0000-4000-8000-000000000000",
      owner_id: a.id,
      seed: "abcd1234",
    });
    expect(ins.error?.message).toContain("Dorf nicht gefunden");
  });

  it("Löschen des Auth-Users entfernt die Welt (on delete cascade)", async () => {
    const d = await makeUser("d");
    userIds.push(d.id);
    expect(await world(d)).not.toBeNull();
    expect((await admin.auth.admin.deleteUser(d.id)).error).toBeNull();
    const rows = await admin
      .from("village_worlds")
      .select("village_id")
      .eq("village_id", d.villageId);
    expect(rows.data).toEqual([]);
  });
});

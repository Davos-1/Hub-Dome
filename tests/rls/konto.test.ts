import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Phase 6: Konto löschen mit Wartefrist (account_deletions, request/cancel_account_deletion).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = randomBytes(3).toString("hex");
const password = randomBytes(16).toString("hex");

type U = { id: string; client: SupabaseClient };

async function makeUser(tag: string): Promise<U> {
  const email = `rls-konto-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  const ob = await client.rpc("complete_onboarding", {
    p_username: `ko_${tag}_${run}`,
    p_display_name: `Konto ${tag}`,
  });
  if (ob.error) throw ob.error;
  return { id: data.user.id, client };
}

let a: U;
let b: U;
const ids: string[] = [];
beforeAll(async () => {
  [a, b] = await Promise.all([makeUser("a"), makeUser("b")]);
  ids.push(a.id, b.id);
});
afterAll(async () => {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
});

describe("Konto löschen", () => {
  it("Antrag widerruft Tokens, ist nur für sich selbst sichtbar und nicht direkt schreibbar", async () => {
    await admin.from("mcp_tokens").insert({ user_id: a.id, token_hash: `x${run}`, label: "Test" });
    const req = await a.client.rpc("request_account_deletion");
    expect(req.error).toBeNull();
    expect((await a.client.from("account_deletions").select("user_id")).data).toEqual([{ user_id: a.id }]);
    expect((await b.client.from("account_deletions").select("user_id")).data).toEqual([]);
    const tokens = await admin.from("mcp_tokens").select("revoked_at").eq("user_id", a.id);
    expect(tokens.data?.every((t) => t.revoked_at)).toBe(true);

    expect((await b.client.from("account_deletions").insert({ user_id: b.id })).error).not.toBeNull();
    const del = await a.client.from("account_deletions").delete().eq("user_id", a.id).select();
    expect(del.data ?? []).toEqual([]);
  });

  it("erneuter Antrag verschiebt die Frist nicht; Abbrechen entfernt den Antrag", async () => {
    const first = await b.client.rpc("request_account_deletion");
    const again = await b.client.rpc("request_account_deletion");
    expect(again.data).toBe(first.data);
    expect((await b.client.rpc("cancel_account_deletion")).data).toBe(true);
    expect((await b.client.rpc("cancel_account_deletion")).data).toBe(false);
    expect((await b.client.from("account_deletions").select("user_id")).data).toEqual([]);
  });

  it("Löschen des Auth-Users entfernt Profil, Dorf und Antrag", async () => {
    const c = await makeUser("c");
    await c.client.rpc("request_account_deletion");
    expect((await admin.auth.admin.deleteUser(c.id)).error).toBeNull();
    const [p, v, d] = await Promise.all([
      admin.from("profiles").select("id").eq("id", c.id),
      admin.from("villages").select("id").eq("owner_id", c.id),
      admin.from("account_deletions").select("user_id").eq("user_id", c.id),
    ]);
    expect([p.data, v.data, d.data]).toEqual([[], [], []]);
  });
});

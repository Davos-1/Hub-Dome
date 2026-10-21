import { randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export type E2EUser = {
  id: string;
  email: string;
  password: string;
  username: string;
  name: string;
};

/** Legt einen bestätigten Testuser samt Dorf an (Onboarding per RPC). */
export async function createTestUser(tag: string): Promise<E2EUser> {
  const run = randomBytes(3).toString("hex");
  const email = `e2e-${tag}-${run}@example.test`;
  const password = randomBytes(16).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createClient(url, key, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  const username = `e2e_${tag}_${run}`;
  const name = `Tester ${tag.toUpperCase()}`;
  const { error: obError } = await client.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: name,
  });
  if (obError) throw obError;
  return { id: data.user.id, email, password, username, name };
}

export const deleteTestUser = (id: string) => admin.auth.admin.deleteUser(id);

/** Meldet den User per Passwort an und setzt dieselben Session-Cookies wie die App (@supabase/ssr). */
export async function loginAs(context: BrowserContext, user: E2EUser) {
  const jar = new Map<string, string>();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  await context.addCookies(
    [...jar].map(([name, value]) => ({ name, value, url: "http://localhost:3000" })),
  );
}

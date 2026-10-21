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

/** Füllt das Dorf eines Users direkt per Admin-API (umgeht RLS, nur für Tests). */
export async function seedVillage(userId: string, houseCount: number, perHouse: number) {
  const { data: village } = await admin
    .from("villages")
    .select("id")
    .eq("owner_id", userId)
    .single();
  // Modulcodes aus verschiedenen Fachbereichen: das Dorf bekommt mehrere Quartiere
  const codes = [
    "TA.BA_BAUSTATIK1",
    "TA.BA_NABA",
    "TA.BA_GA",
    "TA.BA_DC_STUD1",
    "TA.BA_VWL",
    "TA.BA_MATH1A",
    "TA.BA_SP1",
    "TA.BA_DATA1_MM",
    "TA.BA_BS",
    "TA.BA_OEK",
  ];
  const rows = Array.from({ length: houseCount }, (_, i) => ({
    village_id: village!.id,
    kind: "modul",
    module_code: codes[i % codes.length],
    title: `Haus ${i + 1}`,
    position_index: i + 1,
  }));
  const { data: houses, error } = await admin.from("houses").insert(rows).select("id, title");
  if (error) throw error;

  const kinds = ["rechner", "quiz", "zusammenfassung", "cheatsheet", "tool", "visualisierung"];
  const types = [
    ["claude_artifact", "https://claude.ai/public/artifacts/"],
    ["github_repo", "https://github.com/seed/repo-"],
    ["gist", "https://gist.github.com/seed/"],
    ["cloud_ordner", "https://hslu.sharepoint.com/seed/"],
    ["link", "https://example.com/"],
  ];
  const artifacts = houses!.flatMap((h, hi) =>
    Array.from({ length: perHouse }, (_, i) => {
      const [item_type, base] = types[(hi + i) % types.length];
      return {
        house_id: h.id,
        owner_id: userId,
        url: `${base}${hi}-${i}`.replace("/seed/repo-", "/seed/repo-"),
        title: `Objekt ${hi + 1}.${i + 1}`,
        kind: kinds[i % kinds.length],
        item_type,
        // Vorschau-Zeitstempel gesetzt: im Test keine GitHub-Abrufe
        meta_refreshed_at: new Date().toISOString(),
        meta: { unavailable: true },
      };
    }),
  );
  const { error: aError } = await admin.from("artifacts").insert(artifacts);
  if (aError) throw aError;
  return houses!;
}

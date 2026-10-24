import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Phase 5b: B übernimmt ein Objekt von A ins eigene Dorf (mit neuem Modulhaus), verknüpft eine
// eigene Version, und Öffnen über /o/<id> zählt pro Person genau einmal.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let a: E2EUser;
let b: E2EUser;
let itemId: string;
let moduleTitle: string;

test.beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("ua"), createTestUser("ub")]);
  const [{ data: va }, { data: vb }, { data: mod }] = await Promise.all([
    admin.from("villages").select("id").eq("owner_id", a.id).single(),
    admin.from("villages").select("id").eq("owner_id", b.id).single(),
    admin.from("module_catalog").select("code, title").limit(1).single(),
  ]);
  moduleTitle = mod!.title;
  // Freundschaft direkt anlegen (Ablauf selbst testet freigabe.spec)
  await admin
    .from("friendships")
    .insert({ requester_id: a.id, addressee_id: b.id, status: "accepted" });
  await admin.from("village_access").insert([
    { village_id: va!.id, viewer_id: b.id },
    { village_id: vb!.id, viewer_id: a.id },
  ]);
  const { data: house } = await admin
    .from("houses")
    .insert({ village_id: va!.id, kind: "modul", title: mod!.title, module_code: mod!.code })
    .select("id")
    .single();
  const { data: item } = await admin
    .from("artifacts")
    .insert({
      house_id: house!.id,
      owner_id: a.id,
      url: `https://claude.ai/artifact/${randomBytes(8).toString("hex")}`,
      title: "Spannungsrechner",
    })
    .select("id")
    .single();
  itemId = item!.id;
});

test.afterAll(async () => {
  await Promise.all([deleteTestUser(a.id), deleteTestUser(b.id)]);
});

const opened = async () =>
  (
    await admin
      .from("item_events")
      .select("user_id")
      .eq("artifact_id", itemId)
      .eq("event", "geoeffnet")
  ).data?.length ?? 0;

/** Welt eines Dorfs laden, Objekt über die Suche (Strg+K) öffnen: die Tafel zeigt das Objekt. */
async function openObject(page: Page, username: string) {
  await page.goto(`/dorf/${username}`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Suchen" });
  await palette.getByRole("combobox").fill("Spannungsrechner");
  await palette.getByRole("option").first().click();
  const tafel = page.getByRole("dialog", { name: "Spannungsrechner", exact: true });
  await expect(tafel).toBeVisible({ timeout: 30_000 });
  return tafel;
}

test("Übernehmen mit neuem Modulhaus, eigene Version verknüpfen", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, b);
  const page = await ctx.newPage();

  // Fremdes Objekt: «In mein Dorf» steht in der Objekt-Tafel, mit Hausvorschlag (gleiches Modul)
  const theirs = await openObject(page, a.username);
  await theirs.getByRole("button", { name: /^In mein Dorf/ }).click();
  await theirs
    .getByRole("button", { name: `Haus «${moduleTitle}» anlegen und übernehmen` })
    .click();
  await expect(theirs.getByText(`In «${moduleTitle}» übernommen`)).toBeVisible({
    timeout: 30_000,
  });

  // Eigenes Dorf: das Objekt zeigt seine Herkunft
  const mine = await openObject(page, b.username);
  await expect(mine.getByText(`übernommen von @${a.username}`)).toBeVisible({ timeout: 30_000 });

  // Bei einer Übernahme heisst «Bearbeiten» «Eigene Version»: Link der eigenen Version verknüpfen (Schritt 1)
  await mine.getByRole("button", { name: "Eigene Version", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Spannungsrechner", exact: true });
  await expect(edit.getByText("Eigene Version verknüpfen:")).toBeVisible();
  await edit.getByRole("tab", { name: /^1 Link/ }).click();
  await edit
    .getByRole("textbox", { name: /^Link/ })
    .fill(`https://claude.ai/artifact/${randomBytes(8).toString("hex")}`);
  await edit.getByRole("button", { name: "Speichern" }).click();
  // Danach zeigt die Tafel wieder das Objekt (ohne Formular)
  await expect(edit.getByText("Eigene Version verknüpfen:")).toHaveCount(0, { timeout: 30_000 });

  const based = await openObject(page, b.username);
  await expect(based.getByText(`basiert auf @${a.username}`)).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});

test("Öffnen über /o/<id> zählt pro Person genau einmal", async ({ browser }) => {
  test.setTimeout(120_000);
  const before = await opened();
  const ctx = await browser.newContext();
  await loginAs(ctx, a);
  // Besitzer zählt nicht
  const own = await ctx.request.get(`/o/${itemId}`, { maxRedirects: 0 });
  expect(own.status()).toBe(302);
  await ctx.close();

  const ctxB = await browser.newContext();
  await loginAs(ctxB, b);
  for (let i = 0; i < 2; i++) {
    const res = await ctxB.request.get(`/o/${itemId}`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers().location).toContain("https://claude.ai/artifact/");
  }
  const bad = await ctxB.request.get(`/o/nicht-uuid`, { maxRedirects: 0 });
  expect(bad.status()).toBe(404);
  await ctxB.close();
  expect(await opened()).toBe(before + 1);
});

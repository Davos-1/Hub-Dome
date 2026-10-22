import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Phase 3b: GitHub-Repo per Link, Vorschau mit README, Caching 24 h, Typ-Validierung.
// Alles über die Dialoge und Fenster der 3D-Welt.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let user: E2EUser;
test.beforeAll(async () => {
  user = await createTestUser("t");
});
test.afterAll(async () => {
  await deleteTestUser(user.id);
});

async function addItem(page: Page, title: string, url: string, type = "auto") {
  await page.goto(`/dorf/${user.username}?d=objekt`);
  const dialog = page.getByRole("dialog", { name: "Objekt hinzufügen" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel("Link", { exact: true }).fill(url);
  await dialog.getByLabel("Objekttyp").selectOption(type);
  await dialog.getByLabel("Titel").fill(title);
  await dialog.getByRole("button", { name: "Objekt speichern" }).click();
  return dialog;
}

test("GitHub-Repo: Vorschau mit README, Cache, Typprüfung", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();

  // Ungültige Kombination wird abgelehnt
  const wrong = await addItem(
    page,
    "Falsch",
    "https://claude.ai/public/artifacts/x",
    "github_repo",
  );
  await expect(wrong.getByRole("alert")).toContainText("passt nicht zum gewählten Objekttyp");

  // Typ wird automatisch erkannt; der Dialog schliesst sich nach dem Speichern
  await addItem(page, "Hello World Repo", "https://github.com/octocat/Hello-World");
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });

  async function refreshedAt() {
    const { data } = await admin
      .from("artifacts")
      .select("meta_refreshed_at, meta, item_type")
      .eq("owner_id", user.id)
      .eq("title", "Hello World Repo")
      .single();
    return data;
  }
  expect((await refreshedAt())?.item_type).toBe("github_repo");

  // Objekt über die Suche öffnen: Detail mit Typ, Host und (nach dem Abruf) README-Vorschau
  async function openObject() {
    await page.goto(`/dorf/${user.username}`);
    const box = page.getByRole("searchbox", { name: "Haus oder Objekt suchen" });
    await expect(box).toBeVisible({ timeout: 30_000 });
    await box.fill("Hello World");
    await page.getByRole("option").first().click();
    return page.getByRole("complementary", { name: "Zentrale" });
  }
  const side = await openObject();
  await expect(side).toContainText("GitHub-Repo");
  await expect(side).toContainText("github.com");

  await expect
    .poll(async () => (await refreshedAt())?.meta_refreshed_at, { timeout: 30_000 })
    .not.toBeNull();
  const first = await refreshedAt();
  expect(first?.meta).toMatchObject({ kind: "github" });

  const side2 = await openObject();
  await expect(side2).toContainText("README anzeigen");

  // Zweiter Aufruf innerhalb von 24 h: kein neuer Abruf (Zeitstempel unverändert)
  await openObject();
  await page.waitForTimeout(1500);
  expect((await refreshedAt())?.meta_refreshed_at).toBe(first?.meta_refreshed_at);
});

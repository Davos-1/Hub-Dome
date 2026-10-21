import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Phase 3b: GitHub-Repo per Link, Vorschau mit README, Caching 24 h, Typ-Validierung.

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

test("GitHub-Repo: Vorschau mit README, Cache, Typprüfung, Filter", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();
  await page.goto(`/dorf/${user.username}/liste`);

  // Zentrale-Abschnitt: Objekt hinzufügen
  const zentrale = page.getByRole("region", { name: "Zentrale", exact: true });
  const add = zentrale.locator("details").filter({ hasText: "Objekt hinzufügen" }).first();
  async function addItem(title: string, url: string, type = "auto") {
    if (!(await add.evaluate((d) => (d as HTMLDetailsElement).open))) {
      await add.locator("summary").click();
    }
    await add.getByLabel("Link", { exact: true }).fill(url);
    await add.getByLabel("Objekttyp").selectOption(type);
    await add.getByLabel("Titel").fill(title);
    await add.getByRole("button", { name: "Objekt speichern" }).click();
  }

  // Ungültige Kombination wird abgelehnt
  await addItem("Falsch", "https://claude.ai/public/artifacts/x", "github_repo");
  await expect(add.getByRole("alert")).toContainText("passt nicht zum gewählten Objekttyp");

  // Typ wird automatisch erkannt, Vorschau erscheint
  await addItem("Hello World Repo", "https://github.com/octocat/Hello-World");
  const card = zentrale.getByRole("listitem").filter({ hasText: "Hello World Repo" });
  await expect(card).toContainText("GitHub-Repo");
  await expect(card).toContainText("github.com");

  async function refreshedAt() {
    const { data } = await admin
      .from("artifacts")
      .select("meta_refreshed_at, meta")
      .eq("owner_id", user.id)
      .eq("item_type", "github_repo")
      .single();
    return data;
  }
  await expect
    .poll(async () => (await refreshedAt())?.meta_refreshed_at, { timeout: 30_000 })
    .not.toBeNull();
  const first = await refreshedAt();
  expect(first?.meta).toMatchObject({ kind: "github" });

  await page.reload();
  await expect(card).toContainText("README anzeigen");

  // Zweiter Aufruf innerhalb von 24 h: kein neuer Abruf (Zeitstempel unverändert)
  await page.reload();
  await page.waitForTimeout(1500);
  expect((await refreshedAt())?.meta_refreshed_at).toBe(first?.meta_refreshed_at);

  // Filter nach Typ
  await addItem("Webseite", "https://example.com/seite");
  await expect(zentrale.getByRole("listitem").filter({ hasText: "Webseite" })).toContainText(
    "Link",
  );
  await page.getByRole("link", { name: /GitHub-Repo/ }).click();
  await expect(page).toHaveURL(/typ=github_repo/);
  await expect(page.getByText("Webseite")).toHaveCount(0);
  await expect(page.getByText("Hello World Repo")).toBeVisible();
});

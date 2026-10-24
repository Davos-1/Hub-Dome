import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Phase 3b: GitHub-Repo per Link, Vorschau mit README, Caching 24 h, Eingabeprüfung.
// Alles über die Tafeln und die Suche der 3D-Welt. Einen Objekttyp wählt man seit Phase 4h nicht mehr, er wird aus
// dem Link erkannt; die Passung von Link und Typ prüfen die Unit-Tests (`validation.test.ts`, `item-types.test.ts`).

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

/** Tafel «Neues Objekt» in der Zentrale öffnen (Liste › «+» am Haus). */
async function newObject(page: Page) {
  await page.keyboard.press("l");
  const list = page.getByRole("complementary", { name: "Alle Objekte" });
  await list.getByRole("button", { name: "Objekt in Zentrale hinzufügen" }).click();
  const tafel = page.getByRole("dialog", { name: "Neues Objekt" });
  await expect(tafel).toBeVisible();
  return tafel;
}

/** Link und Titel stehen im ersten Schritt; weiter über «Einordnen» und «Freigabe» zum Speichern. */
async function fill(tafel: Locator, title: string, url: string) {
  await tafel.getByRole("textbox", { name: /^Link/ }).fill(url);
  await tafel.getByLabel("Titel").fill(title);
}
async function save(tafel: Locator) {
  await tafel.getByRole("button", { name: "Weiter" }).click(); // 2 Einordnen
  await tafel.getByRole("button", { name: "Weiter" }).click(); // 3 Freigabe
  await tafel.getByRole("button", { name: "Ans Haus hängen" }).click();
}

test("GitHub-Repo: Vorschau mit README, Cache, Eingabeprüfung", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();

  await page.goto(`/dorf/${user.username}`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  const tafel = await newObject(page);

  // Ein Link ohne https:// wird abgelehnt
  await fill(tafel, "Hello World Repo", "http://github.com/octocat/Hello-World");
  await tafel.getByRole("button", { name: "Weiter" }).click();
  await expect(tafel.getByRole("alert")).toContainText("https://");

  // Typ wird automatisch erkannt; nach dem Speichern zeigt die Tafel das neue Objekt
  await fill(tafel, "Hello World Repo", "https://github.com/octocat/Hello-World");
  await expect(tafel.getByText("GitHub-Repo erkannt")).toBeVisible();
  await save(tafel);
  await expect(page.getByRole("dialog", { name: "Hello World Repo", exact: true })).toBeVisible({
    timeout: 30_000,
  });

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

  // Objekt über die Suche öffnen: Tafel mit Typ, Host und (nach dem Abruf) README-Vorschau
  async function openObject() {
    await page.goto(`/dorf/${user.username}`);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Suchen" });
    await palette.getByRole("combobox").fill("Hello World");
    await palette.getByRole("option").first().click();
    return page.getByRole("dialog", { name: "Hello World Repo", exact: true });
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

  // Derselbe Link nochmals wird abgelehnt (ein Link gehört nur einmal ins Dorf)
  const again = await newObject(page);
  await fill(again, "Doppelt", "https://github.com/octocat/Hello-World");
  await save(again);
  await expect(again.getByRole("alert")).toContainText("schon in deinem Dorf", {
    timeout: 30_000,
  });
});

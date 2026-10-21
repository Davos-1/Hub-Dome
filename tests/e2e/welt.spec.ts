import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Welt-Shell (Phase 4c): Start-Dialog über der Welt, Reise-Dialog, Einstellungen, Haus anlegen,
// alte Adressen leiten in die Dialoge um.

let user: E2EUser;
test.beforeAll(async () => {
  user = await createTestUser("welt");
});
test.afterAll(async () => {
  await deleteTestUser(user.id);
});

test("Start-Dialog über der Welt, Reise, Einstellungen und Haus anlegen", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Nach dem Login: eigene Welt mit Start-Dialog; die Szene lädt im Hintergrund
  await page.goto("/start");
  await expect(page).toHaveURL(new RegExp(`/dorf/${user.username}\\?d=start`), { timeout: 30_000 });
  const start = page.getByRole("dialog", { name: /Willkommen zurück/ });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await expect(start.getByText("neu (7 Tage)")).toBeVisible();

  // Fokusfalle: Tab bleibt im Dialog
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("[data-hd-dialog]"))).toBe(
    true,
  );

  // Reise-Dialog, Esc schliesst
  await start.getByRole("button", { name: /Dörfer besuchen/ }).click();
  const travel = page.getByRole("dialog", { name: "Dörfer besuchen" });
  await expect(travel.getByText(/^Dein Dorf ·/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Einstellungen als Dialog mit Tabs
  await page.getByRole("button", { name: "Einstellungen" }).click();
  const settings = page.getByRole("dialog", { name: "Einstellungen" });
  await settings.getByRole("tab", { name: "Profil" }).click();
  await expect(settings.getByLabel("Anzeigename")).toBeVisible();
  await settings.getByRole("tab", { name: "Teilen" }).click();
  await expect(settings.getByRole("button", { name: "Einladungslink erstellen" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Haus anlegen im Dialog, danach findet die Suche das Haus
  await page.getByRole("button", { name: "+ Haus" }).click();
  const add = page.getByRole("dialog", { name: "Haus anlegen" });
  await add.getByLabel("Themenhaus").check();
  await add.getByLabel("Titel").fill("Welt-Test");
  await add.getByRole("button", { name: "Haus anlegen" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  const box = page.getByRole("searchbox", { name: "Haus oder Objekt suchen" });
  await box.fill("Welt-Test");
  await expect(page.getByRole("option").first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("alte Adressen leiten in die Dialoge um", async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();
  await page.goto("/doerfer");
  await expect(page).toHaveURL(/\?d=reise/, { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: "Dörfer besuchen" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\?d=einstellungen/, { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: "Einstellungen" })).toBeVisible({
    timeout: 30_000,
  });
});

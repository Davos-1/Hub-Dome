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
  await start.getByRole("button", { name: /Reise und Freunde/ }).click();
  const travel = page.getByRole("dialog", { name: "Reise und Freunde" });
  await expect(travel.getByText(/^Dein Dorf ·/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Einstellungen als Dialog mit Tabs; kein Upload eigener Modelle
  await page.getByRole("button", { name: "Einstellungen" }).click();
  const settings = page.getByRole("dialog", { name: "Einstellungen" });
  await settings.getByRole("tab", { name: "Profil" }).click();
  await expect(settings.getByLabel("Anzeigename")).toBeVisible();
  await settings.getByRole("tab", { name: "Dorf" }).click();
  await expect(settings.getByText("Stil der Zentrale")).toBeVisible();
  await expect(settings.getByText(/hochladen/i)).toHaveCount(0);
  await expect(settings.getByRole("tab", { name: "Anzeige" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Anzeige: eigenes kleines Fenster mit Tageszeit, Ansicht und Filter
  await page.getByRole("button", { name: "Mittag" }).click();
  const display = page.getByRole("complementary", { name: "Anzeige" });
  await expect(display.getByText("Tageszeit")).toBeVisible();
  await expect(display.getByText("Ansicht", { exact: true })).toBeVisible();
  await expect(display.getByText("Nach Kategorie filtern")).toBeVisible();
  await display
    .getByRole("button", { name: "Schliessen" })
    .or(display.getByLabel("Anzeige schliessen"))
    .first()
    .click();
  await expect(display).toHaveCount(0);

  // Haus anlegen im Dialog, danach findet die Suche das Haus
  await page.getByRole("button", { name: "+ Haus" }).click();
  const add = page.getByRole("dialog", { name: "Haus anlegen" });
  await add.getByLabel("Themenhaus").check();
  await add.getByLabel("Titel").fill("Welt-Test");
  await add.getByRole("button", { name: "Haus anlegen" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  const box = page.getByRole("searchbox", { name: "Haus oder Objekt suchen" });
  await box.fill("Welt-Test");
  await page.getByRole("option").first().click();

  // Haus bearbeiten (Titel ändern), danach löschen
  const side = page.getByRole("complementary", { name: "Welt-Test" });
  await side.getByRole("button", { name: "Haus bearbeiten" }).click();
  const edit = page.getByRole("dialog", { name: "Haus bearbeiten" });
  await edit.getByLabel("Titel").fill("Welt-Test 2");
  await edit.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("complementary", { name: "Welt-Test 2" })).toBeVisible({
    timeout: 20_000,
  });
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("complementary", { name: "Welt-Test 2" })
    .getByRole("button", { name: "Haus bearbeiten" })
    .click();
  await page
    .getByRole("dialog", { name: "Haus bearbeiten" })
    .getByRole("button", { name: "Haus löschen" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  await box.fill("Welt-Test");
  await expect(page.getByText("Keine Treffer")).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("alte Adressen leiten in die Dialoge um", async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();
  await page.goto("/doerfer");
  await expect(page).toHaveURL(/\?d=reise/, { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: "Reise und Freunde" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\?d=einstellungen/, { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: "Einstellungen" })).toBeVisible({
    timeout: 30_000,
  });
});

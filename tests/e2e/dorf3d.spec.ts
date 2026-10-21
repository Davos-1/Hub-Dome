import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, seedVillage, type E2EUser } from "./helpers";

// Abnahme Phase 4: Dorf mit 10 Häusern und 60 Objekten, alles aus der Liste auch in 3D erreichbar.

let big: E2EUser;
let empty: E2EUser;

test.beforeAll(async () => {
  [big, empty] = await Promise.all([createTestUser("big"), createTestUser("leer")]);
  await seedVillage(big.id, 10, 6);
});
test.afterAll(async () => {
  await Promise.all([deleteTestUser(big.id), deleteTestUser(empty.id)]);
});

test("grosses Dorf: Szene rendert, Aufwand bleibt klein, Navigation über das Panel", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, big);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/dorf/${big.username}`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__hubDome?.artifacts === 60, undefined, {
    timeout: 30_000,
  });

  await page.screenshot({ path: "test-results/dorf3d-uebersicht.png" });

  // Render-Aufwand: wenige Draw Calls und Dreiecke → flüssig auf Mittelklasse-Laptops
  const stats = await page.evaluate(() => window.__hubDome!);
  console.log("Render-Statistik 10 Häuser / 60 Objekte:", JSON.stringify(stats));
  expect(stats.houses).toBe(11);
  expect(stats.calls).toBeLessThan(900);
  expect(stats.triangles).toBeLessThan(400_000);

  // Alle Häuser sind im Panel erreichbar; jedes zeigt seine 6 Objekte
  const panel = page.getByLabel("Details");
  for (const n of [1, 10]) {
    await panel.getByRole("button", { name: new RegExp(`^Haus ${n}\\b`) }).click();
    await expect(panel.getByRole("button", { name: /^.{0,3}Objekt \d+\.\d+/ })).toHaveCount(6);
    await page.getByRole("button", { name: "← Zurück zur Übersicht" }).click();
  }

  // Objekt-Detail mit «Öffnen»-Link (neuer Tab, noopener)
  await panel.getByRole("button", { name: /^Haus 2\b/ }).click();
  await panel.getByRole("button", { name: /Objekt 2\.1/ }).click();
  const open = panel.getByRole("link", { name: "Öffnen" });
  await page.waitForTimeout(1500); // Kamerafahrt abwarten
  await page.screenshot({ path: "test-results/dorf3d-haus.png" });
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", /noopener/);
  await page.keyboard.press("Escape"); // zurück zum Haus
  await expect(panel.getByRole("button", { name: /Objekt 2\.1/ })).toBeVisible();
  await page.keyboard.press("Escape"); // zurück zur Übersicht
  await expect(panel.getByText("10 Häuser · 60 Objekte")).toBeVisible();

  // 2D-Fallback ist immer sichtbar und führt zur Liste
  await page.getByRole("link", { name: "Zur Listenansicht" }).click();
  await expect(page).toHaveURL(new RegExp(`/dorf/${big.username}/liste`));
  expect(errors).toEqual([]);
});

test("reduzierte Bewegung: Kamera springt, kein Fehler", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await loginAs(ctx, big);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/dorf/${big.username}`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page
    .getByLabel("Details")
    .getByRole("button", { name: /^Haus 3\b/ })
    .click();
  await expect(page.getByRole("button", { name: "← Zurück zur Übersicht" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("leeres Dorf zeigt den Hinweis zum ersten Haus", async ({ browser }) => {
  const ctx = await browser.newContext();
  await loginAs(ctx, empty);
  const page = await ctx.newPage();
  await page.goto(`/dorf/${empty.username}`);
  await expect(page.getByText("Lege dein erstes Modulhaus an")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
});

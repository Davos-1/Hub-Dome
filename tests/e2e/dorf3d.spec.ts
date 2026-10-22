import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, seedVillage, type E2EUser } from "./helpers";

// Abnahme 3D-Dorf (Design-Handoff): Vollbild, Quartiere, Suche, Navigation, Filter, Tageszeit, Karte.

let big: E2EUser;
let empty: E2EUser;

test.beforeAll(async () => {
  [big, empty] = await Promise.all([createTestUser("big"), createTestUser("leer")]);
  await seedVillage(big.id, 10, 6);
});
test.afterAll(async () => {
  await Promise.all([deleteTestUser(big.id), deleteTestUser(empty.id)]);
});

const breadcrumb = (page: Page) => page.getByRole("navigation", { name: "Ebene im Dorf" });

async function search(page: Page, text: string) {
  const box = page.getByRole("searchbox", { name: "Haus oder Objekt suchen" });
  await box.fill(text);
  await page.getByRole("option").first().click();
}

test("grosses Dorf: Szene rendert, Aufwand bleibt klein, Navigation Dorf › Quartier › Haus", async ({
  browser,
}) => {
  test.setTimeout(150_000);
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
  await page.waitForTimeout(1500); // Beschriftungen (Schrift, Atlas) aufbauen
  await page.screenshot({ path: "test-results/dorf3d-uebersicht.png" });

  // Render-Aufwand: wenige Draw Calls und Dreiecke → flüssig auf Mittelklasse-Laptops
  const stats = await page.evaluate(() => window.__hubDome!);
  console.log("Render-Statistik 10 Häuser / 60 Objekte:", JSON.stringify(stats));
  expect(stats.houses).toBe(11);
  expect(stats.calls).toBeLessThan(250);
  expect(stats.triangles).toBeLessThan(600_000);

  // Suche → Haus öffnen: Brotkrumen, Fenster mit den 6 Objekten
  await search(page, "Haus 10");
  await expect(breadcrumb(page).getByText("Haus 10")).toBeVisible();
  const side = page.getByRole("complementary", { name: "Haus 10" });
  await expect(side.getByRole("button", { name: /Objekt 10\.\d/ })).toHaveCount(6);
  await page.waitForTimeout(1500); // Kamerafahrt abwarten
  await page.screenshot({ path: "test-results/dorf3d-haus.png" });

  // Objekt-Detail mit «Öffnen»-Link (neuer Tab, noopener)
  await side.getByRole("button", { name: /Objekt 10\.1/ }).click();
  const open = side.getByRole("link", { name: "Öffnen" });
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", /noopener/);

  // Esc: Objekt → Haus → Quartier → Dorf
  await page.keyboard.press("Escape");
  await expect(side.getByRole("button", { name: /Objekt 10\.1/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(breadcrumb(page).getByText("Haus 10")).toHaveCount(0);
  await expect(page.getByRole("complementary")).toBeVisible(); // Quartier
  await page.keyboard.press("Escape");
  await expect(breadcrumb(page).getByText("Haus 10")).toHaveCount(0);
  await expect(page.getByRole("complementary")).toHaveCount(0);

  // Tastatur: Pfeil wählt ein Quartier, Enter öffnet es
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Quartier", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // Kleines Anzeige-Fenster: Tageszeit, Ansicht und Filter; die Wahl bleibt nach dem Neuladen erhalten
  await page.getByRole("button", { name: "Mittag" }).click();
  const display = page.getByRole("complementary", { name: "Anzeige" });
  await expect(display).toBeVisible();
  await display.getByRole("button", { name: "Quiz", exact: true }).click();
  await display.getByRole("button", { name: "Abend", exact: true }).click();
  await display.getByRole("button", { name: "Karte", exact: true }).click();
  await expect(display.getByRole("button", { name: "Karte", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/dorf3d-karte.png" });
  await page.reload();
  await expect(page.getByRole("button", { name: /Abend/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Quiz/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Karte", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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
  await search(page, "Haus 3");
  await expect(breadcrumb(page).getByText("Haus 3")).toBeVisible();
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

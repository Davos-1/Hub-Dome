import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, seedVillage, type E2EUser } from "./helpers";

// Abnahme 3D-Dorf (Oberfläche «Werkbank», Phase 4h): Vollbild, Quartiere, Suche, Navigation, Auswahl am Haus
// mit Tafel, Leiste unten (Ansicht, Tageszeit, Kategorie).

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

/** Befehlspalette (Strg+K): Begriff eingeben und den ersten Treffer wählen (Haus öffnen bzw. Objekt zeigen). */
async function search(page: Page, text: string) {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Suchen" });
  await palette.getByRole("combobox").fill(text);
  await palette.getByRole("option").first().click();
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

  // Suche → Haus wählen: Brotkrumen; nach der Kamerafahrt (2.0–3.2 s) erscheinen die Kacheln am Haus
  await search(page, "Haus 10");
  await expect(breadcrumb(page).getByText("Haus 10")).toBeVisible();
  const tiles = page.getByRole("toolbar", { name: "Aktionen für Haus 10" });
  await expect(tiles.getByLabel("6 Objekte")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "test-results/dorf3d-haus.png" });

  // «Öffnen» zeigt die Tafel mit den 6 Objekten
  await tiles.getByRole("button", { name: "Öffnen" }).click();
  const side = page.getByRole("dialog", { name: "Haus 10", exact: true });
  await expect(side.getByRole("button", { name: /Objekt 10\.\d/ })).toHaveCount(6);

  // Objekt-Tafel mit «Öffnen»-Link (neuer Tab, noopener)
  await side.getByRole("button", { name: /Objekt 10\.1/ }).click();
  const detail = page.getByRole("dialog", { name: "Objekt 10.1", exact: true });
  const open = detail.getByRole("link", { name: "Öffnen" });
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", /noopener/);

  // Esc von innen nach aussen: Tafel zu (das Haus bleibt gewählt) → Auswahl weg
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(breadcrumb(page).getByText("Haus 10")).toBeVisible();
  await expect(tiles).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(breadcrumb(page).getByText("Haus 10")).toHaveCount(0);
  await expect(tiles).toHaveCount(0);

  // Tastatur: Pfeil wählt ein Quartier, Enter öffnet es (Tafel «Quartier»); Esc schliesst die Tafel, nochmals Esc → Dorf
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByText("Quartier", { exact: true })).toBeVisible();
  await expect(breadcrumb(page).getByRole("button")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(breadcrumb(page).getByRole("button")).toHaveCount(1);

  // Leiste unten: Tageszeit, Ansicht und Kategorie-Filter; die Wahl bleibt nach dem Neuladen erhalten
  const time = page.getByRole("button", { name: /^Tageszeit:/ });
  // Der erste Klick auf die Tageszeit heisst «Fest» und wird im Profil gespeichert (Server Action)
  const persisted = page
    .waitForResponse(
      (r) => r.request().method() === "POST" && "next-action" in r.request().headers(),
      { timeout: 20_000 },
    )
    .catch(() => null);
  for (let i = 0; i < 5; i++) {
    if (/^Tageszeit: Abend\./.test((await time.getAttribute("aria-label")) ?? "")) break;
    await time.click();
  }
  await expect(time).toHaveAttribute("aria-label", /^Tageszeit: Abend\./);
  await page.getByRole("button", { name: "Kategorie zeigen" }).click();
  await page
    .getByRole("group", { name: "Kategorie zeigen" })
    .getByRole("button", { name: "Quiz", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Kategorie: Quiz" })).toBeVisible();
  const karte = page.getByRole("switch", { name: "Karte statt 3D" });
  await karte.click();
  await expect(karte).toBeChecked();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/dorf3d-karte.png" });
  await persisted;
  await page.reload();
  await expect(page.getByRole("button", { name: /^Tageszeit: Abend\./ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Kategorie: Quiz" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Karte statt 3D" })).toBeChecked();
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
  await expect(page.getByRole("toolbar", { name: "Aktionen für Haus 3" })).toBeVisible({
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

test("leeres Dorf zeigt den Hinweis zum ersten Haus", async ({ browser }) => {
  const ctx = await browser.newContext();
  await loginAs(ctx, empty);
  const page = await ctx.newPage();
  await page.goto(`/dorf/${empty.username}`);
  await expect(page.getByText("Lege dein erstes Haus an")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
});

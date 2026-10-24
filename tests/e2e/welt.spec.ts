import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, seedVillage, type E2EUser } from "./helpers";

// Abnahme Welt-Shell (Phase 4c, Oberfläche «Werkbank» seit 4h): Start-Dialog über der Welt, Reise (Inselkarte) und
// Einstellungen als Vollbild, Leiste unten, Haus anlegen und bearbeiten in Tafeln, Liste als Seitenleiste,
// alte Adressen leiten in die neuen Bereiche um.

let user: E2EUser;
test.beforeAll(async () => {
  user = await createTestUser("welt");
});
test.afterAll(async () => {
  await deleteTestUser(user.id);
});

/** Befehlspalette (Strg+K) öffnen und einen Begriff eingeben. */
async function openSearch(page: Page, text: string) {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Suchen" });
  await palette.getByRole("combobox").fill(text);
  return palette;
}

test("Start-Dialog über der Welt, Reise, Einstellungen und Haus anlegen", async ({ browser }) => {
  test.setTimeout(240_000);
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

  // Reise: Inselkarte im Vollbild mit dem eigenen Dorf, Esc schliesst
  await start.getByRole("button", { name: /Reise und Freunde/ }).click();
  const travel = page.getByRole("dialog", { name: "Reise", exact: true });
  await expect(travel.getByRole("button", { name: /^Dein Dorf / })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Einstellungen als Vollbild mit Bereichen; kein Upload eigener Modelle
  await page.getByRole("button", { name: "Einstellungen" }).click();
  const settings = page.getByRole("dialog", { name: "Einstellungen" });
  await settings.getByRole("tab", { name: "Profil" }).click();
  await expect(settings.getByLabel("Anzeigename")).toBeVisible();
  await settings.getByRole("tab", { name: "Dorf" }).click();
  await expect(settings.getByText("Stil der Zentrale")).toBeVisible();
  await expect(settings.getByRole("group", { name: "Tageszeit" })).toBeVisible();
  await expect(settings.getByText(/hochladen/i)).toHaveCount(0);
  await expect(settings.getByRole("tab", { name: "Anzeige" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Anzeige: Leiste unten mit Ansicht, Tageszeit und Kategorie (der Filter klappt auf und wieder zu)
  await expect(page.getByRole("switch", { name: "Karte statt 3D" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Tageszeit:/ })).toBeVisible();
  await page.getByRole("button", { name: "Kategorie zeigen" }).click();
  const chips = page.getByRole("group", { name: "Kategorie zeigen" });
  await expect(chips.getByRole("button", { name: "Alle" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Kategorie zeigen" }).click();
  await expect(chips).toHaveCount(0);

  // Haus anlegen in der Tafel (im leeren Dorf steht der Knopf im Hinweis und in der Leiste: der erste genügt)
  await page.getByRole("button", { name: "Haus anlegen" }).first().click();
  const add = page.getByRole("dialog", { name: "Haus anlegen", exact: true });
  await add.getByRole("button", { name: "Eigenes Thema" }).click();
  await add.getByLabel("Titel").fill("Welt-Test");
  await add.getByRole("button", { name: "Haus anlegen" }).click();
  await expect(page.getByRole("status").getByText(/Haus «Welt-Test» angelegt/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Die Suche findet das Haus und wählt es; die Kachel «Bearbeiten» öffnet die Tafel (Titel ändern)
  await (await openSearch(page, "Welt-Test")).getByRole("option").first().click();
  const tiles = page.getByRole("toolbar", { name: "Aktionen für Welt-Test" });
  await tiles.getByRole("button", { name: "Bearbeiten" }).click({ timeout: 30_000 });
  const edit = page.getByRole("dialog", { name: "Welt-Test", exact: true });
  await edit.getByLabel("Titel").fill("Welt-Test 2");
  await edit.getByRole("button", { name: "Speichern" }).click();
  // Danach zeigt die Tafel das Haus mit dem neuen Titel
  const house = page.getByRole("dialog", { name: "Welt-Test 2", exact: true });
  await expect(house).toBeVisible({ timeout: 20_000 });

  // Löschen läuft verzögert: die Meldung bietet «Rückgängig» an; nach 5 s geht es an den Server
  await house.getByRole("button", { name: "Haus bearbeiten" }).click();
  await house.getByRole("button", { name: "Haus löschen" }).click();
  const gone = page.getByRole("status").filter({ hasText: "Haus «Welt-Test 2» gelöscht" });
  await expect(gone.getByRole("button", { name: "Rückgängig" })).toBeVisible();
  await expect(gone).toHaveCount(0, { timeout: 15_000 });
  // Danach findet die Suche das Haus auch nach dem Neuladen nicht mehr (der Server braucht einen Moment)
  await expect(async () => {
    await page.reload();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    const palette = await openSearch(page, "Welt-Test");
    await expect(palette.getByText("Nichts gefunden")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 90_000 });
  expect(errors).toEqual([]);
});

test("alte Adressen leiten in die neuen Bereiche um", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();
  await page.goto("/doerfer");
  await expect(page).toHaveURL(/\?d=reise/, { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: "Reise", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\?d=einstellungen/, { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: "Einstellungen" })).toBeVisible({
    timeout: 30_000,
  });

  // Liste und «Haus anlegen» sind keine Dialoge mehr: die alten Adressen öffnen Seitenleiste bzw. Tafel
  await page.goto(`/dorf/${user.username}/liste`);
  await expect(page.getByRole("complementary", { name: "Alle Objekte" })).toBeVisible({
    timeout: 30_000,
  });
  await page.goto(`/dorf/${user.username}?d=haus`);
  await expect(page.getByRole("dialog", { name: "Haus anlegen", exact: true })).toBeVisible({
    timeout: 30_000,
  });
});

test("Liste als Seitenleiste: Suche, Kategorie, Tastenkürzel und Haus zeigen", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const lister = await createTestUser("liste");
  try {
    await seedVillage(lister.id, 4, 5);
    const ctx = await browser.newContext();
    await loginAs(ctx, lister);
    const page = await ctx.newPage();
    await page.goto(`/dorf/${lister.username}`);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });

    // Tastenkürzel L öffnet die Liste; alle 4 Häuser (und die Zentrale) mit 20 Objekten sind da
    await page.keyboard.press("l");
    const list = page.getByRole("complementary", { name: "Alle Objekte" });
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list.getByText("20 in 5 Häusern")).toBeVisible();
    await expect(list.getByText("Haus 1", { exact: true })).toBeVisible();

    // Suche und Kategorie (die Suche kennt auch die Kategorie; Quiz ist jeweils das zweite Objekt)
    const box = list.getByLabel("Objekte suchen");
    await box.fill("Objekt 2.3");
    await expect(list.getByRole("button", { name: "Objekt 2.3" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Objekt 1.1" })).toHaveCount(0);
    await box.fill("Quiz");
    await expect(list.getByRole("button", { name: "Objekt 1.2" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Objekt 1.1" })).toHaveCount(0);
    await box.fill("");

    // Ein Haus in der Liste wählen fliegt hin (die Liste bleibt offen) und zeigt es in den Brotkrumen
    await list.getByRole("button", { name: /^Haus 1 \d+$/ }).click();
    await expect(page.getByRole("navigation", { name: "Ebene im Dorf" })).toContainText("Haus 1");
    await expect(list.getByRole("treeitem", { selected: true })).toHaveCount(1);
    await expect(list).toBeVisible();

    // Ein Objekt in der Liste öffnet seine Tafel; Esc von innen nach aussen: Tafel, Auswahl, Liste
    await list.getByRole("button", { name: "Objekt 1.2" }).click();
    await expect(page.getByRole("dialog", { name: "Objekt 1.2", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Ebene im Dorf" }).getByRole("button")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
  } finally {
    await deleteTestUser(lister.id);
  }
});

test("Haus löschen lässt sich rückgängig machen", async ({ browser }) => {
  test.setTimeout(180_000);
  const owner = await createTestUser("undo");
  try {
    await seedVillage(owner.id, 1, 1);
    const ctx = await browser.newContext();
    await loginAs(ctx, owner);
    const page = await ctx.newPage();
    await page.goto(`/dorf/${owner.username}`);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await (await openSearch(page, "Haus 1")).getByRole("option").first().click();
    await page
      .getByRole("toolbar", { name: "Aktionen für Haus 1" })
      .getByRole("button", { name: "Bearbeiten" })
      .click({ timeout: 30_000 });
    await page
      .getByRole("dialog", { name: "Haus 1", exact: true })
      .getByRole("button", { name: /löschen$/ })
      .click();

    // Die Meldung steht nur 5 s und die Welt baut sich dabei neu auf: das Klick-Ereignis direkt auslösen, ohne zu warten,
    // bis der Knopf «still steht»
    const gone = page.getByRole("status").filter({ hasText: "Haus «Haus 1» gelöscht" });
    await gone.getByRole("button", { name: "Rückgängig" }).dispatchEvent("click");
    await expect(gone).toHaveCount(0);

    // Haus und Objekt sind wieder da, auch nach dem Neuladen (so lange hätte das Löschen gedauert)
    await page.waitForTimeout(5_500);
    await page.reload();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    const palette = await openSearch(page, "Objekt 1.1");
    await expect(palette.getByRole("option").first()).toContainText("Objekt 1.1");
  } finally {
    await deleteTestUser(owner.id);
  }
});

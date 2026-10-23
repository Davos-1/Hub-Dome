import { expect, test } from "@playwright/test";

// Phase 4f: Landschaft aus dem Seed, «Welt neu würfeln» als Vorschau (ohne Datenbank über /dev/dorf).

const ready = { timeout: 120_000 };

test("Welt neu würfeln: Vorschau in der Szene, nochmals, verwerfen, übernehmen", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dev/dorf?h=6&o=3&seed=hubdome1&besitzer=1&bewegung=0");
  await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, ready);

  // Einstellungen › Dorf zeigt Landschaft und Seed
  await page.getByRole("button", { name: "Einstellungen" }).click();
  const settings = page.getByRole("dialog", { name: "Einstellungen" });
  await settings.getByRole("tab", { name: "Dorf" }).click();
  await expect(settings.getByText("Landschaft", { exact: true })).toBeVisible();
  await expect(settings.getByText(/Welt «hubdome1»/)).toBeVisible();

  // Würfeln öffnet die Vorschau über der Szene (Dialog zu)
  await settings.getByRole("button", { name: /Welt neu würfeln/ }).click();
  const banner = page.getByRole("dialog", { name: "Vorschau: neue Welt" });
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/^Neue Landschaft:/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Einstellungen" })).toHaveCount(0);

  // Nochmals würfeln und verwerfen
  await banner.getByRole("button", { name: "Nochmals würfeln" }).click();
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Verwerfen" }).click();
  await expect(banner).toHaveCount(0);

  // Übernehmen braucht eine zweite Bestätigung
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByRole("tab", { name: "Dorf" }).click();
  await page.getByRole("button", { name: /Welt neu würfeln/ }).click();
  await banner.getByRole("button", { name: "Übernehmen …" }).click();
  await banner.getByRole("button", { name: "Ja, diese Welt übernehmen" }).click();
  await expect(banner).toHaveCount(0, { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("Phase 4g: Dorf auf Generator v1 lässt sich mit Vorschau auf die neue Welt-Version aktualisieren", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dev/dorf?h=6&o=3&seed=hubdome1&besitzer=1&bewegung=0&v=1");
  await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, ready);
  await page.getByRole("button", { name: "Einstellungen" }).click();
  const settings = page.getByRole("dialog", { name: "Einstellungen" });
  await settings.getByRole("tab", { name: "Dorf" }).click();
  await expect(settings.getByText(/Generator 1/)).toBeVisible();
  await settings.getByRole("button", { name: /Auf neue Welt-Version aktualisieren/ }).click();
  const banner = page.getByRole("dialog", { name: "Vorschau: neue Welt-Version" });
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/^Neue Welt-Version:/)).toBeVisible();
  // Aktualisieren behält den Seed: kein «Nochmals würfeln»
  await expect(banner.getByRole("button", { name: "Nochmals würfeln" })).toHaveCount(0);
  await banner.getByRole("button", { name: "Übernehmen …" }).click();
  await banner.getByRole("button", { name: "Ja, diese Welt übernehmen" }).click();
  await expect(banner).toHaveCount(0, { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("Besucher sehen keinen Würfel-Knopf", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dev/dorf?h=4&o=2&seed=hubdome1&bewegung=0");
  await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, ready);
  await expect(page.getByRole("button", { name: /Welt neu würfeln/ })).toHaveCount(0);
});

test("gleicher Seed, gleiche Welt; anderer Seed, andere Welt (Render-Statistik)", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const stats = async (seed: string) => {
    await page.goto(`/dev/dorf?h=10&o=4&seed=${seed}&bewegung=0&kamera=vogel`);
    await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, ready);
    return page.evaluate(() => window.__hubDome!.triangles);
  };
  const a1 = await stats("hubdome1");
  const a2 = await stats("hubdome1");
  const b = await stats("b7k2m9qx");
  expect(a2).toBe(a1);
  expect(b).not.toBe(a1);
});

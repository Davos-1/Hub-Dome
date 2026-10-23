import { expect, test } from "@playwright/test";
import { FACH_ORDER } from "../../src/lib/fachbereiche";
import { ZENTRALE_STYLES } from "../../src/lib/styles";

// Rauchtest ohne Datenbank: jeder Haustyp (Fachbereich) und jeder Zentrale-Stil rendert fehlerfrei (Entwickler-Routen /dev/*).

test("Stil-Galerie: alle Haustypen und Zentrale-Stile rendern ohne Fehler", async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const fach of FACH_ORDER) {
    await page.goto(`/dev/stile?fach=${fach}&zentrale=rathaus`);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  }
  for (const zentrale of ZENTRALE_STYLES) {
    await page.goto(`/dev/stile?fach=grundlagen&zentrale=${zentrale}`);
    await expect(page.locator("canvas").nth(1)).toBeVisible({ timeout: 30_000 });
  }
  expect(errors).toEqual([]);
});

test("Dorf mit Leben (Fluss, Tiere, Wege) rendert, Aufwand bleibt klein", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dev/dorf?h=10&o=6&zentrale=hochhaus");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__hubDome?.houses === 11, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  // Mit LiveFrames werden laufend neue Frames erzeugt: die Statistik darf klein bleiben
  const stats = await page.evaluate(() => window.__hubDome!);
  expect(stats.calls).toBeLessThan(250);
  expect(stats.triangles).toBeLessThan(700_000);
  expect(errors).toEqual([]);
});

test("Bei reduzierter Bewegung steht die Szene still und bleibt fehlerfrei", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dev/dorf?h=6&o=4");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, {
    timeout: 60_000,
  });
  // Nach dem Fertigwerden zeichnet die Szene noch ein paar Frames (mit SwiftShader langsam), dann nichts mehr:
  // warten, bis der Zähler ruht, danach darf kein weiterer Frame entstehen (keine laufende Animation)
  const frames = () => page.evaluate(() => window.__hubDome!.frames ?? 0);
  let before = await frames();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1500);
    const now = await frames();
    if (now === before) break;
    before = now;
  }
  expect(before).toBeGreaterThan(0);
  await page.waitForTimeout(2000);
  expect(await frames()).toBe(before);
  expect(errors).toEqual([]);
  await ctx.close();
});

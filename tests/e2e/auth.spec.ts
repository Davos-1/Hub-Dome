import { expect, test } from "@playwright/test";

test("Geschützte Seiten leiten auf /login um", async ({ page }) => {
  for (const path of ["/doerfer", "/onboarding"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

test("Login-Formular lehnt ungültige E-Mail ab", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill("kein-mail");
  await page.getByRole("button", { name: "Anmelde-Link senden" }).click();
  await expect(page.locator("input:invalid, [role=alert]").first()).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("Geschützte Seiten leiten auf /login um", async ({ page }) => {
  for (const path of ["/doerfer", "/onboarding"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

test("Login-Formular lehnt ungültige E-Mail ab", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill("kein-mail");
  await page.getByRole("button", { name: "Anmelde-Link senden" }).click();
  await expect(page.locator("input:invalid, [role=alert]").first()).toBeVisible();
});

test("Eingabefelder bleiben im Dunkelmodus lesbar", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  const style = await page.getByLabel("E-Mail-Adresse").evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      bg: s.backgroundColor,
      color: s.color,
      body: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(style.bg).toBe("rgb(255, 255, 255)");
  expect(style.color).toBe("rgb(28, 27, 25)");
  expect(style.body).toBe("rgb(255, 255, 255)");
});

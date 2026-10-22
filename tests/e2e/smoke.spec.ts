import { expect, test } from "@playwright/test";

test("Startseite leitet ohne Anmeldung zum Login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

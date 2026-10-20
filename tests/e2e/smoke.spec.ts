import { expect, test } from "@playwright/test";

test("Startseite zeigt den Titel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hub Dome" })).toBeVisible();
});

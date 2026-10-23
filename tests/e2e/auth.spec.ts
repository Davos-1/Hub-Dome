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

// Oberfläche «Rauchglas» (Phase 4g): dunkle Felder mit heller Schrift, egal ob das System hell oder dunkel ist
for (const colorScheme of ["light", "dark"] as const) {
  test(`Eingabefelder sind lesbar (System ${colorScheme === "dark" ? "dunkel" : "hell"})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/login");
    const style = await page.getByLabel("E-Mail-Adresse").evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        color: s.color,
        body: getComputedStyle(document.body).backgroundColor,
        scheme: s.colorScheme,
      };
    });
    expect(style.color).toBe("rgb(244, 244, 245)");
    expect(style.bg).toBe("rgba(0, 0, 0, 0.25)");
    expect(style.body).toBe("rgb(20, 20, 23)");
    expect(style.scheme).toBe("dark");
  });
}

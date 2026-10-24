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

// Oberfläche «Werkbank» (Phase 4h): dunkle Felder mit heller Schrift, egal ob das System hell oder dunkel ist.
// Verglichen wird mit den Design-Tokens selbst (nicht mit festen Werten).
for (const colorScheme of ["light", "dark"] as const) {
  test(`Eingabefelder sind lesbar (System ${colorScheme === "dark" ? "dunkel" : "hell"})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/login");
    const style = await page.getByLabel("E-Mail-Adresse").evaluate((el) => {
      const s = getComputedStyle(el);
      // Token-Farben über ein Hilfselement auflösen
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      const token = (name: string) => {
        probe.style.color = `var(${name})`;
        return getComputedStyle(probe).color;
      };
      const out = {
        bg: s.backgroundColor,
        color: s.color,
        scheme: s.colorScheme,
        ink: token("--hd-ink"),
        field: token("--hd-field"),
      };
      probe.remove();
      return out;
    });
    expect(style.color).toBe(style.ink);
    expect(style.bg).toBe(style.field);
    expect(style.scheme).toBe("dark");
  });
}

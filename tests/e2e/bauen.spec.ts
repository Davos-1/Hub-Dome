import { expect, test, type Page } from "@playwright/test";

// Phase 4f, Etappe 4: Bau-Modus ohne Datenbank über /dev/dorf (Speichern landet im Speicher des Dev-Servers).

const ready = { timeout: 120_000 };

async function open(page: Page, query: string) {
  await page.goto(`/dev/dorf?${query}&bewegung=0`);
  await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, ready);
}

test("Bau-Modus: setzen per Tastatur, rückgängig, speichern, nach dem Neuladen noch da", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Eigener Seed pro Lauf: der Speicher des Dev-Servers bleibt zwischen Läufen bestehen
  const seed = `bau${Date.now().toString(36).slice(-5)}`.padEnd(8, "0").slice(0, 8);
  await open(page, `h=4&o=3&besitzer=1&seed=${seed}`);

  await page.getByRole("button", { name: "Bauen" }).click();
  const panel = page.getByRole("region", { name: "Bau-Modus" });
  const ansage = page.getByTestId("bau-ansage");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("0 / 120 eigene Elemente")).toBeVisible();

  // Werkzeug wählen: Vorschau an einer gültigen Stelle, Enter setzt
  await panel.getByRole("button", { name: "Bank", exact: true }).click();
  await expect(ansage).toContainText("Enter");
  await page.keyboard.press("Enter");
  await expect(ansage).toHaveText(/Bank gesetzt/);
  await expect(panel.getByText("1 / 120 eigene Elemente")).toBeVisible();

  // Zweites Element in einer anderen Gruppe
  await panel.getByRole("tab", { name: "Natur" }).click();
  await panel.getByRole("button", { name: "Busch", exact: true }).click();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("2 / 120 eigene Elemente")).toBeVisible();

  // Rückgängig und Wiederholen (Tastatur)
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await expect(panel.getByText("1 / 120 eigene Elemente")).toBeVisible();
  await page.keyboard.press("Control+y");
  await expect(panel.getByText("2 / 120 eigene Elemente")).toBeVisible();

  // Haus anpassen ohne Maus: Haus aus der Liste wählen, Farbe und Anbau setzen
  await panel.getByRole("combobox").selectOption({ label: "Haus 3" });
  await panel.getByRole("button", { name: "Kalk" }).click();
  await panel.getByRole("button", { name: "Laube", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Laube", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await panel.getByRole("button", { name: "Zurück zum Katalog" }).click();

  // Speichern: Leiste kommt zurück; nach dem Neuladen sind beide Elemente noch da
  await panel.getByRole("button", { name: "Speichern" }).click();
  await expect(panel).toHaveCount(0, { timeout: 30_000 });
  await open(page, `h=4&o=3&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  await expect(panel.getByText("2 / 120 eigene Elemente")).toBeVisible();
  await panel.getByRole("combobox").selectOption({ label: "Haus 3" });
  await expect(panel.getByRole("button", { name: "Laube", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByRole("button", { name: /Kalk/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  // Abbrechen ohne Änderung schliesst sofort
  await panel.getByRole("button", { name: "Abbrechen" }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Bau-Modus: Abbrechen mit Änderungen fragt nach, Besucher sehen keinen Bau-Modus", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const seed = `abb${Date.now().toString(36).slice(-5)}`.padEnd(8, "0").slice(0, 8);
  await open(page, `h=3&o=2&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  const panel = page.getByRole("region", { name: "Bau-Modus" });
  await panel.getByRole("tab", { name: "Licht" }).click();
  await panel.getByRole("button", { name: "Laterne", exact: true }).click();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("1 / 120 eigene Elemente")).toBeVisible();
  await panel.getByRole("button", { name: "Abbrechen" }).click();
  await expect(panel.getByText("Änderungen verwerfen?")).toBeVisible();
  await panel.getByRole("button", { name: "Verwerfen" }).click();
  await expect(panel).toHaveCount(0);

  // Besucher: keine Bedienelemente des Besitzers
  await open(page, "h=3&o=2&seed=hubdome1");
  await expect(page.getByRole("button", { name: "Bauen" })).toHaveCount(0);
});

test("Bau-Modus v2: Haus frei verschieben, Quartier verschieben, zurück auf Automatik (Tastatur)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const seed = `frei${Date.now().toString(36).slice(-4)}`.padEnd(8, "0").slice(0, 8);
  await open(page, `h=6&o=3&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  const panel = page.getByRole("region", { name: "Bau-Modus" });
  const ansage = page.getByTestId("bau-ansage");

  // Haus wählen, Verschieben: Vorschau an der heutigen Lage passt, Pfeile prüfen live, Enter legt ab
  await panel.getByRole("combobox").selectOption({ label: "Haus 3" });
  await panel.getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(ansage).toHaveText(/Passt/);
  await page.keyboard.press("ArrowRight");
  await expect(ansage).toHaveText(/Passt|Hier nicht möglich: .+/);
  await page.keyboard.press("ArrowLeft");
  await expect(ansage).toHaveText(/Passt/);
  await page.keyboard.press("Enter");
  await expect(ansage).toHaveText(/Haus verschoben/);

  // Zurück auf Automatik (das Haus bleibt gewählt; rückgängig möglich)
  await panel.getByRole("button", { name: "Zurück auf Automatik" }).click();
  await expect(ansage).toHaveText(/wieder automatisch/);
  await page.keyboard.press("Control+z");
  await expect(ansage).toHaveText(/Rückgängig/);

  // Quartier als Ganzes: Griff, Esc bricht ab
  await panel.getByRole("button", { name: "Ganzes Quartier …" }).click();
  await panel.getByRole("button", { name: "Quartier verschieben" }).click();
  await expect(ansage).toHaveText(/Passt/);
  await page.keyboard.press("Escape");
  await expect(ansage).toHaveText(/bleibt, wo es ist/);
  await panel.getByRole("button", { name: "Quartier verschieben" }).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
  await expect(ansage).toHaveText(/Passt|Nur bis zur Grenze|Hier nicht möglich/);
  await page.keyboard.press("Escape");

  // Speichern: Server prüft dieselbe Welt (freie Lage hält nach dem Neuladen)
  await panel.getByRole("button", { name: "Speichern" }).click();
  await expect(panel).toHaveCount(0, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

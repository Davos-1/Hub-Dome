import { expect, test, type Page } from "@playwright/test";

// Bau-Modus als Plan (Phase 4h, Prototyp 12a) ohne Datenbank über /dev/dorf (Speichern landet im Speicher
// des Dev-Servers). Tastatur zuerst; mit der Maus über die Bildschirmlage aus `window.__hubDome.toScreen`.

const ready = { timeout: 120_000 };

async function open(page: Page, query: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/dev/dorf?${query}&bewegung=0`);
  await page.waitForFunction(() => window.__hubDome?.ready === true, undefined, ready);
}

/** Eigener Seed pro Lauf: der Speicher des Dev-Servers bleibt zwischen Läufen bestehen. */
const freshSeed = (p: string) =>
  `${p}${Date.now().toString(36).slice(-5)}`.padEnd(8, "0").slice(0, 8);

function ui(page: Page) {
  return {
    bar: page.getByRole("region", { name: "Bau-Modus" }),
    panel: page.getByRole("region", { name: "Bau-Einstellungen" }),
    tools: page.getByRole("toolbar", { name: "Werkzeuge" }),
    ansage: page.getByTestId("bau-ansage"),
  };
}

test("Bau-Modus: eigene Deko per Tastatur, rückgängig, Haus anpassen, speichern und neu laden", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const seed = freshSeed("bau");
  await open(page, `h=4&o=3&besitzer=1&seed=${seed}`);

  await page.getByRole("button", { name: "Bauen" }).click();
  const { bar, panel, tools, ansage } = ui(page);
  await expect(bar).toBeVisible();
  await expect(tools.getByRole("button", { name: "Wählen" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Deko: Katalog wählen, Vorschau an einer gültigen Stelle, Enter setzt
  await tools.getByRole("button", { name: "Deko" }).click();
  await expect(panel.getByText("Eigene Deko · 0 / 120")).toBeVisible();
  await panel.getByRole("button", { name: "Bank", exact: true }).click();
  await expect(ansage).toContainText("Enter");
  await page.keyboard.press("Enter");
  await expect(ansage).toHaveText(/Bank gesetzt/);
  await expect(panel.getByText("Eigene Deko · 1 / 120")).toBeVisible();
  await panel.getByRole("tab", { name: "Natur" }).click();
  await panel.getByRole("button", { name: "Busch", exact: true }).click();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("Eigene Deko · 2 / 120")).toBeVisible();

  // Rückgängig und Wiederholen (Tastatur und Knöpfe)
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await expect(panel.getByText("Eigene Deko · 1 / 120")).toBeVisible();
  await bar.getByRole("button", { name: "Wiederholen" }).click();
  await expect(panel.getByText("Eigene Deko · 2 / 120")).toBeVisible();

  // Haus anpassen ohne Maus: Haus aus der Liste wählen, Farbe und Anbau setzen
  await tools.getByRole("button", { name: "Wählen" }).click();
  await panel.getByLabel("Haus wählen").selectOption({ label: "Haus 3" });
  await panel.getByRole("button", { name: "Kalk" }).click();
  await panel.getByRole("button", { name: "Laube", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Laube", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Speichern: Leiste verschwindet; nach dem Neuladen ist alles noch da
  await bar.getByRole("button", { name: "Speichern" }).click();
  await expect(bar).toHaveCount(0, { timeout: 30_000 });
  await open(page, `h=4&o=3&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  await tools.getByRole("button", { name: "Deko" }).click();
  await expect(panel.getByText("Eigene Deko · 2 / 120")).toBeVisible();
  await tools.getByRole("button", { name: "Wählen" }).click();
  await panel.getByLabel("Haus wählen").selectOption({ label: "Haus 3" });
  await expect(panel.getByRole("button", { name: "Laube", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByRole("button", { name: /Kalk/ })).toHaveAttribute("aria-pressed", "true");

  // Esc von innen nach aussen: zuerst die Auswahl, dann bleibt der Bau-Modus offen
  await page.keyboard.press("Escape");
  await expect(panel.getByLabel("Haus wählen")).toHaveValue("");
  await expect(bar).toBeVisible();

  // Abbrechen ohne Änderung schliesst sofort
  await bar.getByRole("button", { name: "Abbrechen" }).click();
  await expect(bar).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Bau-Modus: Abbrechen mit Änderungen fragt nach, Besucher sehen keinen Bau-Modus", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const seed = freshSeed("abb");
  await open(page, `h=3&o=2&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  const { bar, panel, tools } = ui(page);
  await tools.getByRole("button", { name: "Deko" }).click();
  await panel.getByRole("tab", { name: "Licht" }).click();
  await panel.getByRole("button", { name: "Laterne", exact: true }).click();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("Eigene Deko · 1 / 120")).toBeVisible();
  await bar.getByRole("button", { name: "Abbrechen" }).click();
  await expect(bar.getByText("Änderungen verwerfen?")).toBeVisible();
  await bar.getByRole("button", { name: "Verwerfen" }).click();
  await expect(bar).toHaveCount(0);

  // Besucher: keine Bedienelemente des Besitzers
  await open(page, "h=3&o=2&seed=hubdome1");
  await expect(page.getByRole("button", { name: "Bauen" })).toHaveCount(0);
});

test("Bau-Modus v3: Wegform wählen, Radius, Ausgangslage, Haus und Quartier per Tastatur", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const seed = freshSeed("weg");
  await open(page, `h=8&o=3&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  const { bar, panel, ansage } = ui(page);

  // Quartier wählen: Wegform, Hinweis, Ausgangslage
  const quarter = panel.getByLabel("Quartier wählen");
  const first = await quarter.locator("option").nth(1).textContent();
  await quarter.selectOption({ label: first! });
  await expect(panel.getByRole("heading", { name: first! })).toBeVisible();
  const forms = panel.getByRole("radiogroup", { name: "Wegform" });
  await expect(forms.getByRole("radio", { name: "Gasse" })).toHaveAttribute("aria-checked", "true");
  await forms.getByRole("radio", { name: "Intelligent" }).click();
  await expect(ansage).toHaveText(/Intelligent .*(neu angeordnet|geht nicht)/, { timeout: 30_000 });
  if (/neu angeordnet/.test((await ansage.textContent()) ?? "")) {
    await expect(forms.getByRole("radio", { name: "Intelligent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await panel.getByRole("button", { name: "Kurve grösser" }).click();
    await expect(ansage).toHaveText(/Intelligent \((mittel|stark)\)|geht nicht/, {
      timeout: 30_000,
    });
  }
  await forms.getByRole("radio", { name: "Ring" }).click();
  await expect(ansage).toHaveText(/Ring \(Radius \d+ m\)/, { timeout: 30_000 });
  await panel.getByRole("button", { name: "Zurück auf Ausgangslage" }).click();
  await expect(ansage).toHaveText(/Ausgangslage/, { timeout: 30_000 });
  await expect(forms.getByRole("radio", { name: "Gasse" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Control+z");
  await expect(ansage).toHaveText("Rückgängig");

  // Haus per Tastatur verschieben: Vorschau passt, Pfeile prüfen live, Enter legt ab (oder setzt zurück)
  await panel.getByLabel("Haus wählen").selectOption({ label: "Haus 3" });
  await panel.getByRole("button", { name: "Verschieben (Tastatur)", exact: true }).click();
  await expect(ansage).toHaveText(/Passt/);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(ansage).toHaveText(/Abgelegt|Zurückgesetzt/);

  // Quartier per Tastatur: Esc bricht ab
  await panel.getByRole("button", { name: "Quartier verschieben (Tastatur)" }).click();
  await expect(ansage).toHaveText(/passt/i);
  await page.keyboard.press("Escape");
  await expect(ansage).toHaveText(/bleibt, wo es ist/);

  // Speichern: Server prüft dieselbe Welt
  await bar.getByRole("button", { name: "Speichern" }).click();
  await expect(bar).toHaveCount(0, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("Bau-Modus v3: Eckpunkt und Baum mit der Maus, nach dem Speichern noch da", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const seed = freshSeed("maus");
  await open(page, `h=10&o=2&besitzer=1&seed=${seed}&wege=intelligent`);
  await page.getByRole("button", { name: "Bauen" }).click();
  const { bar, panel, tools, ansage } = ui(page);
  const toScreen = (x: number, z: number) =>
    page.evaluate(([x, z]) => window.__hubDome!.toScreen!(x, z), [x, z] as const);
  type P = { x: number; z: number };

  // Weg: Eckpunkt auf einem längeren Stichweg setzen und seitlich ziehen
  await tools.getByRole("button", { name: "Weg" }).click();
  await page.waitForTimeout(500);
  const spur = await page.evaluate(() => {
    const w = window.__hubDomeDev!.world as { settlement: { spurs: Record<string, P[]> } };
    const pts = Object.values(w.settlement.spurs).find((p) => p.length > 10)!;
    const i = Math.floor(pts.length / 2);
    const m = pts[i];
    const a = pts[i - 1];
    const l = Math.hypot(m.x - a.x, m.z - a.z) || 1;
    return { m, n: { x: -(m.z - a.z) / l, z: (m.x - a.x) / l } };
  });
  let bent = false;
  for (const k of [1.5, -1.5]) {
    const [x0, y0] = await toScreen(spur.m.x, spur.m.z);
    const [x1, y1] = await toScreen(spur.m.x + spur.n.x * k, spur.m.z + spur.n.z * k);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 6 });
    await page.mouse.up();
    await expect(ansage).toHaveText(/Weg angepasst|Zurückgesetzt/, { timeout: 30_000 });
    if ((await ansage.textContent())?.includes("angepasst")) {
      bent = true;
      break;
    }
  }
  expect(bent).toBe(true);
  await expect(panel.getByText("1 Weg mit Eckpunkt")).toBeVisible();

  // Deko: einen Baum im Bild ein Stück verschieben (bei Konflikt zurückgesetzt, dann nächster Baum)
  await tools.getByRole("button", { name: "Deko" }).click();
  await page.waitForTimeout(500);
  const trees = await page.evaluate(() => {
    const w = window.__hubDomeDev!.world as {
      vegetation: { trees: { x: number; z: number; i?: number; kind: string }[] };
    };
    return w.vegetation.trees
      .filter((t) => {
        const [sx, sy] = window.__hubDome!.toScreen!(t.x, t.z);
        return sx > 150 && sx < 1100 && sy > 120 && sy < 780 && t.kind !== "obst";
      })
      .slice(0, 8);
  });
  let moved = false;
  for (const t of trees) {
    const [x0, y0] = await toScreen(t.x, t.z);
    const [x1, y1] = await toScreen(t.x + 0.8, t.z + 0.4);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 6 });
    await page.mouse.up();
    await expect(ansage).toHaveText(/Baum versetzt|Zurückgesetzt/, { timeout: 30_000 });
    if ((await ansage.textContent())?.includes("versetzt")) {
      moved = true;
      break;
    }
  }
  expect(moved).toBe(true);
  await expect(panel.getByText("1 Baum versetzt")).toBeVisible();

  // Speichern und neu laden (ohne `wege`: das Gespeicherte zählt)
  await bar.getByRole("button", { name: "Speichern" }).click();
  await expect(bar).toHaveCount(0, { timeout: 30_000 });
  await open(page, `h=10&o=2&besitzer=1&seed=${seed}`);
  await page.getByRole("button", { name: "Bauen" }).click();
  await tools.getByRole("button", { name: "Weg" }).click();
  await expect(panel.getByText("1 Weg mit Eckpunkt")).toBeVisible();
  await tools.getByRole("button", { name: "Deko" }).click();
  await expect(panel.getByText("1 Baum versetzt")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Bau-Modus auf Welt-Version 2: Wegformen erst nach dem Aktualisieren", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "h=4&o=2&besitzer=1&seed=hubdome1&v=2");
  await page.getByRole("button", { name: "Bauen" }).click();
  const { panel, tools } = ui(page);
  const quarter = panel.getByLabel("Quartier wählen");
  await quarter.selectOption({ index: 1 });
  await expect(panel.getByText(/Wegformen gibt es ab Welt-Version 3/)).toBeVisible();
  await tools.getByRole("button", { name: "Weg" }).click();
  await expect(panel.getByText(/Wege von Hand gibt es ab Welt-Version 3/)).toBeVisible();
});

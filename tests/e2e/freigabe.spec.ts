import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Freundschaften: A legt Haus und Objekte an, B fragt an, A nimmt an, B besucht das Dorf,
// private Objekte bleiben unsichtbar, A beendet die Freundschaft. Alles über Tafeln, Reise-Karte und Suche der 3D-Welt.

let a: E2EUser;
let b: E2EUser;
test.beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("a"), createTestUser("b")]);
});
test.afterAll(async () => {
  await Promise.all([deleteTestUser(a.id), deleteTestUser(b.id)]);
});

/** Welt eines Dorfs laden; sobald die Szene steht, ist die Oberfläche bedienbar. */
async function visit(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
}

/** Reise-Karte (Vollbild) über die Leiste unten öffnen. */
async function openTravel(page: Page) {
  await page.getByRole("button", { name: /^Reise und Freunde/ }).click();
  const travel = page.getByRole("dialog", { name: "Reise", exact: true });
  await expect(travel).toBeVisible();
  return travel;
}

/** Befehlspalette (Strg+K): Begriff eingeben, die Treffer zurückgeben. */
async function openSearch(page: Page, text: string) {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Suchen" });
  await palette.getByRole("combobox").fill(text);
  return palette;
}

test("Freunde anfragen, annehmen, Dorf besuchen und Freundschaft beenden", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await loginAs(ctxA, a);
  await loginAs(ctxB, b);
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  pa.on("dialog", (d) => d.accept());
  pb.on("dialog", (d) => d.accept());

  // A: Themenhaus anlegen (Tafel «Haus anlegen»; im leeren Dorf steht der Knopf im Hinweis und in der Leiste)
  await visit(pa, `/dorf/${a.username}`);
  await pa.getByRole("button", { name: "Haus anlegen" }).first().click();
  const houseTafel = pa.getByRole("dialog", { name: "Haus anlegen", exact: true });
  await expect(houseTafel).toBeVisible();
  await houseTafel.getByRole("button", { name: "Eigenes Thema" }).click();
  await houseTafel.getByLabel("Titel").fill("Python");
  await houseTafel.getByRole("button", { name: "Haus anlegen" }).click();
  await expect(pa.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });

  // A: ein geteiltes und ein privates Objekt (Liste › «+» am Haus › Tafel mit drei Schritten)
  await pa.keyboard.press("l");
  const list = pa.getByRole("complementary", { name: "Alle Objekte" });
  async function addArtifact(title: string, url: string, visibility: "shared" | "private") {
    await list
      .getByRole("button", { name: "Objekt in Python hinzufügen" })
      .click({ timeout: 30_000 });
    const tafel = pa.getByRole("dialog", { name: "Neues Objekt" });
    await expect(tafel).toBeVisible();
    await tafel.getByRole("textbox", { name: /^Link/ }).fill(url);
    await tafel.getByLabel("Titel").fill(title);
    await tafel.getByRole("button", { name: "Weiter" }).click(); // 2 Einordnen
    await tafel.getByRole("button", { name: "Weiter" }).click(); // 3 Freigabe
    await tafel
      .getByRole("radio", { name: visibility === "shared" ? /^Freunde/ : /^Nur ich/ })
      .click();
    await tafel.getByRole("button", { name: "Ans Haus hängen" }).click();
    // Danach zeigt die Tafel das neue Objekt
    await expect(pa.getByRole("dialog", { name: title, exact: true })).toBeVisible({
      timeout: 30_000,
    });
  }
  await addArtifact("Geteilter Rechner", "https://claude.ai/public/artifacts/e2e-shared", "shared");
  await addArtifact("Geheime Notiz", "https://claude.ai/public/artifacts/e2e-private", "private");

  // B: ohne Freundschaft kein Zugriff (das Dorf gibt es für B nicht)
  await pb.goto(`/dorf/${a.username}`);
  await expect(pb.getByText("This page could not be found.")).toBeVisible({ timeout: 30_000 });

  // B: Freundschaftsanfrage an A (aus der eigenen Welt, Reise-Karte)
  await visit(pb, `/dorf/${b.username}`);
  const travelB = await openTravel(pb);
  await travelB.getByPlaceholder("@benutzername").fill(`@${a.username}`);
  await travelB.getByRole("button", { name: "Senden", exact: true }).click();
  await expect(travelB.getByText("Anfrage gesendet.")).toBeVisible({ timeout: 90_000 });
  await expect(travelB.getByText("wartet auf Antwort")).toBeVisible({ timeout: 20_000 });

  // A: sieht die Anfrage (Zähler am Reise-Knopf in der Leiste) und nimmt an; B erscheint als Insel
  await visit(pa, `/dorf/${a.username}`);
  await expect(pa.getByRole("button", { name: "Reise und Freunde (1 neu)" })).toBeVisible({
    timeout: 30_000,
  });
  const travelA = await openTravel(pa);
  await expect(travelA.getByText(/Anfragen an dich · 1/)).toBeVisible({ timeout: 30_000 });
  await travelA.getByRole("button", { name: "Annehmen" }).click();
  await expect(travelA.getByRole("button", { name: new RegExp(`Dorf von ${b.name}`) })).toBeVisible(
    { timeout: 30_000 },
  );
  await expect(travelA.getByText("Keine offenen Anfragen.")).toBeVisible();

  // B: besucht das Dorf von A über die Reise-Karte, mit Besuchsband und ohne Bearbeiten-Knöpfe
  await pb.goto("/doerfer");
  await expect(pb.locator("canvas")).toBeVisible({ timeout: 60_000 });
  const travel = pb.getByRole("dialog", { name: "Reise", exact: true });
  await travel
    .getByRole("button", { name: new RegExp(`Dorf von ${a.name}`) })
    .click({ timeout: 30_000 });
  await travel.getByRole("button", { name: "Hinreisen" }).click();
  await expect(pb).toHaveURL(new RegExp(`/dorf/${a.username}$`), { timeout: 30_000 });
  const band = pb.getByRole("status").filter({ hasText: "Zurück in mein Dorf" });
  await expect(band.getByText("nur ansehen")).toBeVisible({ timeout: 30_000 });
  await expect(band.getByText("Du besuchst")).toBeVisible();
  await expect(pb.getByRole("button", { name: "Haus anlegen" })).toHaveCount(0);
  await expect(pb.getByRole("button", { name: "Bauen" })).toHaveCount(0);

  // B: sieht das geteilte, aber nicht das private Objekt
  const hit = await openSearch(pb, "Geteilter Rechner");
  await expect(hit.getByRole("option")).toHaveCount(1);
  await hit.getByRole("option").first().click();
  const detail = pb.getByRole("dialog", { name: "Geteilter Rechner", exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("link", { name: "Öffnen" })).toBeVisible();
  await expect(
    detail.getByRole("button", { name: /^(Bearbeiten|Eigene Version|Löschen)$/ }),
  ).toHaveCount(0);
  // Am Haus gibt es für Besucher nur «Öffnen» und «Liste»
  const tiles = pb.getByRole("toolbar", { name: "Aktionen für Python" });
  await expect(tiles.getByRole("button", { name: "Öffnen" })).toBeVisible({ timeout: 30_000 });
  await expect(tiles.getByRole("button", { name: "Liste" })).toBeVisible();
  await expect(tiles.getByRole("button", { name: "Objekt", exact: true })).toHaveCount(0);
  await expect(tiles.getByRole("button", { name: "Bearbeiten" })).toHaveCount(0);
  await expect((await openSearch(pb, "Geheime Notiz")).getByText("Nichts gefunden")).toBeVisible();
  await pb.keyboard.press("Escape");

  // A: beendet die Freundschaft (Reise-Karte › Insel von B › «Freund entfernen»)
  await visit(pa, `/dorf/${a.username}`);
  const travelA2 = await openTravel(pa);
  await travelA2.getByRole("button", { name: new RegExp(`Dorf von ${b.name}`) }).click();
  await travelA2.getByRole("button", { name: "Freund entfernen" }).click();
  await expect(travelA2.getByText(/Noch keine Freunde/)).toBeVisible({ timeout: 30_000 });

  // B: sieht das Dorf nicht mehr
  await pb.goto(`/dorf/${a.username}`);
  await expect(pb.getByText("This page could not be found.")).toBeVisible({ timeout: 30_000 });
  await pb.goto("/doerfer");
  const travelB2 = pb.getByRole("dialog", { name: "Reise", exact: true });
  await expect(travelB2.getByRole("button", { name: /^Dein Dorf / })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    travelB2.getByRole("button", { name: new RegExp(`Dorf von ${a.name}`) }),
  ).toHaveCount(0);
});

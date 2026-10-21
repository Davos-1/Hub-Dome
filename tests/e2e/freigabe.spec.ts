import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Phase 3: A legt Dorf an, lädt B ein, B sieht A's Artifacts (ausser private),
// A entzieht den Zugriff, B sieht nichts mehr.

let a: E2EUser;
let b: E2EUser;

test.beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("a"), createTestUser("b")]);
});

test.afterAll(async () => {
  await Promise.all([deleteTestUser(a.id), deleteTestUser(b.id)]);
});

test("Dorf teilen, ansehen und Zugriff entziehen", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await loginAs(ctxA, a);
  await loginAs(ctxB, b);
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  pa.on("dialog", (d) => d.accept());

  // A: Themenhaus anlegen
  await pa.goto(`/dorf/${a.username}/liste`);
  await pa.getByLabel("Themenhaus").check();
  await pa.locator("#title").fill("Python");
  await pa.getByRole("button", { name: "Haus anlegen" }).click();
  const house = pa.getByRole("region", { name: "Python", exact: true });
  await expect(house).toBeVisible();

  // A: ein geteiltes und ein privates Artifact
  async function addArtifact(title: string, url: string, visibility: "shared" | "private") {
    const add = house.locator("details").filter({ hasText: "Objekt hinzufügen" }).first();
    // Das Formular bleibt nach dem Speichern offen: nur öffnen, wenn geschlossen.
    if (!(await add.evaluate((d) => (d as HTMLDetailsElement).open))) {
      await add.locator("summary").click();
    }
    await add.getByLabel("Link", { exact: true }).fill(url);
    await add.getByLabel("Titel").fill(title);
    await add.getByLabel("Sichtbarkeit").selectOption(visibility);
    await add.getByRole("button", { name: "Objekt speichern" }).click();
    await expect(house.getByRole("link", { name: title })).toBeVisible();
  }
  await addArtifact("Geteilter Rechner", "https://claude.ai/public/artifacts/e2e-shared", "shared");
  await addArtifact("Geheime Notiz", "https://claude.ai/public/artifacts/e2e-private", "private");

  // A: fremde Links werden abgelehnt (Browser-Validierung umgehen → Server prüft)
  // (abgedeckt durch Unit- und RLS-Tests)

  // A: Einladungslink erstellen
  await pa.goto("/einstellungen");
  await pa.getByRole("button", { name: "Einladungslink erstellen" }).click();
  const inviteUrl = await pa.getByLabel("Link", { exact: true }).inputValue();
  expect(inviteUrl).toContain("/einladung/");

  // B: ohne Freigabe nichts sichtbar
  await pb.goto(`/dorf/${a.username}/liste`);
  await expect(pb.getByText("Geteilter Rechner")).toHaveCount(0);

  // B: Einladung annehmen
  await pb.goto(new URL(inviteUrl).pathname);
  await pb.getByRole("button", { name: "Einladung annehmen" }).click();
  await expect(pb).toHaveURL(new RegExp(`/dorf/${a.username}$`));
  await pb.goto(`/dorf/${a.username}/liste`);
  await expect(pb.getByRole("link", { name: "Geteilter Rechner" })).toBeVisible();
  await expect(pb.getByText("Geheime Notiz")).toHaveCount(0);
  await expect(pb.getByRole("button", { name: "Objekt speichern" })).toHaveCount(0);

  // B: Dorf in «Meine Dörfer»
  await pb.goto("/doerfer");
  await expect(pb.getByRole("link", { name: /Dorf von Tester A/ })).toBeVisible();

  // A: Zugriff entziehen
  await pa.goto("/einstellungen");
  await pa.getByRole("button", { name: "Zugriff entziehen" }).click();
  await expect(pa.getByText("Noch niemand.")).toBeVisible();

  // B: sieht nichts mehr
  await pb.goto(`/dorf/${a.username}/liste`);
  await expect(pb.getByText("Geteilter Rechner")).toHaveCount(0);
  await pb.goto("/doerfer");
  await expect(pb.getByRole("link", { name: /Dorf von Tester A/ })).toHaveCount(0);
});

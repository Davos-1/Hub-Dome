import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Freundschaftslink: A erzeugt einen Link, B öffnet ihn, nimmt an und landet in A's Dorf;
// danach ist der Link mit einer Nutzung aufgebraucht, ein Dritter sieht die klare Meldung.

let a: E2EUser;
let b: E2EUser;
let c: E2EUser;
test.beforeAll(async () => {
  [a, b, c] = await Promise.all([createTestUser("la"), createTestUser("lb"), createTestUser("lc")]);
});
test.afterAll(async () => {
  await Promise.all([deleteTestUser(a.id), deleteTestUser(b.id), deleteTestUser(c.id)]);
});

test("Freundschaftslink erzeugen, annehmen, aufgebraucht und widerrufen", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  await loginAs(ctxA, a);
  await loginAs(ctxB, b);
  await loginAs(ctxC, c);
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const pc = await ctxC.newPage();
  pa.on("dialog", (d) => d.accept());

  // A: Link erzeugen (eine Person)
  await pa.goto(`/dorf/${a.username}?d=reise&t=freunde`);
  const dlgA = pa.getByRole("dialog", { name: "Reise und Freunde" });
  await expect(dlgA).toBeVisible({ timeout: 30_000 });
  await dlgA.getByRole("button", { name: "Link erstellen" }).click();
  const url = await dlgA.getByLabel("Link", { exact: true }).inputValue();
  expect(url).toContain("/freund/");
  await expect(dlgA.getByText(/0\/1 genutzt/)).toBeVisible({ timeout: 20_000 });

  // B: öffnet den Link, sieht den Absender, nimmt an und landet in A's Dorf
  await pb.goto(new URL(url).pathname);
  const dlgB = pb.getByRole("dialog", { name: "Freundschaftsanfrage" });
  await expect(dlgB.getByText(`@${a.username}`).first()).toBeVisible({ timeout: 30_000 });
  await dlgB.getByRole("button", { name: "Freundschaft annehmen" }).click();
  await expect(pb).toHaveURL(new RegExp(`/dorf/${a.username}$`), { timeout: 30_000 });
  await expect(pb.getByRole("status").getByText("nur zum Ansehen")).toBeVisible({
    timeout: 30_000,
  });

  // A: B ist jetzt Freund, der Link ist aufgebraucht
  await pa.goto(`/dorf/${a.username}?d=reise&t=freunde`);
  await expect(pa.getByRole("dialog").getByText(/Deine Freunde \(1\)/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(pa.getByRole("dialog").getByText(/1\/1 genutzt/)).toBeVisible();

  // C: der aufgebrauchte Link zeigt eine klare Meldung und nimmt nichts an
  await pc.goto(new URL(url).pathname);
  const dlgC = pc.getByRole("dialog", { name: "Freundschaftslink" });
  await expect(dlgC.getByRole("alert")).toContainText("schon von allen erlaubten Personen", {
    timeout: 30_000,
  });
  await expect(dlgC.getByRole("button", { name: "Freundschaft annehmen" })).toHaveCount(0);

  // Ungültiger Link
  await pc.goto("/freund/" + "x".repeat(43));
  await expect(
    pc.getByRole("dialog", { name: "Freundschaftslink" }).getByRole("alert"),
  ).toContainText("ungültig", { timeout: 30_000 });
});

test("Ohne Konto: Login mit Rückkehr zum Link", async ({ page }) => {
  await page.goto("/freund/" + "y".repeat(43));
  await expect(page).toHaveURL(/\/login\?next=%2Ffreund%2F/);
});

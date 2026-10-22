import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Freundschaften: A legt Haus und Objekte an, B fragt an, A nimmt an, B besucht das Dorf,
// private Objekte bleiben unsichtbar, A beendet die Freundschaft. Alles über Dialoge der 3D-Welt.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let a: E2EUser;
let b: E2EUser;
test.beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("a"), createTestUser("b")]);
});
test.afterAll(async () => {
  await Promise.all([deleteTestUser(a.id), deleteTestUser(b.id)]);
});

const search = (page: Page) => page.getByRole("searchbox", { name: "Haus oder Objekt suchen" });

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

  // A: Themenhaus anlegen
  await pa.goto(`/dorf/${a.username}?d=haus`);
  const houseDialog = pa.getByRole("dialog", { name: "Haus anlegen" });
  await expect(houseDialog).toBeVisible({ timeout: 30_000 });
  await houseDialog.getByLabel("Themenhaus").check();
  await houseDialog.getByLabel("Titel").fill("Python");
  await houseDialog.getByRole("button", { name: "Haus anlegen" }).click();
  await expect(pa.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  const { data: house } = await admin
    .from("houses")
    .select("id")
    .eq("title", "Python")
    .eq("kind", "thema")
    .single();

  // A: ein geteiltes und ein privates Objekt
  async function addArtifact(title: string, url: string, visibility: "shared" | "private") {
    await pa.goto(`/dorf/${a.username}?d=objekt&h=${house!.id}`);
    const d = pa.getByRole("dialog", { name: "Objekt hinzufügen" });
    await expect(d).toBeVisible({ timeout: 30_000 });
    await d.getByLabel("Link", { exact: true }).fill(url);
    await d.getByLabel("Titel").fill(title);
    await d.getByLabel("Sichtbarkeit").selectOption(visibility);
    await d.getByRole("button", { name: "Objekt speichern" }).click();
    await expect(pa.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  }
  await addArtifact("Geteilter Rechner", "https://claude.ai/public/artifacts/e2e-shared", "shared");
  await addArtifact("Geheime Notiz", "https://claude.ai/public/artifacts/e2e-private", "private");

  // B: ohne Freundschaft kein Zugriff (das Dorf gibt es für B nicht)
  const denied = await pb.goto(`/dorf/${a.username}`);
  expect(denied?.status()).toBe(404);

  // B: Freundschaftsanfrage an A (aus der eigenen Welt)
  await pb.goto(`/dorf/${b.username}?d=reise&t=freunde`);
  const travelB = pb.getByRole("dialog", { name: "Reise und Freunde" });
  await expect(travelB).toBeVisible({ timeout: 30_000 });
  await travelB.getByPlaceholder("@benutzername").fill(`@${a.username}`);
  await travelB.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(travelB.getByText("Anfrage gesendet.")).toBeVisible({ timeout: 20_000 });
  await expect(travelB.getByText("wartet auf Antwort")).toBeVisible({ timeout: 20_000 });

  // A: sieht die Anfrage (Hinweis in der Leiste) und nimmt an
  await pa.goto(`/dorf/${a.username}?d=reise&t=freunde`);
  const travelA = pa.getByRole("dialog", { name: "Reise und Freunde" });
  await expect(travelA.getByText(/Anfragen an dich \(1\)/)).toBeVisible({ timeout: 30_000 });
  await travelA.getByRole("button", { name: "Annehmen" }).click();
  await expect(travelA.getByText(/Deine Freunde \(1\)/)).toBeVisible({ timeout: 30_000 });

  // B: besucht das Dorf von A über den Dialog, mit Willkommens-Banner und ohne Bearbeiten-Knöpfe
  await pb.goto("/doerfer");
  const travel = pb.getByRole("dialog", { name: "Reise und Freunde" });
  await expect(travel.getByText("Dorf von Tester A")).toBeVisible({ timeout: 30_000 });
  await travel.getByRole("button", { name: "Besuchen" }).click();
  await expect(pb).toHaveURL(new RegExp(`/dorf/${a.username}$`), { timeout: 30_000 });
  await expect(pb.getByRole("status").getByText("nur zum Ansehen")).toBeVisible({
    timeout: 30_000,
  });
  await expect(pb.getByRole("button", { name: "+ Haus" })).toHaveCount(0);

  // B: sieht das geteilte, aber nicht das private Objekt
  await search(pb).fill("Geteilter Rechner");
  await expect(pb.getByRole("option")).toHaveCount(1);
  await pb.getByRole("option").first().click();
  const side = pb.getByRole("complementary", { name: "Python" });
  await expect(side).toBeVisible();
  await expect(side.getByRole("button", { name: "Objekt hinzufügen" })).toHaveCount(0);
  await expect(side.getByRole("button", { name: "Haus bearbeiten" })).toHaveCount(0);
  await search(pb).fill("Geheime Notiz");
  await expect(pb.getByText("Keine Treffer")).toBeVisible();

  // A: beendet die Freundschaft
  await pa.goto(`/dorf/${a.username}?d=reise&t=freunde`);
  await pa.getByRole("dialog").getByRole("button", { name: "Entfernen" }).click();
  await expect(pa.getByText("Noch keine Freunde.")).toBeVisible({ timeout: 30_000 });

  // B: sieht das Dorf nicht mehr
  const gone = await pb.goto(`/dorf/${a.username}`);
  expect(gone?.status()).toBe(404);
  await pb.goto("/doerfer");
  await expect(pb.getByRole("dialog", { name: "Reise und Freunde" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(pb.getByRole("dialog").getByText("Dorf von Tester A")).toHaveCount(0);
});

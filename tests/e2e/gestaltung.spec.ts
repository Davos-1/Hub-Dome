import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, type E2EUser } from "./helpers";

// Abnahme Phase 4b: Stile wählen und speichern, eigenes Modell (GLB) hochladen, anzeigen, löschen.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** Ein gültiges, winziges GLB mit einem Dreieck (Positionen + Indizes im Binärchunk). */
function triangleGlb(): Buffer {
  const positions = Buffer.alloc(36);
  [0, 0, 0, 4, 0, 0, 0, 5, 0].forEach((v, i) => positions.writeFloatLE(v, i * 4));
  const indices = Buffer.alloc(8);
  [0, 1, 2].forEach((v, i) => indices.writeUInt16LE(v, i * 2));
  const bin = Buffer.concat([positions, indices]);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 1 }, indices: 0 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5123, count: 3, type: "SCALAR" },
      {
        bufferView: 1,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [4, 5, 0],
      },
    ],
  };
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonPadded = Buffer.concat([
    jsonBytes,
    Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20),
  ]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + bin.length, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonPadded.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHead, jsonPadded, binHead, bin]);
}

let user: E2EUser;
test.beforeAll(async () => {
  user = await createTestUser("gest");
});
test.afterAll(async () => {
  const { data: v } = await admin.from("villages").select("id").eq("owner_id", user.id).single();
  if (v) await admin.storage.from("village-models").remove([`${v.id}/zentrale.glb`]);
  await deleteTestUser(user.id);
});

test("Stile speichern, eigenes Modell hochladen, anzeigen und löschen", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  await loginAs(ctx, user);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());

  // Stile wählen und speichern
  await page.goto("/einstellungen");
  await page.getByRole("radio", { name: /Marskuppel Kuppelstation/ }).check();
  await page.getByRole("radio", { name: /Leuchtturm/ }).check();
  await page.getByRole("button", { name: "Stile speichern" }).click();
  await expect(page.getByText("Gespeichert. Dein Dorf sieht jetzt anders aus.")).toBeVisible();
  const { data: saved } = await admin
    .from("villages")
    .select("house_style, zentrale_style")
    .eq("owner_id", user.id)
    .single();
  expect(saved).toEqual({ house_style: "marskuppel", zentrale_style: "leuchtturm" });

  // «Eigenes Modell» ist ohne Upload gesperrt
  await expect(page.getByRole("radio", { name: /Eigenes Modell/ })).toBeDisabled();

  // Ungültige Datei wird abgelehnt
  await page.getByLabel("GLB-Datei auswählen").setInputFiles({
    name: "kaputt.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from("das ist keine glb-datei, nur Text in ausreichender Länge"),
  });
  await expect(page.getByRole("alert")).toContainText("keine GLB-Datei");

  // Gültige Datei hochladen
  await page.getByLabel("GLB-Datei auswählen").setInputFiles({
    name: "zentrale.glb",
    mimeType: "model/gltf-binary",
    buffer: triangleGlb(),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Modell hochgeladen und geprüft" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Aktuelles Modell:/)).toContainText("1 Dreiecke");

  // «Eigenes Modell» wählen, speichern, im Dorf sehen
  await page.reload();
  await page.getByRole("radio", { name: /Eigenes Modell/ }).check();
  await page.getByRole("button", { name: "Stile speichern" }).click();
  await expect(page.getByText("Gespeichert. Dein Dorf sieht jetzt anders aus.")).toBeVisible();

  await page.goto(`/dorf/${user.username}`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__hubDome !== undefined, undefined, { timeout: 30_000 });
  await page.waitForTimeout(2500); // Modell wird im Hintergrund geladen

  // Modell löschen: Zentrale fällt auf das Rathaus zurück
  await page.goto("/einstellungen");
  await page.getByRole("button", { name: "Modell löschen" }).click();
  await expect(page.getByText("Modell gelöscht.")).toBeVisible();
  const { data: after } = await admin
    .from("villages")
    .select("zentrale_style, zentrale_model_meta")
    .eq("owner_id", user.id)
    .single();
  expect(after).toEqual({ zentrale_style: "rathaus", zentrale_model_meta: null });
  expect(errors).toEqual([]);
});

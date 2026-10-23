import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { z } from "zod";

// Visuelle Testmatrix: rendert /dev/dorf (Seed × Datenmenge × Tageszeit × Kamera) und speichert Screenshots nach
// test-results/visual/<etappe>/<projekt>/<seed>-<daten>-<zeit>-<kamera>.png plus stats.json je Projekt.
// Läuft nur auf Abruf (playwright.visual.config.ts). Auswahl und Ausgabe: tests/visual/README.md.

const STANDARD_SEEDS = [
  "hubdome1",
  "b7k2m9qx",
  "q0q0q0q0",
  "m3n4b5v6",
  "flussb01",
  "kx81bb20",
  "p9p9p9p9",
  "lmnopqrs",
];
/** Datenmengen: h = Häuser (ohne Zentrale), o = Objekte pro Haus, deko = Beispiel-Deko (`deko=1`). */
const DATEN: Record<string, { h: number; o: number; deko?: boolean }> = {
  leer: { h: 0, o: 0 },
  "3h": { h: 3, o: 4 },
  "10h": { h: 10, o: 6 },
  "20h": { h: 20, o: 12 },
  deko: { h: 10, o: 6, deko: true },
};
type DatenName = "leer" | "3h" | "10h" | "20h" | "deko";
const DATEN_NAMEN: DatenName[] = ["leer", "3h", "10h", "20h", "deko"];
/** Volle Kombination nur über diese Datenmengen (deko hat eigene Bilder, s. unten). */
const VOLL_DATEN: DatenName[] = ["leer", "3h", "10h", "20h"];
const ZEITEN = ["mittag", "abend", "nacht"] as const;
type Zeit = (typeof ZEITEN)[number];
const UEBERSICHTEN = ["uebersicht", "vogel", "strasse"] as const;
/** Ufer: Brücke, See oder Teich aus der Nähe (Übergänge Land/Wasser). */
const UFER = "ufer";
const HAUSTYPEN = [
  "werkstatt",
  "block",
  "solar",
  "atelier",
  "stadt",
  "haus",
  "turm",
  "digital",
  "baustelle",
] as const;
const NAHAUFNAHMEN = HAUSTYPEN.map((typ) => `haus-${typ}`);

/** Tokens für VISUAL_ONLY, nach Gruppe (Kamera, Zeit, Daten). Innerhalb einer Gruppe ODER, zwischen Gruppen UND. */
const KAMERA_TOKENS = new Set<string>([...UEBERSICHTEN, UFER, "haus", ...NAHAUFNAHMEN]);
const ZEIT_TOKENS = new Set<string>(ZEITEN);
const DATEN_TOKENS = new Set<string>(DATEN_NAMEN);

const BEREIT_TIMEOUT = 90_000;
const AUSGABE = path.resolve(__dirname, "../../test-results/visual");

const liste = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const Umgebung = z.object({
  stage: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "nur Buchstaben, Ziffern, . _ -"),
  full: z.boolean(),
  seeds: z.array(z.string().regex(/^[a-z0-9]{8}$/, "8 Zeichen a-z0-9")),
  only: z.array(
    z
      .string()
      .refine(
        (t) => KAMERA_TOKENS.has(t) || ZEIT_TOKENS.has(t) || DATEN_TOKENS.has(t),
        "unbekannt (erlaubt: Kamera, haus, haus-<typ>, Tageszeit, Datenmenge)",
      ),
  ),
});

const parsed = Umgebung.safeParse({
  stage: process.env.VISUAL_STAGE || "aktuell",
  full: process.env.VISUAL_FULL === "1",
  seeds: liste(process.env.VISUAL_SEEDS),
  only: liste(process.env.VISUAL_ONLY),
});
if (!parsed.success) {
  throw new Error(`Ungültige VISUAL_*-Umgebungsvariablen:\n${z.prettifyError(parsed.error)}`);
}
const env = parsed.data;

type Eintrag = { seed: string; daten: DatenName; zeit: Zeit; kamera: string };

/**
 * Die ersten zwei Seeds bekommen die volle Kamera-/Zeit-/Daten-Kombination, die übrigen nur Übersicht und Vogel
 * (Mittag, 10h). Nahaufnahmen je Haustyp nur mit 20h (nur dort kommen alle Typen vor): Seed 1 bei Mittag,
 * mit VISUAL_FULL=1 alle Seeds und alle Tageszeiten.
 */
function baueMatrix(seeds: readonly string[], voll: boolean): Eintrag[] {
  const matrix: Eintrag[] = [];
  seeds.forEach((seed, i) => {
    if (voll || i < 2) {
      for (const daten of VOLL_DATEN)
        for (const zeit of ZEITEN)
          for (const kamera of UEBERSICHTEN) matrix.push({ seed, daten, zeit, kamera });
      for (const zeit of ZEITEN) matrix.push({ seed, daten: "deko", zeit, kamera: "strasse" });
    } else {
      for (const kamera of ["uebersicht", "vogel"])
        matrix.push({ seed, daten: "10h", zeit: "mittag", kamera });
    }
    // Jeder Seed: Beispiel-Deko in der Übersicht und das Ufer aus der Nähe
    matrix.push({ seed, daten: "deko", zeit: "mittag", kamera: "uebersicht" });
    matrix.push({ seed, daten: "deko", zeit: "mittag", kamera: UFER });
    if (voll || i === 0) {
      const zeiten: readonly Zeit[] = voll ? ZEITEN : ["mittag"];
      for (const zeit of zeiten)
        for (const kamera of NAHAUFNAHMEN) matrix.push({ seed, daten: "20h", zeit, kamera });
    }
  });
  return matrix;
}

function passtZuOnly(e: Eintrag, only: readonly string[]): boolean {
  const kameras = only.filter((t) => KAMERA_TOKENS.has(t));
  const zeiten = only.filter((t) => ZEIT_TOKENS.has(t));
  const daten = only.filter((t) => DATEN_TOKENS.has(t));
  if (
    kameras.length > 0 &&
    !kameras.some((t) => t === e.kamera || (t === "haus" && e.kamera.startsWith("haus-")))
  )
    return false;
  if (zeiten.length > 0 && !zeiten.includes(e.zeit)) return false;
  if (daten.length > 0 && !daten.includes(e.daten)) return false;
  return true;
}

const seeds = env.seeds.length > 0 ? env.seeds : STANDARD_SEEDS;
const MATRIX = baueMatrix(seeds, env.full).filter((e) => passtZuOnly(e, env.only));
if (MATRIX.length === 0) {
  throw new Error(
    "Die gewählte Auswahl (VISUAL_FULL/SEEDS/ONLY) ergibt keine Bilder. Nahaufnahmen gibt es nur mit 20h " +
      "(Standard: Seed 1, Mittag), volle Tageszeiten nur für die ersten zwei Seeds; sonst VISUAL_FULL=1.",
  );
}

const dateiname = (e: Eintrag) => `${e.seed}-${e.daten}-${e.zeit}-${e.kamera}.png`;
const urlVon = (e: Eintrag) => {
  const { h, o, deko } = DATEN[e.daten];
  return `/dev/dorf?seed=${e.seed}&h=${h}&o=${o}&zeit=${e.zeit}&kamera=${e.kamera}&bewegung=0${deko ? "&deko=1" : ""}`;
};

// Szenen-Statistik der Seite (siehe window.__hubDome in village-scene.tsx); hier lokal typisiert
type Szene = { ready?: boolean; calls?: number; triangles?: number; frameMs?: number };
const Eintragsform = z.object({
  datei: z.string(),
  calls: z.number().nullable(),
  triangles: z.number().nullable(),
  frameMs: z.number().nullable(),
});
type Statistik = z.infer<typeof Eintragsform>;

/** Je Ausgabeordner (Etappe/Projekt) die in diesem Lauf gesammelten Werte; Ausgabe in afterAll. */
const gesammelt = new Map<string, Map<string, Statistik>>();

/** Schreibt stats.json und führt sie mit einer vorhandenen zusammen (Teil-Läufe, Neustart des Workers). */
async function schreibeStatistik(ordner: string, neu: Map<string, Statistik>) {
  const pfad = path.join(ordner, "stats.json");
  const alle = new Map<string, Statistik>();
  try {
    const alt = z.array(Eintragsform).safeParse(JSON.parse(await readFile(pfad, "utf8")));
    if (alt.success)
      for (const s of alt.data) if (existsSync(path.join(ordner, s.datei))) alle.set(s.datei, s);
  } catch {
    // keine oder unlesbare stats.json: neu beginnen
  }
  for (const [datei, s] of neu) alle.set(datei, s);
  const sortiert = [...alle.values()].sort((a, b) => a.datei.localeCompare(b.datei));
  await writeFile(pfad, `${JSON.stringify(sortiert, null, 2)}\n`);
}

test.afterAll(async () => {
  for (const [ordner, neu] of gesammelt) await schreibeStatistik(ordner, neu);
});

// Ein Browser-Kontext (und eine Seite) pro Projekt und Tageszeit: spart Start- und Ladezeit
for (const zeit of ZEITEN) {
  const eintraege = MATRIX.filter((e) => e.zeit === zeit);
  if (eintraege.length === 0) continue;

  test.describe(`Tageszeit ${zeit}`, () => {
    let context: BrowserContext;
    let page: Page;
    let defekt = false;
    const errors: string[] = [];

    async function neueSeite(): Promise<Page> {
      const p = await context.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("crash", () => {
        defekt = true;
        errors.push("Seite abgestürzt (Renderer-Crash)");
      });
      return p;
    }

    test.beforeAll(async ({ browser }, testInfo) => {
      const { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor } = testInfo.project.use;
      context = await browser.newContext({
        baseURL,
        viewport,
        isMobile,
        hasTouch,
        deviceScaleFactor,
      });
      page = await neueSeite();
      // Früh und klar scheitern, statt für jedes Bild 90 s auf eine leere Canvas zu warten
      await page.goto("about:blank");
      const webgl = await page.evaluate(
        () => document.createElement("canvas").getContext("webgl2") !== null,
      );
      if (!webgl) {
        throw new Error(
          "WebGL nicht verfügbar. Chromium-Flags prüfen (playwright.visual.config.ts) und in Cloud-Umgebungen " +
            "PW_CHROMIUM_PATH=/opt/pw-browsers/chromium setzen.",
        );
      }
    });

    test.afterAll(async () => {
      await context?.close();
    });

    for (const e of eintraege) {
      test(dateiname(e).replace(/\.png$/, ""), async ({}, testInfo) => {
        errors.length = 0;
        if (defekt) {
          await page.close().catch(() => {});
          page = await neueSeite();
          defekt = false;
        }
        const ordner = path.join(AUSGABE, env.stage, testInfo.project.name);
        await mkdir(ordner, { recursive: true });

        await page.goto(urlVon(e), { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => (window as unknown as { __hubDome?: Szene }).__hubDome?.ready === true,
          undefined,
          { timeout: BEREIT_TIMEOUT },
        );
        await page.waitForTimeout(300);

        const szene = await page.evaluate(
          () => (window as unknown as { __hubDome?: Szene }).__hubDome ?? {},
        );
        await page.screenshot({ path: path.join(ordner, dateiname(e)), animations: "disabled" });

        const zahl = (v: number | undefined, stellen = 0) =>
          typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(stellen)) : null;
        const statistik = gesammelt.get(ordner) ?? new Map<string, Statistik>();
        gesammelt.set(ordner, statistik);
        statistik.set(dateiname(e), {
          datei: dateiname(e),
          calls: zahl(szene.calls),
          triangles: zahl(szene.triangles),
          frameMs: zahl(szene.frameMs, 2),
        });

        expect(errors).toEqual([]);
      });
    }
  });
}

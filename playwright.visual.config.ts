import { defineConfig } from "@playwright/test";

// Visuelle Testmatrix (auf Abruf, nicht Teil von `npm run test:e2e` oder `npm run check`):
// rendert /dev/dorf in vielen Varianten und legt Screenshots nach test-results/visual/<etappe>/<projekt>/ ab.
// Aufruf und Umgebungsvariablen: tests/visual/README.md.
//
// Warum die Chromium-Flags: Headless-Chromium hat meist keine GPU. Mit `--use-gl=angle --use-angle=swiftshader`
// rendert WebGL über SwiftShader (CPU); `--enable-unsafe-swiftshader` ist in neueren Chromium-Versionen nötig,
// damit dieser Software-Fallback überhaupt erlaubt ist, `--ignore-gpu-blocklist` verhindert das Abschalten von
// WebGL auf "unbekannten" Grafiktreibern. Ohne diese Flags bleibt die Canvas leer oder wird gar nicht erzeugt.
// Cloud-Umgebungen ohne passende Playwright-Browser: vorhandenes Chromium angeben, z.B.
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test -c playwright.visual.config.ts
// Frame-Zeiten (frameMs in stats.json) sind mit SwiftShader (CPU) nur Richtwerte; Draw Calls und Dreiecke sind belastbar.

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variablen kommen ggf. aus der Umgebung
}

export default defineConfig({
  testDir: "tests/visual",
  // Eigener Ordner: Playwright leert outputDir bei jedem Lauf, test-results/visual/ (die Etappen) muss bleiben
  outputDir: "test-results/_visual-lauf",
  workers: 1,
  retries: 0,
  reporter: "list",
  // Einzelne Bilder dauern mit Software-Rendering lange; Playwright kennt keine Zeitgrenze pro Datei, bewusst
  // auch kein globalTimeout (VISUAL_FULL=1 braucht Stunden). Jeder Test ist durch diese 10 Minuten begrenzt.
  timeout: 600_000,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    navigationTimeout: 120_000,
    launchOptions: {
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});

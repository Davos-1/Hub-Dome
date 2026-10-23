import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variablen kommen ggf. aus der Umgebung
}

// WebGL: Standard ist Chromes eigene Wahl (mit Grafikkarte schnell). Nur ohne GPU (Cloud-Umgebung, CI) Software-
// Rendering über SwiftShader einschalten: PW_SOFTWARE_GL=1 (oder PW_CHROMIUM_PATH gesetzt). Auf einem Rechner mit
// GPU würde SwiftShader die CPU so auslasten, dass Klicks und Seitenaufbau in Zeitlimits laufen.
const softwareGl = process.env.PW_SOFTWARE_GL === "1" || Boolean(process.env.PW_CHROMIUM_PATH);

export default defineConfig({
  testDir: "tests/e2e",
  // Eigener Ordner: Playwright leert outputDir bei jedem Lauf, test-results/visual/ bleibt so erhalten
  outputDir: "test-results/e2e",
  workers: 1,
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
      ...(softwareGl
        ? {
            args: [
              "--use-gl=angle",
              "--use-angle=swiftshader",
              "--enable-unsafe-swiftshader",
              "--ignore-gpu-blocklist",
            ],
          }
        : {}),
    },
  },
});

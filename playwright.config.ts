import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variablen kommen ggf. aus der Umgebung
}

// WebGL im Headless-Chromium: ohne GPU rendert die Canvas nur über SwiftShader (CPU). Die Flags erlauben diesen
// Software-Fallback (`--enable-unsafe-swiftshader`) und verhindern, dass WebGL auf unbekannten Treibern abgeschaltet
// wird; sonst bleibt die 3D-Szene leer. Cloud-Umgebungen ohne passende Playwright-Browser:
// PW_CHROMIUM_PATH=/opt/pw-browsers/chromium setzen. Siehe auch playwright.visual.config.ts.
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
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
});

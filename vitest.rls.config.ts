import path from "node:path";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variablen kommen ggf. aus der Umgebung
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/rls/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 60_000 },
});

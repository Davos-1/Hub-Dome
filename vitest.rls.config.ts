import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variablen kommen ggf. aus der Umgebung
}

export default defineConfig({
  test: { include: ["tests/rls/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 60_000 },
});

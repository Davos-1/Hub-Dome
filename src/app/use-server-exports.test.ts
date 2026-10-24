import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * «use server»-Dateien dürfen nur asynchrone Funktionen exportieren (sonst bricht Next.js jeden Aufruf einer
 * Server Action auf der Seite mit 500 ab). Typen sind erlaubt. Gefunden in Phase 4h: exportierte Zod-Schemas.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("Server Actions", () => {
  it("exportieren nur asynchrone Funktionen und Typen", () => {
    const bad: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      if (!/^["']use server["'];/m.test(src.split("\n").slice(0, 3).join("\n"))) continue;
      for (const line of src.split("\n")) {
        if (!line.startsWith("export ")) continue;
        if (/^export (async function|type |interface )/.test(line)) continue;
        bad.push(`${f}: ${line.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

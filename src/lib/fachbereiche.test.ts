import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FACHBEREICHE, fachbereichOf, houseFachStyle, normalizeModuleCode } from "./fachbereiche";

const seedCodes = [
  ...readFileSync("supabase/seed.sql", "utf8").matchAll(/\('([A-Z]+\.[A-Z]+_[^']+)'/g),
].map((m) => m[1]);

describe("fachbereiche", () => {
  it("normalisiert Modulcodes", () => {
    expect(normalizeModuleCode("TA.BA_BRE")).toBe("BRE");
    expect(normalizeModuleCode("I.BA_ADML_MM")).toBe("ADML_MM");
    expect(normalizeModuleCode("TA.MAA_SUSC_ISA")).toBe("SUSC_ISA");
    expect(normalizeModuleCode("BRE")).toBe("BRE");
  });

  it("ordnet jeden Modulcode aus dem Katalog einem Fachbereich ausser «weitere» zu", () => {
    expect(seedCodes.length).toBeGreaterThan(120);
    const unmapped = seedCodes.filter(
      (code) => fachbereichOf({ kind: "modul", module_code: code }) === "weitere",
    );
    expect(unmapped).toEqual([]);
  });

  it("schickt Themenhäuser und unbekannte Codes nach «weitere»", () => {
    expect(fachbereichOf({ kind: "thema", module_code: null })).toBe("weitere");
    expect(fachbereichOf({ kind: "modul", module_code: "TA.BA_GIBTS_NICHT" })).toBe("weitere");
  });

  it("variiert die Wandfarbe deterministisch pro Haus", () => {
    const h = { id: "abc", kind: "modul" as const, module_code: "TA.BA_BRE" };
    const a = houseFachStyle(h);
    expect(houseFachStyle(h)).toEqual(a);
    expect(a.type).toBe(FACHBEREICHE.wirtschaft.style.type);
    expect(a.wall).toMatch(/^#[0-9a-f]{6}$/);
  });
});

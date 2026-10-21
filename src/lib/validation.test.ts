import { describe, expect, it } from "vitest";
import {
  artifactSchema,
  artifactUrlSchema,
  houseSchema,
  onboardingSchema,
  safeNextPath,
} from "./validation";

describe("artifactUrlSchema", () => {
  it("akzeptiert claude.ai-Links", () => {
    expect(artifactUrlSchema.safeParse("https://claude.ai/public/artifacts/abc").success).toBe(
      true,
    );
  });
  it.each([
    "http://claude.ai/x",
    "https://evil.com/claude.ai/",
    "https://claude.ai.evil.com/x",
    "kein-link",
  ])("lehnt %s ab", (u) => expect(artifactUrlSchema.safeParse(u).success).toBe(false));
});

describe("onboardingSchema", () => {
  it("normalisiert den Benutzernamen", () => {
    const r = onboardingSchema.parse({ username: "  Gian_B ", displayName: " Gian " });
    expect(r).toEqual({ username: "gian_b", displayName: "Gian" });
  });
  it.each(["ab", "mit leerzeichen", "ümlaut", "a".repeat(25)])("lehnt %j ab", (username) => {
    expect(onboardingSchema.safeParse({ username, displayName: "X" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("lässt interne Pfade zu", () => expect(safeNextPath("/einladung/abc")).toBe("/einladung/abc"));
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "evil", null])("blockt %j", (n) =>
    expect(safeNextPath(n)).toBe("/doerfer"),
  );
});

describe("houseSchema", () => {
  it("Modulhaus braucht Modul", () =>
    expect(houseSchema.safeParse({ kind: "modul" }).success).toBe(false));
  it("Themenhaus braucht Titel", () =>
    expect(houseSchema.safeParse({ kind: "thema" }).success).toBe(false));
  it("akzeptiert gültige Eingaben", () => {
    expect(houseSchema.safeParse({ kind: "modul", moduleCode: "TA.BA_BS" }).success).toBe(true);
    expect(houseSchema.safeParse({ kind: "thema", title: "Python" }).data?.color).toBe("#8fb3ff");
  });
  it("lehnt ungültige Farbe ab", () =>
    expect(houseSchema.safeParse({ kind: "thema", title: "X", color: "rot" }).success).toBe(false));
});

describe("artifactSchema", () => {
  const base = {
    houseId: "6f1c2c1e-6f1c-4c1e-8f1c-2c1e6f1c2c1e",
    url: "https://claude.ai/public/artifacts/x",
    title: " Rechner ",
    description: "  ",
    kind: "rechner",
    tags: "Statik, statik, Beton ,,a,b,c,d",
    visibility: "shared",
  };
  it("bereinigt Titel, Beschreibung und Tags", () => {
    const r = artifactSchema.parse(base);
    expect(r.title).toBe("Rechner");
    expect(r.description).toBeNull();
    expect(r.tags).toEqual(["statik", "beton", "a", "b", "c"]);
  });
  it("lehnt fremde URLs und unbekannte Typen ab", () => {
    expect(artifactSchema.safeParse({ ...base, url: "https://evil.com" }).success).toBe(false);
    expect(artifactSchema.safeParse({ ...base, kind: "virus" }).success).toBe(false);
  });
});

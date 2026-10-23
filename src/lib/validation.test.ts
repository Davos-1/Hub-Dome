import { describe, expect, it } from "vitest";
import {
  artifactSchema,
  firstIssue,
  houseSchema,
  onboardingSchema,
  safeNextPath,
} from "./validation";

describe("onboardingSchema", () => {
  it("normalisiert den Benutzernamen", () => {
    const r = onboardingSchema.parse({ username: "  Gian_B ", displayName: " Gian " });
    expect(r).toEqual({ username: "gian_b", displayName: "Gian" });
  });
  it.each(["ab", "mit leerzeichen", "ümlaut", "a".repeat(25)])("lehnt %j ab", (username) => {
    expect(onboardingSchema.safeParse({ username, displayName: "X" }).success).toBe(false);
  });
});

describe("firstIssue", () => {
  it("liefert die erste Fehlermeldung", () => {
    const r = onboardingSchema.safeParse({ username: "ab", displayName: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssue(r.error)).toBe("3–24 Zeichen: Kleinbuchstaben, Zahlen, _ und -.");
    }
  });
});

describe("safeNextPath", () => {
  it("lässt interne Pfade zu", () => expect(safeNextPath("/einladung/abc")).toBe("/einladung/abc"));
  it("lässt Query und Fragment zu", () =>
    expect(safeNextPath("/freund/x?a=1#b")).toBe("/freund/x?a=1#b"));
  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "/x\\y",
    "evil",
    null,
  ])("blockt %j", (n) => expect(safeNextPath(n)).toBe("/start"));
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
  it("Semester ist optional, 1–12", () => {
    const base = { kind: "thema" as const, title: "X" };
    expect(houseSchema.safeParse(base).data?.semester).toBeNull();
    expect(houseSchema.safeParse({ ...base, semester: "" }).data?.semester).toBeNull();
    expect(houseSchema.safeParse({ ...base, semester: "3" }).data?.semester).toBe(3);
    for (const bad of ["0", "13", "2.5", "abc"]) {
      expect(houseSchema.safeParse({ ...base, semester: bad }).success).toBe(false);
    }
  });
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
  it("erkennt den Objekttyp automatisch", () => {
    expect(artifactSchema.parse(base).itemType).toBe("claude_artifact");
    const gh = artifactSchema.parse({ ...base, url: "https://github.com/a/b" });
    expect(gh.itemType).toBe("github_repo");
    expect(artifactSchema.parse({ ...base, url: "https://example.com/x" }).itemType).toBe("link");
  });
  it("lehnt ungültige Kombinationen, http und unbekannte Typen ab", () => {
    const bad = { ...base, itemType: "github_repo" };
    expect(artifactSchema.safeParse(bad).success).toBe(false);
    expect(artifactSchema.safeParse({ ...base, itemType: "gist" }).success).toBe(false);
    expect(artifactSchema.safeParse({ ...base, url: "http://example.com" }).success).toBe(false);
    expect(artifactSchema.safeParse({ ...base, kind: "virus" }).success).toBe(false);
  });
});

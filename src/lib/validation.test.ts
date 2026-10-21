import { describe, expect, it } from "vitest";
import { artifactUrlSchema, onboardingSchema, safeNextPath } from "./validation";

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

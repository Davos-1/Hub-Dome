import { describe, expect, it } from "vitest";
import { artifactUrlSchema } from "./validation";

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

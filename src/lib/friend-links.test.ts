import { describe, expect, it } from "vitest";
import { friendLinkSchema, friendTokenFrom } from "./friend-links";

describe("friendLinkSchema", () => {
  it("nimmt 1–100 Personen an", () => {
    expect(friendLinkSchema.safeParse({ maxUses: "1" }).success).toBe(true);
    expect(friendLinkSchema.safeParse({ maxUses: 100 }).success).toBe(true);
    for (const bad of ["0", "101", "2.5", "abc", ""]) {
      expect(friendLinkSchema.safeParse({ maxUses: bad }).success).toBe(false);
    }
  });
});

describe("friendTokenFrom", () => {
  const token = "A".repeat(43);
  it("holt den Token aus Link und Code", () => {
    expect(friendTokenFrom(`https://hub.example/freund/${token}`)).toBe(token);
    expect(friendTokenFrom(`  ${token}  `)).toBe(token);
    expect(friendTokenFrom(`http://localhost:3000/freund/${token}?x=1`)).toBe(token);
  });
  it("lehnt Unsinn ab", () => {
    expect(friendTokenFrom("")).toBeNull();
    expect(friendTokenFrom("kurz")).toBeNull();
    expect(friendTokenFrom("https://evil.example/freund/<script>")).toBeNull();
  });
});

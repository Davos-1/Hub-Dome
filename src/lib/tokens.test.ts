import { describe, expect, it } from "vitest";
import {
  generateMcpToken,
  generateToken,
  hashMcpToken,
  hashToken,
  MCP_TOKEN_PATTERN,
} from "./tokens";

describe("tokens", () => {
  it("erzeugt eindeutige URL-sichere Tokens", () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });
  it("hasht deterministisch als SHA-256-Hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("MCP-Tokens", () => {
  const pepper = "p".repeat(40);
  it("erzeugt Tokens im erwarteten Format", () => {
    const t = generateMcpToken();
    expect(t).toMatch(MCP_TOKEN_PATTERN);
    expect(generateMcpToken()).not.toBe(t);
  });
  it("hasht deterministisch mit Pepper, anderer Pepper ergibt anderen Hash", () => {
    const t = generateMcpToken();
    expect(hashMcpToken(t, pepper)).toBe(hashMcpToken(t, pepper));
    expect(hashMcpToken(t, pepper)).toHaveLength(64);
    expect(hashMcpToken(t, pepper)).not.toBe(hashMcpToken(t, "q".repeat(40)));
    expect(hashMcpToken(t, pepper)).not.toBe(hashToken(t));
  });
  it("verweigert fehlenden oder zu kurzen Pepper", () => {
    expect(() => hashMcpToken("x", "")).toThrow();
    expect(() => hashMcpToken("x", "kurz")).toThrow();
  });
  it("lehnt falsche Formate ab", () => {
    for (const bad of ["", "hdm_kurz", "abc_" + "A".repeat(43), "hdm_" + "A".repeat(42) + "!"]) {
      expect(bad).not.toMatch(MCP_TOKEN_PATTERN);
    }
  });
});

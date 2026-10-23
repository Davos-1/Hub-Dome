import { describe, expect, it, vi } from "vitest";

// `server-only` wirft ausserhalb von Server Components (auch in Vitest); hier ist nur die Logik von Interesse.
vi.mock("server-only", () => ({}));

import { SEED_RE } from "./seed";
import { legacySeed, randomSeed } from "./seed.server";

describe("legacySeed", () => {
  it("entspricht substr(md5(id::text), 1, 8) der Migration", () => {
    // Erwartungswert einmal mit `md5sum` und `node:crypto` berechnet
    expect(legacySeed("3f2b8c1e-9a47-4d6b-8e35-1c7a5d02b9f4")).toBe("2294ad8b");
  });

  it("ist stabil, gültig und unabhängig von der Gross-/Kleinschreibung der UUID", () => {
    const id = "3f2b8c1e-9a47-4d6b-8e35-1c7a5d02b9f4";
    expect(legacySeed(id)).toBe(legacySeed(id));
    expect(legacySeed(id.toUpperCase())).toBe(legacySeed(id));
    expect(legacySeed(id)).toMatch(SEED_RE);
  });

  it("liefert für verschiedene Dörfer verschiedene Seeds", () => {
    expect(legacySeed("3f2b8c1e-9a47-4d6b-8e35-1c7a5d02b9f4")).not.toBe(
      legacySeed("3f2b8c1e-9a47-4d6b-8e35-1c7a5d02b9f5"),
    );
  });
});

describe("randomSeed", () => {
  it("erfüllt SEED_RE", () => {
    for (let i = 0; i < 500; i++) expect(randomSeed()).toMatch(SEED_RE);
  });

  it("liefert bei zwei Aufrufen verschiedene Seeds", () => {
    expect(randomSeed()).not.toBe(randomSeed());
  });

  it("nutzt Buchstaben und Ziffern", () => {
    const all = Array.from({ length: 200 }, randomSeed).join("");
    expect(all).toMatch(/[a-z]/);
    expect(all).toMatch(/[0-9]/);
  });
});

import { describe, expect, it } from "vitest";
import { smooth, terrainHeight } from "./terrain";

describe("terrainHeight", () => {
  it("ist im Dorf flach", () => {
    for (const [x, z] of [
      [0, 0],
      [10, -8],
      [30, 25],
    ]) {
      expect(terrainHeight(x, z, 40)).toBe(0);
    }
  });

  it("steigt ausserhalb sanft an und bleibt in 1–4 m", () => {
    const ext = 30;
    expect(terrainHeight(ext + 9, 0, ext)).toBe(0);
    let max = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const h = terrainHeight(Math.cos(a) * (ext + 40), Math.sin(a) * (ext + 40), ext);
      expect(h).toBeGreaterThan(0.2);
      expect(h).toBeLessThan(4.5);
      max = Math.max(max, h);
    }
    expect(max).toBeGreaterThan(1.5);
  });

  it("smooth begrenzt auf 0…1", () => {
    expect(smooth(-1)).toBe(0);
    expect(smooth(2)).toBe(1);
    expect(smooth(0.5)).toBeCloseTo(0.5, 5);
  });
});

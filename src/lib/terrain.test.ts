import { describe, expect, it } from "vitest";
import { smooth } from "./terrain";

describe("smooth", () => {
  it("begrenzt auf 0…1 und ist in der Mitte 0.5", () => {
    expect(smooth(-1)).toBe(0);
    expect(smooth(2)).toBe(1);
    expect(smooth(0.5)).toBeCloseTo(0.5);
  });
});

import { describe, expect, it } from "vitest";
import { isClick } from "./pointer";

describe("isClick", () => {
  it("zählt kleine Bewegungen als Klick, grosse als Ziehen", () => {
    expect(isClick({ delta: 0 })).toBe(true);
    expect(isClick({ delta: 5 })).toBe(true);
    expect(isClick({ delta: 6 })).toBe(false);
  });
});

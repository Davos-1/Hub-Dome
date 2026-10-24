import { describe, expect, it } from "vitest";
import { HOUSE_COLORS } from "./house-colors";
import { inkOn } from "./ink";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("inkOn", () => {
  it("wählt auf jeder Hausfarbe die Schrift mit mindestens 3:1 (grosse, fette Schilder)", () => {
    for (const c of HOUSE_COLORS) {
      const ink = inkOn(c) === "light" ? lum("#fffdf8") : lum("#1c1b19");
      expect(ratio(ink, lum(c)), c).toBeGreaterThanOrEqual(3);
    }
  });
  it("Petrol bekommt helle, Pastell dunkle Schrift; Unbekanntes gilt als hell", () => {
    expect(inkOn("#0b5c63")).toBe("light");
    expect(inkOn("#fff1b8")).toBe("dark");
    expect(inkOn("rot")).toBe("dark");
  });
});

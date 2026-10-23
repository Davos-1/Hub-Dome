import { describe, expect, it } from "vitest";
import { noticeRowAt } from "./label-atlas";

/** Bildhöhe `v` (0 = unten, 1 = oben) zu einer Pixelzeile `y` der 640 Pixel hohen Zeichnung. */
const vAt = (y: number) => 1 - y / 640;

describe("noticeRowAt", () => {
  it("liegt über der ersten Zeile im Kopfband (negativ)", () => {
    expect(noticeRowAt(vAt(30))).toBeLessThan(0);
    expect(noticeRowAt(vAt(120))).toBeLessThan(0);
  });

  it.each([
    [130, 0],
    [220, 0],
    [230, 1],
    [330, 2],
    [430, 3],
    [530, 4],
  ])("Pixelzeile %i gehört zu Zeile %i", (y, row) => {
    expect(noticeRowAt(vAt(y))).toBe(row);
  });
});

import { describe, expect, it } from "vitest";
import { resolveTime, zurichHour } from "./daytime";

describe("Tageszeit «Auto» folgt der Uhrzeit in Zürich", () => {
  it("Sommer- und Winterzeit", () => {
    // 24.10.2026: noch Sommerzeit (UTC+2), 15.1.2027: Winterzeit (UTC+1)
    expect(zurichHour(new Date("2026-10-24T12:00:00Z"))).toBe(14);
    expect(zurichHour(new Date("2027-01-15T12:00:00Z"))).toBe(13);
    expect(zurichHour(new Date("2027-01-15T23:30:00Z"))).toBe(0);
  });
  it("«Auto» löst nach der Stunde auf, eine feste Wahl bleibt", () => {
    expect(resolveTime("auto", 7)).toBe("morgen");
    expect(resolveTime("auto", 23)).toBe("nacht");
    expect(resolveTime("abend", 9)).toBe("abend");
  });
});

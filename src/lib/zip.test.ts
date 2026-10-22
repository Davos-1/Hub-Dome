import { describe, expect, it } from "vitest";
import { crc32, zipStore } from "./zip";

describe("zip", () => {
  it("berechnet die bekannte CRC-32 von «123456789»", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("erzeugt ein gültiges Archiv mit Namen und Inhalt", () => {
    const zip = zipStore([{ path: "skill/SKILL.md", content: "Grüsse aus Hub Dome" }]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50); // lokaler Header
    expect(new TextDecoder().decode(zip)).toContain("skill/SKILL.md");
    expect(new TextDecoder().decode(zip)).toContain("Grüsse aus Hub Dome");
    // Ende des zentralen Verzeichnisses: 1 Eintrag
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(1);
  });

  it("ist reproduzierbar", () => {
    const a = zipStore([{ path: "a.txt", content: "x" }]);
    const b = zipStore([{ path: "a.txt", content: "x" }]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

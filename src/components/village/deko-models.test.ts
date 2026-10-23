import { describe, expect, it } from "vitest";
import { DEKO, DEKO_TYPEN, type DekoTyp } from "@/lib/world/catalog";
import { PALETTES } from "@/lib/world/map";
import { dekoParts } from "./deko-models";
import { mergeParts } from "./geo";

const TOL = 0.02;

/** Zusammengeführte Geometrie eines Elements samt Kennzahlen (Eckpunkte, Dreiecke, Höhe). */
function measure(typ: DekoTyp, stimmung: keyof typeof PALETTES) {
  const { body, glow } = dekoParts(typ, PALETTES[stimmung]);
  const geo = mergeParts([...body, ...glow]);
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  let maxR = 0;
  for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
  const out = { body, glow, geo, box: geo.boundingBox!, maxR, tris: pos.count / 3 };
  return out;
}

describe("dekoParts", () => {
  for (const typ of DEKO_TYPEN) {
    describe(typ, () => {
      for (const stimmung of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
        it(`bleibt in der Grundfläche, über dem Boden und unter 1500 Dreiecken (${stimmung})`, () => {
          const m = measure(typ, stimmung);
          const form = DEKO[typ].form;
          if (form.kind === "circle") {
            expect(m.maxR).toBeLessThanOrEqual(form.r + TOL);
          } else {
            expect(Math.max(-m.box.min.x, m.box.max.x)).toBeLessThanOrEqual(form.hw + TOL);
            expect(Math.max(-m.box.min.z, m.box.max.z)).toBeLessThanOrEqual(form.hd + TOL);
          }
          // Nur die Pfähle des Stegs reichen unter den Boden
          expect(m.box.min.y).toBeGreaterThanOrEqual(typ === "steg" ? -0.65 : -0.001);
          expect(m.tris).toBeGreaterThan(0);
          expect(m.tris).toBeLessThan(1500);
          expect(Number.isFinite(m.box.max.y)).toBe(true);
          m.geo.dispose();
        });
      }
    });
  }

  it("liefert nur bei Laterne und Feuerstelle leuchtende Teile", () => {
    for (const typ of DEKO_TYPEN) {
      const { body, glow } = dekoParts(typ, PALETTES.sommer);
      expect(body.length).toBeGreaterThan(0);
      expect(glow.length > 0).toBe(typ === "laterne" || typ === "feuerstelle");
    }
  });

  it("ist deterministisch", () => {
    for (const typ of DEKO_TYPEN) {
      const a = measure(typ, "herbst");
      const b = measure(typ, "herbst");
      expect(a.tris).toBe(b.tris);
      expect(a.box.max.toArray()).toEqual(b.box.max.toArray());
      expect(a.box.min.toArray()).toEqual(b.box.min.toArray());
      a.geo.dispose();
      b.geo.dispose();
    }
  });

  it("Bank: Lehne hinten (−z), Sitzseite vorn (+z)", () => {
    const m = measure("bank", "sommer");
    const pos = m.geo.attributes.position;
    let backZ = 0;
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.7) {
        backZ += pos.getZ(i);
        n++;
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(backZ / n).toBeLessThan(-0.1);
    m.geo.dispose();
  });

  it("Steg: Deckhöhe etwa 0.25, Pfähle (unter y = 0) nur auf der Wasserseite z > 0", () => {
    const m = measure("steg", "sommer");
    const pos = m.geo.attributes.position;
    expect(m.box.min.z).toBeLessThanOrEqual(-1.9);
    expect(m.box.max.z).toBeGreaterThanOrEqual(1.9);
    expect(m.box.min.y).toBeLessThanOrEqual(-0.55);
    let deck = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -0.001) expect(pos.getZ(i)).toBeGreaterThan(0);
      if (Math.abs(pos.getZ(i) + 1.9) < 0.1 && y > 0.2 && y < 0.3) deck = Math.max(deck, y);
    }
    expect(deck).toBeGreaterThan(0.24);
    expect(deck).toBeLessThan(0.27);
    m.geo.dispose();
  });
});

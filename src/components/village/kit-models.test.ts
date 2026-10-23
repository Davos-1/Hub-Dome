import { describe, expect, it } from "vitest";
import { ANBAUTEN, GAERTEN } from "@/lib/world/doc";
import { PALETTES } from "@/lib/world/map";
import { mergeParts, type Part } from "./geo";
import { ANBAU_MASSE, GARTEN_MASSE, anbauParts, gartenParts, type KitFarben } from "./kit-models";

const TOL = 0.02;
const FARBSAETZE: KitFarben[] = [
  { wall: "#efe3c8", roof: "#b4533a", accent: "#3f7f9a" },
  { wall: "#c9d6e3", roof: "#5f7a94", accent: "#d9892b" },
];
const ANBAU_TYPEN = ANBAUTEN.filter((a): a is Exclude<typeof a, "keiner"> => a !== "keiner");

/** Zusammengeführte Geometrie samt Kennzahlen: Hüllbox, grösster Abstand je Achse und Dreiecke. */
function measure(parts: Part[]) {
  const geo = mergeParts(parts);
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const out = {
    box: box.clone(),
    maxX: Math.max(-box.min.x, box.max.x),
    maxZ: Math.max(-box.min.z, box.max.z),
    tris: geo.attributes.position.count / 3,
    finite: Array.from(geo.attributes.position.array).every(Number.isFinite),
  };
  geo.dispose();
  return out;
}

describe("anbauParts", () => {
  for (const anbau of ANBAU_TYPEN) {
    describe(anbau, () => {
      FARBSAETZE.forEach((farben, i) => {
        it(`bleibt in der Grundfläche, über dem Boden und unter 1600 Dreiecken (Farbsatz ${i + 1})`, () => {
          const { body, glow } = anbauParts(anbau, farben);
          const m = measure([...body, ...glow]);
          expect(m.finite).toBe(true);
          expect(m.maxX).toBeLessThanOrEqual(ANBAU_MASSE.hw + TOL);
          expect(m.maxZ).toBeLessThanOrEqual(ANBAU_MASSE.hd + TOL);
          expect(m.box.min.y).toBeGreaterThanOrEqual(-0.001);
          expect(m.box.max.y).toBeLessThanOrEqual(ANBAU_MASSE.h);
          expect(m.tris).toBeGreaterThan(0);
          expect(m.tris).toBeLessThan(1600);
        });
      });
    });
  }

  it("liefert nur beim Wintergarten leuchtende Teile (die Lampe)", () => {
    for (const anbau of ANBAU_TYPEN) {
      const { body, glow } = anbauParts(anbau, FARBSAETZE[0]);
      expect(body.length).toBeGreaterThan(0);
      expect(glow.length > 0).toBe(anbau === "wintergarten");
    }
  });

  it("übernimmt die Farben: andere Farben ergeben andere Bauteilfarben, gleiche Form", () => {
    for (const anbau of ANBAU_TYPEN) {
      const a = anbauParts(anbau, FARBSAETZE[0]).body;
      const b = anbauParts(anbau, FARBSAETZE[1]).body;
      expect(b.length).toBe(a.length);
      expect(b.some((p, k) => p.color !== a[k].color)).toBe(true);
    }
  });

  it("ist deterministisch", () => {
    for (const anbau of ANBAU_TYPEN) {
      const a = anbauParts(anbau, FARBSAETZE[1]);
      const b = anbauParts(anbau, FARBSAETZE[1]);
      expect(b.body.map((p) => [p.color, p.pos, p.rot, p.scale])).toEqual(
        a.body.map((p) => [p.color, p.pos, p.rot, p.scale]),
      );
      const ma = measure([...a.body, ...a.glow]);
      const mb = measure([...b.body, ...b.glow]);
      expect(mb.tris).toBe(ma.tris);
      expect(mb.box.max.toArray()).toEqual(ma.box.max.toArray());
      expect(mb.box.min.toArray()).toEqual(ma.box.min.toArray());
    }
  });

  it("Front nach +z: Tür und Klinke des Schuppens, offene Türflügel des Wintergartens liegen vorn", () => {
    const schuppen = measure(anbauParts("schuppen", FARBSAETZE[0]).body);
    expect(schuppen.box.max.z).toBeGreaterThan(0.6);
    const winter = anbauParts("wintergarten", FARBSAETZE[0]);
    const lamp = measure(winter.glow);
    expect(lamp.box.min.z).toBeGreaterThan(0.2);
  });
});

describe("gartenParts", () => {
  for (const garten of GAERTEN) {
    describe(garten, () => {
      for (const stimmung of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
        it(`bleibt in der Grundfläche, über dem Boden und unter 1200 Dreiecken (${stimmung})`, () => {
          const m = measure(gartenParts(garten, PALETTES[stimmung]));
          expect(m.finite).toBe(true);
          expect(m.maxX).toBeLessThanOrEqual(GARTEN_MASSE.hw + TOL);
          expect(m.maxZ).toBeLessThanOrEqual(GARTEN_MASSE.hd + TOL);
          expect(m.box.min.y).toBeGreaterThanOrEqual(-0.001);
          expect(m.box.max.y).toBeLessThanOrEqual(GARTEN_MASSE.h);
          expect(m.tris).toBeGreaterThan(0);
          expect(m.tris).toBeLessThan(1200);
        });
      }
    });
  }

  it("nutzt die Farben der Stimmung (Steine, Blumen, Früchte)", () => {
    for (const garten of GAERTEN) {
      const sommer = gartenParts(garten, PALETTES.sommer).map((p) => p.color);
      const herbst = gartenParts(garten, PALETTES.herbst).map((p) => p.color);
      expect(herbst.length).toBe(sommer.length);
      expect(herbst.some((c, k) => c !== sommer[k])).toBe(true);
    }
  });

  it("ist deterministisch", () => {
    for (const garten of GAERTEN) {
      const a = gartenParts(garten, PALETTES.alpin);
      const b = gartenParts(garten, PALETTES.alpin);
      expect(b.map((p) => [p.color, p.pos, p.rot, p.scale])).toEqual(
        a.map((p) => [p.color, p.pos, p.rot, p.scale]),
      );
      const ma = measure(a);
      const mb = measure(b);
      expect(mb.tris).toBe(ma.tris);
      expect(mb.box.max.toArray()).toEqual(ma.box.max.toArray());
      expect(mb.box.min.toArray()).toEqual(ma.box.min.toArray());
    }
  });
});

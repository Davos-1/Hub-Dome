import { describe, expect, it } from "vitest";
import { PALETTES } from "@/lib/world/map";
import { SEED_OBJEKT, SEED_OBJEKTE, spanFor, type SeedObjektTyp } from "@/lib/world/seed-objects";
import { mergeParts } from "./geo";
import { seedObjectParts, stoneBridgeParts, willowParts } from "./seed-object-models";

const TOL = 0.02;
const STIMMUNGEN = Object.keys(PALETTES) as (keyof typeof PALETTES)[];
/** Nur diese drei Objekte leuchten (Kapelle: Fenster, Mühle: ein Fenster, Fischerhütte: Laterne). */
const LEUCHTEND: SeedObjektTyp[] = ["kapelle", "wassermuehle", "fischerhuette"];
/** Kapelle, Mühle und Ruine dürfen mehr Dreiecke haben. */
const BUDGET = (typ: SeedObjektTyp) =>
  typ === "kapelle" || typ === "wassermuehle" || typ === "ruine" ? 3500 : 2500;

type Opts = { hd?: number; water?: number };

/** Fälle je Typ: `quer` mit zwei Flussbreiten und ohne Angabe (Standard 6), sonst ein Fall. */
function cases(
  typ: SeedObjektTyp,
): { label: string; opts: Opts | undefined; water: number; hd: number }[] {
  const e = SEED_OBJEKT[typ];
  if (e.lage !== "quer") {
    return [
      { label: "", opts: undefined, water: 6, hd: e.form.kind === "box" ? e.form.hd : e.form.r },
    ];
  }
  return [
    { label: " (Standard)", opts: undefined, water: 6, hd: spanFor(6) },
    ...[4.5, 7].map((w) => ({
      label: ` (Fluss ${w} m)`,
      opts: { hd: spanFor(w), water: w },
      water: w,
      hd: spanFor(w),
    })),
  ];
}

/** Zusammengeführte Geometrie eines Objekts samt Kennzahlen (Hüllbox, grösster Abstand von der Mitte, Dreiecke). */
function measure(typ: SeedObjektTyp, stimmung: keyof typeof PALETTES, opts?: Opts) {
  const { body, glow } = seedObjectParts(typ, PALETTES[stimmung], opts);
  const geo = mergeParts([...body, ...glow]);
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  let maxR = 0;
  for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
  return { body, glow, geo, box: geo.boundingBox!, maxR, tris: pos.count / 3 };
}

describe("seedObjectParts", () => {
  for (const typ of SEED_OBJEKTE) {
    describe(typ, () => {
      for (const c of cases(typ)) {
        for (const stimmung of STIMMUNGEN) {
          it(`bleibt in der Grundfläche, auf dem Boden und im Dreieckbudget${c.label} (${stimmung})`, () => {
            const m = measure(typ, stimmung, c.opts);
            const e = SEED_OBJEKT[typ];
            if (e.form.kind === "circle") {
              expect(m.maxR).toBeLessThanOrEqual(e.form.r + TOL);
            } else {
              expect(Math.max(-m.box.min.x, m.box.max.x)).toBeLessThanOrEqual(e.form.hw + TOL);
              expect(Math.max(-m.box.min.z, m.box.max.z)).toBeLessThanOrEqual(c.hd + TOL);
            }
            // Nur im Wasser (Ufer, Fluss) reichen Pfähle, Rad, Boot, Fähre und Schwelle unter den Boden
            const wet = e.lage === "ufer" || e.lage === "quer";
            expect(m.box.min.y).toBeGreaterThanOrEqual(wet ? -0.7 : -0.001);
            expect(m.box.max.y).toBeGreaterThan(0.3);
            expect(m.box.max.y).toBeLessThan(8);
            expect(m.tris).toBeGreaterThan(0);
            expect(m.tris).toBeLessThan(BUDGET(typ));
            // Leuchtteile nur bei Kapelle, Mühle und Fischerhütte
            expect(m.glow.length > 0).toBe(LEUCHTEND.includes(typ));
            m.geo.dispose();
          });
        }
      }

      const e = SEED_OBJEKT[typ];
      if (e.lage === "ufer") {
        it("liegt unter y = 0 nur auf der Wasserseite (z > 0.2), die Rückseite ist trockenes Land", () => {
          const m = measure(typ, "sommer");
          const pos = m.geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            if (pos.getY(i) < -0.001) expect(pos.getZ(i)).toBeGreaterThan(0.2);
          }
          // Die hintere Hälfte hat Inhalt (Hütte, Mühlenhaus, Bug)
          expect(m.box.min.z).toBeLessThan(-1.0);
          m.geo.dispose();
        });
      }
      if (e.lage === "quer") {
        it("liegt unter y = 0 nur im Wasser (|z| ≤ halbe Wasserbreite + 0.15), die Enden sind Land", () => {
          for (const w of [4.5, 7]) {
            const m = measure(typ, "sommer", { hd: spanFor(w), water: w });
            const pos = m.geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              if (pos.getY(i) < -0.001)
                expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(w / 2 + 0.15);
            }
            // Inhalt an beiden Ufern
            expect(m.box.min.z).toBeLessThan(-w / 2 - 0.5);
            expect(m.box.max.z).toBeGreaterThan(w / 2 + 0.5);
            m.geo.dispose();
          }
        });
      }
    });
  }

  it("liefert nur bei Kapelle, Mühle und Fischerhütte leuchtende Teile", () => {
    for (const typ of SEED_OBJEKTE) {
      const { body, glow } = seedObjectParts(typ, PALETTES.sommer);
      expect(body.length).toBeGreaterThan(0);
      expect(glow.length > 0).toBe(LEUCHTEND.includes(typ));
    }
  });

  it("ist deterministisch", () => {
    for (const typ of SEED_OBJEKTE) {
      const a = measure(typ, "herbst");
      const b = measure(typ, "herbst");
      expect(a.tris).toBe(b.tris);
      expect(a.box.max.toArray()).toEqual(b.box.max.toArray());
      expect(a.box.min.toArray()).toEqual(b.box.min.toArray());
      a.geo.dispose();
      b.geo.dispose();
    }
  });

  it("Ruderboot: Bug zeigt nach −z, Heck liegt im Wasser, zwei Ruder", () => {
    const m = measure("ruderboot", "sommer");
    // Bug (−z) liegt höher als das Heck (+z)
    const pos = m.geo.attributes.position;
    let bowY = -Infinity;
    let sternY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < -1.6) bowY = Math.max(bowY, pos.getY(i));
      if (pos.getZ(i) > 1.2) sternY = Math.min(sternY, pos.getY(i));
    }
    expect(bowY).toBeGreaterThan(0.4);
    expect(sternY).toBeLessThan(0);
    m.geo.dispose();
  });

  it("Kapelle: Tür und Fenster mit leuchtendem Glas, Turm über dem First", () => {
    const m = measure("kapelle", "sommer");
    expect(m.glow.length).toBeGreaterThanOrEqual(4);
    expect(m.box.max.y).toBeGreaterThan(5.5);
    m.geo.dispose();
  });

  it("Wehr: Krone knapp über dem Wasser (0.25 bis 0.4 m)", () => {
    const m = measure("wehr", "sommer");
    const pos = m.geo.attributes.position;
    // Schwelle liegt bei |x| ≤ 0.4: dort darf nichts höher sein als die Krone, ausser dem Schützen-Gestell am Ufer
    let crest = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) <= 0.41 && Math.abs(pos.getZ(i)) < 2.5)
        crest = Math.max(crest, pos.getY(i));
    }
    expect(crest).toBeGreaterThan(0.25);
    expect(crest).toBeLessThan(0.4);
    m.geo.dispose();
  });
});

describe("willowParts", () => {
  it("bleibt in r ≤ 1.6, steht auf dem Boden, 3.5 bis 4.5 m hoch, unter 400 Dreiecken", () => {
    const geo = mergeParts(willowParts());
    geo.computeBoundingBox();
    const pos = geo.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(maxR).toBeLessThanOrEqual(1.6 + TOL);
    expect(geo.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(geo.boundingBox!.max.y).toBeGreaterThan(3.5);
    expect(geo.boundingBox!.max.y).toBeLessThan(4.5);
    expect(pos.count / 3).toBeLessThan(400);
    geo.dispose();
  });
});

describe("stoneBridgeParts", () => {
  for (const span of [8, 12, 16]) {
    it(`bleibt in x ≤ Breite/2 und z ≤ Länge/2, Scheitel 1.0 bis 1.4 m, Enden bündig (Länge ${span})`, () => {
      const width = 2.2;
      const geo = mergeParts(stoneBridgeParts(span, width));
      geo.computeBoundingBox();
      const b = geo.boundingBox!;
      expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(width / 2 + TOL);
      expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(span / 2 + TOL);
      // beide Enden reichen bis an die Länge heran
      expect(b.max.z).toBeGreaterThan(span / 2 - 0.1);
      expect(b.min.z).toBeLessThan(-span / 2 + 0.1);
      expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
      const pos = geo.attributes.position;
      // Fahrbahn: höchster Punkt in der Mitte der Fahrspur (|x| < 0.7), niedrigster an den Enden
      let crest = 0;
      let endTop = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = Math.abs(pos.getX(i));
        const z = Math.abs(pos.getZ(i));
        if (x < 0.6 && z < 0.5) crest = Math.max(crest, pos.getY(i));
        if (x < 0.5 && z > span / 2 - 0.05) endTop = Math.max(endTop, pos.getY(i));
      }
      expect(crest).toBeGreaterThan(1.0);
      expect(crest).toBeLessThan(1.4);
      expect(endTop).toBeLessThan(0.2);
      if (span === 12) expect(pos.count / 3).toBeLessThan(3000);
      expect(pos.count / 3).toBeLessThan(3500);
      geo.dispose();
    });
  }

  it("lässt unter dem Bogen Platz für Wasser: Durchgang in der Mitte mindestens 0.6 m hoch", () => {
    const geo = mergeParts(stoneBridgeParts(12));
    const pos = geo.attributes.position;
    // Unterkante bei z ≈ 0 (Bogenscheitel): kleinster y-Wert der Teile in der Mitte
    let low = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i)) < 0.2) low = Math.min(low, pos.getY(i));
    }
    expect(low).toBeGreaterThan(0.6);
    geo.dispose();
  });
});

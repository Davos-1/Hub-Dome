import { describe, expect, it } from "vitest";
import { FACHBEREICHE } from "../fachbereiche";
import { HOUSE_EXTENTS } from "../house-size";
import { ANBAUTEN, GAERTEN, type Variante } from "./doc";
import {
  ANBAU_FORM,
  BANK_FORM,
  BAUM_R,
  DACH_SETS,
  FARB_SETS,
  GARTEN_FORM,
  kitFits,
  kitLayout,
  withVariante,
} from "./kit";
import { PLOT } from "./settlement";

const base = { ...FACHBEREICHE.tragwerk.style };

describe("Baukasten: Farbe und Dach", () => {
  it("ohne Variante oder mit 0 bleibt der Grundton", () => {
    expect(withVariante(base, undefined)).toEqual(base);
    expect(withVariante(base, { farbe: 0, dach: 0 })).toEqual(base);
  });

  it("jedes Farbset und jedes Dach setzt gültige Farben", () => {
    for (let f = 0; f < FARB_SETS.length; f++)
      for (let d = 0; d < DACH_SETS.length; d++) {
        const c = withVariante(base, { farbe: f, dach: d });
        for (const hex of [c.wall, c.roof, c.accent]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        if (d > 0) expect(c.roof).toBe(DACH_SETS[d].roof);
        if (f > 0) expect(c.wall).toBe(FARB_SETS[f].wall);
        expect(c.type).toBe(base.type);
      }
  });
});

describe("Baukasten: Plätze neben dem Haus", () => {
  const TYPES = Object.keys(HOUSE_EXTENTS) as (keyof typeof HOUSE_EXTENTS)[];
  const combos: (Variante | undefined)[] = [undefined];
  for (const anbau of [undefined, ...ANBAUTEN.filter((a) => a !== "keiner")])
    for (const garten of [undefined, ...GAERTEN]) combos.push({ anbau, garten });

  it("nichts überlappt, nichts ragt ins Haus, in die Hecke oder in die Beete", () => {
    for (const type of TYPES)
      for (const tier of [1, 2, 3] as const)
        for (const v of combos) {
          const l = kitLayout(type, tier, v);
          const e = HOUSE_EXTENTS[type];
          const boxes: { k: string; x0: number; x1: number; z0: number; z1: number }[] = [];
          const add = (k: string, p: { x: number; z: number } | null, hw: number, hd: number) => {
            if (p) boxes.push({ k, x0: p.x - hw, x1: p.x + hw, z0: p.z - hd, z1: p.z + hd });
          };
          add("anbau", l.anbau, ANBAU_FORM.hw, ANBAU_FORM.hd);
          add("garten", l.garten, GARTEN_FORM.hw, GARTEN_FORM.hd);
          add("bank", l.bank, BANK_FORM.hw, BANK_FORM.hd);
          // Baum: Stamm im Grundstück, Krone nicht im Haus
          add("baum", l.baum, BAUM_R, BAUM_R);
          for (const b of boxes) {
            const where = `${type}/${tier}/${JSON.stringify(v)}/${b.k}`;
            // nicht ins Haus
            expect(b.x1 <= e.minX || b.x0 >= e.maxX, where).toBe(true);
            if (b.k !== "baum") {
              // in der Hecke, hinter den Beeten
              expect(
                Math.abs(b.x0) <= PLOT.hw - 0.25 + 1e-9 && Math.abs(b.x1) <= PLOT.hw - 0.25 + 1e-9,
                where,
              ).toBe(true);
              expect(b.z0 >= -PLOT.back + 0.25 - 1e-9 && b.z1 <= 1.95 + 1e-9, where).toBe(true);
            } else {
              expect(Math.abs(l.baum!.x) <= PLOT.hw - 0.25, where).toBe(true);
            }
          }
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i];
              const b = boxes[j];
              const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0;
              expect(apart, `${type}/${tier}/${a.k}+${b.k}`).toBe(true);
            }
          // Gewähltes erscheint, wenn es passt
          const fits = kitFits(type);
          if (v?.anbau) expect(!!l.anbau).toBe(fits.anbau);
          if (v?.garten && fits.garten && !v.anbau) expect(!!l.garten).toBe(true);
        }
  });

  it("die meisten Haustypen bieten Anbau und Garten an", () => {
    const n = TYPES.filter((t) => kitFits(t).anbau && kitFits(t).garten).length;
    expect(n).toBeGreaterThanOrEqual(6);
  });
});

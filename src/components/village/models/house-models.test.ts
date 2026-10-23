import { describe, expect, it } from "vitest";
import type * as THREE from "three";
import type { FachType } from "@/lib/fachbereiche";
import { HOUSE_EXTENTS, TIER_FOOTPRINT, type Tier } from "@/lib/house-size";
import { chimneyTop, houseModel } from "./index";

/** Dreiecke einer Geometrie (indiziert oder nicht). */
const triangles = (g: THREE.BufferGeometry) =>
  (g.index ? g.index.count : g.attributes.position.count) / 3;

/** Grundfläche (x/z) der Karosserie je Typ und Stufe vor der Detail-Etappe; Wachstum höchstens 0.1 m. */
type Box = { x: [number, number]; z: [number, number] };
const LIMITS: Record<FachType, Record<Tier, Box>> = {
  werkstatt: {
    1: { x: [-1.47, 1.47], z: [-1.36, 1.36] },
    2: { x: [-1.64, 2.0], z: [-1.51, 1.51] },
    3: { x: [-2.83, 2.17], z: [-1.66, 1.66] },
  },
  block: {
    1: { x: [-1.5, 1.5], z: [-1.4, 1.53] },
    2: { x: [-1.65, 1.65], z: [-1.55, 2.35] },
    3: { x: [-1.87, 1.8], z: [-1.7, 2.5] },
  },
  solar: {
    1: { x: [-1.23, 1.23], z: [-1.17, 1.53] },
    2: { x: [-1.38, 1.38], z: [-1.32, 1.68] },
    3: { x: [-1.54, 1.54], z: [-1.47, 1.83] },
  },
  atelier: {
    1: { x: [-1.41, 1.42], z: [-1.29, 1.48] },
    2: { x: [-1.58, 1.58], z: [-1.44, 2.39] },
    3: { x: [-1.74, 2.87], z: [-1.58, 2.53] },
  },
  stadt: {
    1: { x: [-1.22, 1.22], z: [-1.22, 1.62] },
    2: { x: [-1.36, 1.36], z: [-1.36, 1.76] },
    3: { x: [-1.51, 1.51], z: [-1.51, 1.9] },
  },
  turm: {
    1: { x: [-1.62, 1.65], z: [-1.29, 1.48] },
    2: { x: [-1.8, 1.87], z: [-1.44, 1.62] },
    3: { x: [-1.98, 2.1], z: [-1.58, 1.76] },
  },
  digital: {
    1: { x: [-1.23, 1.23], z: [-1.17, 1.53] },
    2: { x: [-1.38, 1.38], z: [-1.32, 2.25] },
    3: { x: [-1.54, 3.08], z: [-1.47, 2.4] },
  },
  haus: {
    1: { x: [-1.45, 1.45], z: [-1.47, 1.58] },
    2: { x: [-1.6, 1.6], z: [-1.62, 1.91] },
    3: { x: [-1.75, 3.14], z: [-1.78, 2.22] },
  },
};

const TYPES = Object.keys(LIMITS) as FachType[];
const TIERS: Tier[] = [1, 2, 3];
const SLACK = 0.1;
/** Vor der Haustür darf die Stufe/das Vordach in der Mitte bis z = 2.0 reichen. */
const DOOR_Z = 2.0;
const DOOR_X = 0.6;

describe("Haus-Modelle", () => {
  for (const type of TYPES) {
    for (const tier of TIERS) {
      for (const active of [false, true]) {
        const fp = TIER_FOOTPRINT[tier];
        const name = `${type} Stufe ${tier}${active ? " (aktiv)" : ""}`;

        it(`${name}: Grundfläche, Boden, Dreiecke, Oberkante`, () => {
          const m = houseModel(type, fp, tier, "#e8dcc8", "#b4533a", "#3a6ea5", active);
          m.body.computeBoundingBox();
          m.glow.computeBoundingBox();
          const bb = m.body.boundingBox!;
          const gb = m.glow.boundingBox!;
          const lim = LIMITS[type][tier];

          // Grundfläche wächst höchstens um 0.1 m; Türstufe/Vordach in der Mitte dürfen bis z = 2.0
          expect(bb.min.x).toBeGreaterThanOrEqual(lim.x[0] - SLACK);
          expect(bb.max.x).toBeLessThanOrEqual(lim.x[1] + SLACK);
          expect(bb.min.z).toBeGreaterThanOrEqual(lim.z[0] - SLACK);
          const zMax = lim.z[1] + SLACK;
          const pos = m.body.attributes.position;
          let zOver = 0;
          for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i);
            if (z <= zMax) continue;
            // Nur in der Mitte vor der Tür erlaubt
            expect(Math.abs(pos.getX(i)), `Punkt ${i} bei z=${z.toFixed(2)}`).toBeLessThanOrEqual(
              DOOR_X,
            );
            expect(z).toBeLessThanOrEqual(DOOR_Z + 1e-6);
            zOver++;
          }
          expect(zOver).toBeGreaterThanOrEqual(0);

          // Leuchtteile liegen in derselben Grundfläche
          expect(gb.min.x).toBeGreaterThanOrEqual(lim.x[0] - SLACK);
          expect(gb.max.x).toBeLessThanOrEqual(lim.x[1] + SLACK);
          expect(gb.min.z).toBeGreaterThanOrEqual(lim.z[0] - SLACK);
          expect(gb.max.z).toBeLessThanOrEqual(Math.max(zMax, DOOR_Z));

          // nichts unter dem Boden
          expect(bb.min.y).toBeGreaterThanOrEqual(-0.001);
          expect(gb.min.y).toBeGreaterThanOrEqual(-0.001);

          // Dreiecksbudget (Körper + Leuchtteile)
          expect(triangles(m.body) + triangles(m.glow)).toBeLessThanOrEqual(2500);

          // Oberkante für Beschriftung und Trefferfläche: höchstens 0.9 m unter dem höchsten Punkt
          const maxY = Math.max(bb.max.y, gb.max.y);
          expect(m.top).toBeGreaterThanOrEqual(maxY - 0.9);
          expect(m.top).toBeLessThanOrEqual(maxY + 0.6);
        });
      }

      it(`${type} Stufe ${tier}: Kaminöffnung für den Rauch liegt auf einem Kamin`, () => {
        const fp = TIER_FOOTPRINT[tier];
        const top = chimneyTop(type, fp);
        if (!top) return;
        const m = houseModel(type, fp, tier, "#e8dcc8", "#b4533a", "#3a6ea5", true);
        m.body.computeBoundingBox();
        const bb = m.body.boundingBox!;
        const [x, y, z] = top;
        expect(x).toBeGreaterThanOrEqual(bb.min.x);
        expect(x).toBeLessThanOrEqual(bb.max.x);
        expect(z).toBeGreaterThanOrEqual(bb.min.z);
        expect(z).toBeLessThanOrEqual(bb.max.z);
        // ein Eckpunkt des Modells liegt höchstens 0.4 m neben der Öffnung (der Kamin steht dort wirklich)
        const pos = m.body.attributes.position;
        let best = Infinity;
        for (let i = 0; i < pos.count; i++) {
          best = Math.min(best, Math.hypot(pos.getX(i) - x, pos.getY(i) - y, pos.getZ(i) - z));
        }
        expect(best).toBeLessThanOrEqual(0.4);
        // und über der Öffnung ragt nichts mehr auf (der Rauch steigt frei auf)
        let above = 0;
        for (let i = 0; i < pos.count; i++) {
          if (Math.hypot(pos.getX(i) - x, pos.getZ(i) - z) < 0.12 && pos.getY(i) > y + 0.05)
            above++;
        }
        expect(above).toBe(0);
      });
    }
  }

  it("liefert für Typen mit Kamin einen Punkt, für Flachdächer nicht", () => {
    for (const type of ["haus", "block", "werkstatt", "stadt", "turm", "atelier"] as const) {
      expect(chimneyTop(type, TIER_FOOTPRINT[1])).not.toBeNull();
    }
    for (const type of ["solar", "digital"] as const) {
      expect(chimneyTop(type, TIER_FOOTPRINT[1])).toBeNull();
    }
  });
});

describe("Hausmodelle und Platzregeln", () => {
  it("jedes Modell bleibt in HOUSE_EXTENTS (Grundlage für Anbau, Gartenfeld, Bank und Baum)", () => {
    for (const type of Object.keys(HOUSE_EXTENTS) as FachType[])
      for (const tier of [1, 2, 3] as const)
        for (const active of [false, true]) {
          const m = houseModel(
            type,
            TIER_FOOTPRINT[tier],
            tier,
            "#e8dcc8",
            "#b4533a",
            "#3a6ea5",
            active,
          );
          const e = HOUSE_EXTENTS[type];
          for (const g of [m.body, m.glow]) {
            g.computeBoundingBox();
            const b = g.boundingBox!;
            const where = `${type}/${tier}/${active}`;
            expect(b.min.x, where).toBeGreaterThanOrEqual(e.minX);
            expect(b.max.x, where).toBeLessThanOrEqual(e.maxX);
            expect(b.min.z, where).toBeGreaterThanOrEqual(e.minZ);
            expect(b.max.z, where).toBeLessThanOrEqual(e.maxZ);
          }
        }
  });
});

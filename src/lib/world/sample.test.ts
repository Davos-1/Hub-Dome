import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { DEKO_TYPEN } from "./catalog";
import { generateWorld } from "./generate";
import { sampleDoc } from "./sample";

const houses: LayoutHouse[] = [
  { id: "zentrale", kind: "zentrale", fach: "weitere", items: [] },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `h${i}`,
    kind: "modul" as const,
    fach: FACH_ORDER[(i * 5) % 8],
    order: i,
    items: [],
  })),
];

describe("Beispiel-Deko", () => {
  it("ist gültig, deterministisch und verschiebt mit fixierten Häusern keines", () => {
    for (const seed of ["hubdome1", "b7k2m9qx", "kx81bb20", "p9p9p9p9"]) {
      const doc = sampleDoc({ seed, houses });
      expect(sampleDoc({ seed, houses })).toEqual(doc);
      const deko = doc.deko ?? [];
      // (fast) jeder Typ kommt vor; der Steg nur, wenn es ein Ufer gibt
      const typen = new Set(deko.map((d) => d.typ));
      expect(DEKO_TYPEN.filter((t) => t !== "steg" && !typen.has(t))).toEqual([]);
      const ohne = generateWorld({ seed, houses });
      const mit = generateWorld({ seed, houses, doc });
      expect(mit.rejected).toEqual([]);
      expect(mit.settlement.droppedPins).toEqual([]);
      expect(mit.deko).toHaveLength(deko.length);
      for (const [id, h] of Object.entries(ohne.settlement.houses)) {
        const m = mit.settlement.houses[id];
        expect([m.x, m.z, m.angle], `${seed}/${id}`).toEqual([h.x, h.z, h.angle]);
      }
    }
  }, 60_000);
});

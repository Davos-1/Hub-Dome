import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { generateWorld } from "./generate";

/**
 * Generator v2 bleibt eingefroren (wie v1, Phase 4h): Bestehende Dörfer behalten ihr Aussehen, bis der Besitzer
 * neu würfelt oder aktualisiert. Der Fingerabdruck fasst Karte, Siedlung, Wege, Laternen und Pflanzen zusammen
 * (gerundet auf Millimeter). Ändert er sich, hat eine Änderung v2 berührt: in v3 verschieben, nicht hier anpassen.
 */

function houses(n: number, objects: number): LayoutHouse[] {
  const out: LayoutHouse[] = [
    {
      id: "z",
      kind: "zentrale",
      fach: "weitere",
      items: Array.from({ length: 3 }, (_, k) => ({ id: `z${k}`, kind: "rechner" })),
    },
  ];
  for (let i = 0; i < n; i++)
    out.push({
      id: `h${i}`,
      kind: "modul",
      fach: FACH_ORDER[(i * 3) % FACH_ORDER.length],
      items: Array.from({ length: (objects + i) % 14 }, (_, k) => ({
        id: `a${i}-${k}`,
        kind: k % 2 ? "quiz" : "rechner",
      })),
      order: i,
    });
  return out;
}

/** FNV-1a über die gerundete JSON-Darstellung. */
function fingerprint(value: unknown): string {
  const json = JSON.stringify(value, (_, v) =>
    typeof v === "number" ? Math.round(v * 1000) / 1000 : v,
  );
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const CASES: [string, number][] = [
  ["hubdome1", 0],
  ["hubdome1", 12],
  ["b7k2m9qx", 25],
  ["flussb01", 8],
  ["q0q0q0q0", 18],
  ["kx81bb20", 30],
];

describe("Generator v2 (eingefroren)", () => {
  it("liefert für feste Eingaben dieselbe Welt wie bei der Einführung von v3", () => {
    const prints = CASES.map(([seed, n]) => {
      const w = generateWorld({ seed, version: 2, houses: houses(n, 5) });
      return [
        `${seed}/${n}`,
        fingerprint({
          map: w.map,
          layout: w.layout,
          lamps: w.lamps,
          vegetation: w.vegetation,
          plazaProps: w.plazaProps,
          chickenRun: w.chickenRun,
          bridges: w.settlement.bridges,
          unplaced: w.settlement.unplaced,
        }),
      ].join(" ");
    });
    expect(prints).toMatchSnapshot();
  }, 60_000);
});

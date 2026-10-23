import { DEKO_TYPEN, type DekoTyp } from "./catalog";
import { FACHBEREICHE } from "../fachbereiche";
import { ANBAUTEN, GAERTEN, type DekoItem, type Variante, type WorldDoc } from "./doc";
import { generateWorld, type WorldInput } from "./generate";
import { polar, TAU } from "./geom";
import { DACH_SETS, FARB_SETS, kitFits } from "./kit";
import { inWater, waterEdgeDist } from "./map";
import { applyDeko, snapDeko } from "./rules";
import { range, rng } from "./seed";
import { pinsFromSettlement } from "./settlement";

/** Wie viele Elemente je Typ die Beispiel-Deko setzt (Bäume öfter, Brunnen und Feuerstelle einmal). */
const MENGE: Record<DekoTyp, number> = {
  bank: 3,
  picknick: 2,
  laterne: 3,
  blumenbeet: 3,
  hochbeet: 2,
  zaun: 3,
  brunnen: 1,
  laubbaum: 3,
  nadelbaum: 2,
  obstbaum: 2,
  busch: 3,
  findling: 2,
  feuerstelle: 1,
  steg: 1,
};

/**
 * Beispiel-Platzierungen für die Entwickler-Vorschau und Tests: jedes Katalog-Element einige Male, gültig
 * eingerastet (dieselben Regeln wie beim Besitzer), deterministisch aus dem Seed. Der Steg sucht sich ein
 * Ufer, alles andere liegt zwischen Dorfplatz und Waldrand. Wie beim Speichern im Bau-Modus werden die
 * Quartiere und Häuser dabei fixiert: Deko verschiebt nie ein bestehendes Haus.
 */
export function sampleDoc(input: Omit<WorldInput, "doc">): WorldDoc {
  const world = generateWorld({ ...input, doc: { v: 1 } });
  const space = world.editSpace.clone();
  const map = world.map;
  const r = rng(input.seed, "beispiel-deko");
  const out: DekoItem[] = [];
  let n = 0;
  for (const typ of DEKO_TYPEN) {
    for (let k = 0, made = 0; k < 60 && made < MENGE[typ]; k++) {
      let x: number;
      let z: number;
      if (typ === "steg") {
        // Punkt knapp am Ufer
        const p = polar(r() * TAU, range(r, 10, map.rFlat + 20));
        const d = waterEdgeDist(map, p.x, p.z);
        if (d < 0.8 || d > 2.4 || inWater(map, { kind: "circle", x: p.x, z: p.z, r: 0.5 }))
          continue;
        x = p.x;
        z = p.z;
      } else {
        const p = polar(r() * TAU, range(r, map.plaza.a + 3, Math.min(map.rFlat - 8, 60)));
        x = p.x;
        z = p.z;
      }
      const item: DekoItem = {
        id: `bsp-${n++}`,
        typ,
        x: Math.round(x * 4) / 4,
        z: Math.round(z * 4) / 4,
        r: Math.floor(r() * 24) * 15,
      };
      const snapped = snapDeko(space, item);
      if (!snapped) continue;
      if (applyDeko(space, [snapped]).placed.length !== 1) continue;
      out.push(snapped);
      made++;
    }
  }
  // Baukasten: jedes Haus eine andere Kombination (nur was neben den Haustyp passt)
  const varianten: Record<string, Variante> = {};
  input.houses
    .filter((h) => h.kind !== "zentrale")
    .forEach((h, i) => {
      const fits = kitFits(FACHBEREICHE[h.fach].style.type);
      const v: Variante = { farbe: i % FARB_SETS.length, dach: (i + 1) % DACH_SETS.length };
      if (fits.anbau && i % 4 !== 3) v.anbau = ANBAUTEN[1 + (i % 3)];
      if (fits.garten) v.garten = GAERTEN[i % GAERTEN.length];
      varianten[h.id] = v;
    });
  return { v: 1, ...pinsFromSettlement(world.settlement), deko: out, varianten };
}

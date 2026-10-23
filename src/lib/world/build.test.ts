import { describe, expect, it } from "vitest";
import { FACH_ORDER } from "../fachbereiche";
import type { LayoutHouse } from "../layout";
import { seededRandom } from "../random";
import {
  addDeko,
  commit,
  docForSave,
  draftDoc,
  draftFromDoc,
  ghostAt,
  nextDekoId,
  pinHouse,
  redo,
  removeDeko,
  replaceDeko,
  setVariante,
  startHistory,
  undo,
} from "./build";
import { DEKO_TYPEN } from "./catalog";
import { worldDocSchema } from "./doc";
import { generateWorld } from "./generate";
import { checkDeko } from "./rules";
import { freeSlots } from "./settlement";

const houses = (n: number): LayoutHouse[] => [
  { id: "zentrale", kind: "zentrale", fach: "weitere", items: [] },
  ...Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    kind: "modul" as const,
    fach: FACH_ORDER[(i * 5) % 8],
    order: i,
    items: [],
  })),
];

describe("Bau-Modus: Entwurf", () => {
  it("Rückgängig und Wiederholen", () => {
    let h = startHistory(draftFromDoc({ v: 1 }));
    const a = { id: "d1", typ: "bank" as const, x: 30, z: 0, r: 0 };
    h = commit(h, addDeko(h.present, a));
    h = commit(h, replaceDeko(h.present, { ...a, x: 31 }));
    h = commit(h, setVariante(h.present, "h1", { farbe: 2 }));
    expect(h.present.deko[0].x).toBe(31);
    h = undo(undo(h));
    expect(h.present.deko[0].x).toBe(30);
    expect(h.present.varianten).toEqual({});
    h = redo(h);
    expect(h.present.deko[0].x).toBe(31);
    h = commit(h, removeDeko(h.present, "d1"));
    expect(h.future).toEqual([]);
    expect(h.present.deko).toEqual([]);
    // Variante zurück auf Automatik: Eintrag verschwindet
    const v = setVariante(setVariante(h.present, "h2", { dach: 1 }), "h2", { dach: undefined });
    expect(v.varianten).toEqual({});
  });

  it("neue Ids sind eindeutig und gültig", () => {
    let d = draftFromDoc({ v: 1 });
    for (let i = 0; i < 50; i++) {
      const id = nextDekoId(d.deko);
      expect(id).toMatch(/^[a-z0-9-]{1,24}$/);
      expect(d.deko.some((x) => x.id === id)).toBe(false);
      d = addDeko(d, { id, typ: "busch", x: i, z: 0, r: 0 });
    }
  });
});

describe("Bau-Modus: Live-Prüfung", () => {
  it("zufällige Eingaben enden gültig (ggf. eingerastet) oder abgewiesen, gespeichert wird nur Gültiges", () => {
    for (const seed of ["hubdome1", "b7k2m9qx", "q0q0q0q0", "zz00aa11"]) {
      const hs = houses(10);
      const r = seededRandom(`bau-${seed}`);
      let world = generateWorld({ seed, houses: hs });
      let draft = draftFromDoc({ v: 1 });
      const before = world.settlement.houses;
      for (let k = 0; k < 40; k++) {
        const typ = DEKO_TYPEN[Math.floor(r() * DEKO_TYPEN.length)];
        const raw = {
          id: nextDekoId(draft.deko),
          typ,
          x: (r() - 0.5) * 140,
          z: (r() - 0.5) * 140,
          r: Math.floor(r() * 24) * 15,
        };
        const g = ghostAt(world.editSpace, raw);
        if (!g.ok) {
          expect(checkDeko(world.editSpace, g.item)).not.toBeNull();
          continue;
        }
        expect(checkDeko(world.editSpace, g.item)).toBeNull();
        draft = addDeko(draft, g.item);
        const doc = docForSave(draft, world.settlement);
        expect(worldDocSchema.safeParse(doc).success).toBe(true);
        world = generateWorld({ seed, houses: hs, doc });
        // Nichts abgewiesen, kein Haus bewegt sich
        expect(world.rejected, `${seed}#${k}`).toEqual([]);
        for (const [id, h] of Object.entries(before)) {
          const m = world.settlement.houses[id];
          expect([m.x, m.z, m.angle]).toEqual([h.x, h.z, h.angle]);
        }
      }
      expect(world.deko.length).toBe(draft.deko.length);
    }
  }, 60_000);
});

describe("Bau-Modus: Haus umsetzen", () => {
  it("auf einen freien Platz im eigenen Quartier: nur dieses Haus bewegt sich, nichts wird abgewiesen", () => {
    for (const seed of ["hubdome1", "b7k2m9qx", "kx81bb20"]) {
      const hs = houses(12);
      const world = generateWorld({ seed, houses: hs });
      for (const id of ["h0", "h5", "h9"]) {
        const q = world.layout.houses[id].quarterId!;
        const slots = freeSlots(seed, world.editSpace, world.settlement, q);
        if (!slots.length) continue;
        const target = slots[slots.length - 1];
        const draft = pinHouse(draftFromDoc({ v: 1 }, world.settlement), id, {
          r: target.dir,
          s: target.key,
        });
        const moved = generateWorld({ seed, houses: hs, doc: draftDoc(draft) });
        expect(moved.settlement.droppedPins, `${seed}/${id}`).toEqual([]);
        const m = moved.settlement.houses[id];
        expect([m.x, m.z]).toEqual([target.x, target.z]);
        for (const [other, h] of Object.entries(world.settlement.houses)) {
          if (other === id) continue;
          const o = moved.settlement.houses[other];
          expect([o.x, o.z, o.angle], `${seed}/${id} → ${other}`).toEqual([h.x, h.z, h.angle]);
        }
      }
    }
  }, 60_000);
});

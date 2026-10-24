import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/random";
import { draftDoc } from "@/lib/world/build";
import type { WorldDoc } from "@/lib/world/doc";
import { generateWorld, type World, type WorldInput } from "@/lib/world/generate";
import { makeSeed } from "@/lib/world/seed";
import { DISTS, village } from "@/lib/world/test-world";
import { treeRadius } from "@/lib/world/vegetation";
import { createBuildStore } from "./build-store";

/** Bau-Store mit v3-Welt; `sync` rechnet die Entwurfswelt nach jeder Änderung neu (wie die Szene). */
function setup(seed: string, doc: WorldDoc = { v: 1 }) {
  const input: WorldInput = { version: 3, seed, houses: village(8, DISTS.gemischt, seed) };
  const build = createBuildStore(doc);
  let world: World = generateWorld({ ...input, doc });
  build.setWorld(world, input);
  build.start(doc);
  const sync = () => {
    world = generateWorld({ ...input, doc: draftDoc(build.get().history.present) });
    build.setWorld(world, input);
    return world;
  };
  return { build, sync, world: () => world };
}

/** Freie Stelle in der Wiese für Baum `i` (ausserhalb der Siedlung), über den Store geprüft. */
type Tree = World["vegetation"]["trees"][number];
/** v3-Bäume tragen ihre Nummer `i`. */
const numbered = (w: World) =>
  w.vegetation.trees.filter((x): x is Tree & { i: number } => x.i !== undefined);
const loose = (w: World) =>
  numbered(w).filter((x) => x.kind !== "obst" && Math.hypot(x.x, x.z) > 45);
function moveTree(s: ReturnType<typeof setup>, i: number, from: { x: number; z: number }) {
  for (let k = 0; k < 48; k++) {
    const a = (k / 16) * Math.PI * 2;
    const d = [2.5, 4, 6][Math.floor(k / 16)];
    const p = { x: from.x + Math.cos(a) * d, z: from.z + Math.sin(a) * d };
    s.build.startTreeDrag(i);
    s.build.dropPoint(p.x, p.z);
    if (!s.build.get().bad) {
      s.sync();
      return p;
    }
  }
  return null;
}

const SEEDS = Array.from({ length: 6 }, (_, i) => makeSeed(seededRandom(`bau-store-${i}`)));

describe("Bau-Store v3: Bäume und Eckpunkte", () => {
  it("Klick ohne Ziehen auf einen versetzten Baum ändert nichts (kein Schritt im Verlauf)", () => {
    const s = setup(SEEDS[0]);
    const t = loose(s.world())[0];
    const p = moveTree(s, t.i, t);
    expect(p).not.toBeNull();
    const steps = s.build.get().history.past.length;
    s.build.startTreeDrag(t.i);
    s.build.dropPoint(p!.x, p!.z);
    expect(s.build.get().history.past.length).toBe(steps);
    expect(s.build.get().point).toBeNull();
    s.build.startTreeDrag(t.i);
    s.build.releasePoint();
    expect(s.build.get().history.past.length).toBe(steps);
  }, 60_000);

  it("Baum über dem Hühnerhof: Vorschau und Ablegen sagen beide «passt nicht»", () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const s = setup(seed);
      const run = s.world().chickenRun;
      if (!run) continue;
      const t = numbered(s.world())[0];
      s.build.startTreeDrag(t.i);
      s.build.hover(run.x, run.z);
      const pt = s.build.get().point;
      expect(pt?.kind === "baum" && pt.ok, seed).toBe(false);
      s.build.dropPoint(run.x, run.z);
      expect(s.build.get().bad, seed).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  }, 120_000);

  it("ein zweiter Baum dicht an einem versetzten wird abgewiesen; beide bleiben gültig", () => {
    const s = setup(SEEDS[1]);
    const far = loose(s.world());
    const a = far[0];
    const b = far.find((x) => x.i > a.i && Math.hypot(x.x - a.x, x.z - a.z) > 8)!;
    const pa = moveTree(s, a.i, a)!;
    expect(pa).not.toBeNull();
    const ra = treeRadius(a.kind, a.s);
    const rb = treeRadius(b.kind, b.s);
    const steps = s.build.get().history.past.length;
    s.build.startTreeDrag(b.i);
    s.build.dropPoint(pa.x + ra + rb + 0.07, pa.z);
    expect(s.build.get().bad).toBe(true);
    expect(s.build.get().history.past.length).toBe(steps);
    expect(s.sync().invalidTreeMoves).toEqual([]);
  }, 60_000);

  it("eigene Deko nicht auf einen versetzten Baum", () => {
    const s = setup(SEEDS[2]);
    // Baum innerhalb der Fläche, auf der eigene Deko stehen darf
    const inner = numbered(s.world()).filter(
      (x) => x.kind !== "obst" && Math.hypot(x.x, x.z) < s.world().map.rBuild - 8,
    );
    let p: { x: number; z: number } | null = null;
    for (const t of inner) if ((p = moveTree(s, t.i, t))) break;
    expect(p).not.toBeNull();
    s.build.chooseTool("bank");
    s.build.hover(p!.x, p!.z);
    const g = s.build.get().ghost;
    expect(g?.ok).toBe(false);
    expect(g && !g.ok && g.grund).toBe("auf einem versetzten Baum");
  }, 60_000);
});

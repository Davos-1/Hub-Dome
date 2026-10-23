import type { World } from "@/lib/world/generate";
import type { Bridge, Pasture, Windmill } from "@/lib/world/map";

type Pt = { x: number; z: number };

/** Was die Leben-Komponenten (Wasser, Tiere) aus der Welt brauchen; fehlende Merkmale sind `null`. */
export type Environment = {
  river: { points: Pt[]; width: number } | null;
  /** Brücken: Wanderweg und Gassen über den Fluss. */
  bridges: Bridge[];
  pond: { x: number; z: number; r: number } | null;
  lake: { x: number; z: number; r: number; outline: Pt[] } | null;
  pasture: Pasture | null;
  windmill: Windmill | null;
  chickens: { x: number; z: number; r: number } | null;
  /** Blumeninseln (Schmetterlinge fliegen darüber). */
  flowers: Pt[];
  extent: number;
};

export function environmentOf(world: World): Environment {
  const m = world.map;
  return {
    river: m.river,
    bridges: [...(m.bridge ? [m.bridge] : []), ...world.settlement.bridges],
    pond: m.pond,
    lake: m.lake,
    pasture: m.pasture,
    windmill: m.windmill,
    chickens: world.chickenRun,
    flowers: world.vegetation.flowers.map((f) => ({ x: f.x, z: f.z })),
    extent: world.layout.extent,
  };
}

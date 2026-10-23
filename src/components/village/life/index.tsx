"use client";

import type { VillageLayout } from "@/lib/layout";
import type { Environment } from "../world-env";
import { Birds, Butterflies, Chickens, Ducks, RiverDucks, Sheep, Villagers } from "./creatures";
import { Clouds } from "./clouds";
import { Fireflies } from "./fireflies";
import { ChickenRun, Pasture, Windmill } from "./farm";
import { LiveFrames } from "./live-frames";
import { Bridges, Lake, Pond, River, Sandbanks } from "./water";

type Props = {
  layout: VillageLayout;
  env: Environment;
  lowDetail: boolean;
  /** `prefers-reduced-motion`: alles steht still, es werden keine Frames erzeugt. */
  reducedMotion: boolean;
  /** Kartenansicht: nur Wasser und Brücken bleiben sichtbar. */
  mapOnly?: boolean;
  /** Abend oder Nacht: Glühwürmchen. */
  dark?: boolean;
  /** Ein Dialog liegt über der Welt: keine laufenden Frames (spart CPU und Akku). */
  paused?: boolean;
  /** Leuchtkraft von Fenstern und Laternen (Tageszeit). */
  glow?: number;
};

/**
 * Das Leben im Dorf: Wasser (Fluss mit Brücken, Teich, See), Weide mit Schafen, Hühnerhof, Windmühle,
 * Dorfbewohner auf den Wegen, Vögel, Schmetterlinge, Wolken und nachts Glühwürmchen. Was die Landschaft nicht hat, fehlt.
 * Tiere bleiben in ihren Bereichen (Weide, Wasser, Hühnerhof). Auf Mobile weniger Tiere.
 */
export function Life({
  layout,
  env,
  lowDetail,
  reducedMotion,
  mapOnly = false,
  dark = false,
  paused = false,
  glow = 0.85,
}: Props) {
  const frozen = reducedMotion;
  const n = (full: number, low: number) => (lowDetail ? low : full);
  const homes = Object.values(layout.houses).filter((h) => h.plot).length;
  const villagers = Math.min(n(10, 5), homes + 2);
  const duckWater =
    env.pond ?? (env.lake ? { x: env.lake.x, z: env.lake.z, r: env.lake.r * 0.55 } : null);

  return (
    <>
      <LiveFrames enabled={!reducedMotion && !paused} fps={n(30, 20)} />
      {env.rivers.map((river, i) => (
        <River
          key={i}
          river={river}
          bridges={env.bridges}
          frozen={frozen}
          density={n(1, 0.5)}
          level={i === 0 && env.river ? 0.05 : 0.035}
        />
      ))}
      {env.sandbanks.length > 0 && <Sandbanks polys={env.sandbanks} />}
      {env.lake && <Lake lake={env.lake} frozen={frozen} density={n(1, 0.5)} />}
      <Bridges bridges={env.bridges} glow={glow} />
      {!mapOnly && (
        <>
          {env.pond && <Pond pond={env.pond} frozen={frozen} density={n(1, 0.5)} />}
          {env.pasture && <Pasture pasture={env.pasture} />}
          {env.pasture && <Sheep pasture={env.pasture} count={n(5, 3)} frozen={frozen} />}
          {env.windmill && <Windmill windmill={env.windmill} frozen={frozen} />}
          {duckWater && <Ducks water={duckWater} count={n(3, 2)} frozen={frozen} />}
          {env.rivers[0] && env.v2 && env.rivers[0].width >= 2.2 && (
            <RiverDucks river={env.rivers[0]} count={n(4, 2)} frozen={frozen} />
          )}
          {env.chickens && <ChickenRun run={env.chickens} />}
          {env.chickens && <Chickens center={env.chickens} count={n(4, 2)} frozen={frozen} />}
          <Villagers paths={layout.paths} count={homes > 0 ? villagers : 0} frozen={frozen} />
          <Birds extent={layout.extent} count={n(7, 3)} frozen={frozen} />
          <Butterflies spots={env.flowers} count={n(10, 4)} frozen={frozen} />
          <Clouds extent={layout.extent} count={n(7, 4)} frozen={frozen} />
          {dark && <Fireflies spots={env.flowers} count={n(60, 24)} frozen={frozen} />}
        </>
      )}
    </>
  );
}

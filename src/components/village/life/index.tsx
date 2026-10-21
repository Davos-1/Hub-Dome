"use client";

import { useMemo } from "react";
import type { Environment } from "@/lib/environment";
import type { VillageLayout } from "@/lib/layout";
import { Birds, Butterflies, Chickens, Ducks, Sheep, Villagers } from "./creatures";
import { Clouds } from "./clouds";
import { Pasture, Windmill } from "./farm";
import { LiveFrames } from "./live-frames";
import { Pond, River } from "./water";

type Props = {
  layout: VillageLayout;
  env: Environment;
  lowDetail: boolean;
  /** `prefers-reduced-motion`: alles steht still, es werden keine Frames erzeugt. */
  reducedMotion: boolean;
};

/**
 * Das Leben im Dorf: Fluss mit Brücke, Teich mit Enten, Weide mit Schafen, Hühner, Windmühle,
 * Dorfbewohner auf den Wegen, Vögel, Schmetterlinge und Wolken. Auf Mobile weniger Tiere.
 */
export function Life({ layout, env, lowDetail, reducedMotion }: Props) {
  const frozen = reducedMotion;
  const n = (full: number, low: number) => (lowDetail ? low : full);

  const chickenSpot = useMemo(() => {
    const h = Object.values(layout.houses).find((x) => x.ring > 0);
    if (!h) return { x: 0, z: 0, any: false };
    const len = Math.hypot(h.x, h.z) || 1;
    const out = h.footprint + 3.4;
    return { x: h.x + (h.x / len) * out, z: h.z + (h.z / len) * out, any: true };
  }, [layout.houses]);

  const homes = Object.values(layout.houses).filter((h) => h.ring > 0).length;
  const villagers = Math.min(n(10, 5), homes + 2);

  return (
    <>
      <LiveFrames enabled={!reducedMotion} fps={n(30, 20)} />
      <River env={env} frozen={frozen} density={n(1, 0.5)} />
      <Pond env={env} frozen={frozen} density={n(1, 0.5)} />
      <Pasture env={env} />
      <Windmill env={env} frozen={frozen} />
      <Sheep env={env} count={n(5, 3)} frozen={frozen} />
      <Ducks env={env} count={n(3, 2)} frozen={frozen} />
      {chickenSpot.any && <Chickens center={chickenSpot} count={n(4, 2)} frozen={frozen} />}
      <Villagers paths={layout.paths} count={homes > 0 ? villagers : 0} frozen={frozen} />
      <Birds extent={layout.extent} count={n(7, 3)} frozen={frozen} />
      <Butterflies extent={layout.extent} count={n(10, 4)} frozen={frozen} seed={homes} />
      <Clouds extent={layout.extent} count={n(7, 4)} frozen={frozen} />
    </>
  );
}

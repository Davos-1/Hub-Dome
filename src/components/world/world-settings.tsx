"use client";

import { describeMap } from "@/lib/world/map";
import { makeSeed } from "@/lib/world/seed";
import type { VillageModel } from "@/lib/village-model";

/** Neuer Seed aus der Zufallsquelle des Browsers. */
export function randomSeed(): string {
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  let i = 0;
  return makeSeed(() => buf[i++] / 2 ** 32);
}

/**
 * Einstellungen › Dorf › Landschaft: zeigt Landschaft und Stimmung des eigenen Dorfs und startet «Welt neu
 * würfeln» als Vorschau direkt in der Szene (übernommen wird erst nach Bestätigung im Vorschau-Band).
 */
export function WorldSettings({
  model,
  isOwner,
  onPreview,
}: {
  /** Das gerade angezeigte Dorf. */
  model: VillageModel;
  /** Ist das angezeigte Dorf das eigene? Neu würfeln geht nur dort (die Vorschau zeigt es). */
  isOwner: boolean;
  onPreview: (seed: string) => void;
}) {
  const w = model.world;
  return (
    <section className="hd-card flex flex-col gap-2">
      <h3 className="text-[15px] font-bold">Landschaft</h3>
      {isOwner ? (
        <>
          <p className="text-[14px] text-[#3a3732]">
            {describeMap(w.map)}{" "}
            <span className="hd-note">
              (Welt «{w.seed}», Generator {w.version})
            </span>
          </p>
          <p className="hd-note">
            Gelände, Wasser, Pflanzen und die Lage der Quartiere entstehen aus diesem Seed und
            bleiben gleich, bis du neu würfelst. Du siehst die neue Welt zuerst als Vorschau; deine
            eigene Deko bleibt, wenn sie in die neue Landschaft passt.
          </p>
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm self-start"
            onClick={() => onPreview(randomSeed())}
          >
            Welt neu würfeln …
          </button>
        </>
      ) : (
        <p className="hd-note">
          Du besuchst gerade ein anderes Dorf. Die Landschaft deines Dorfs änderst du in deinem
          eigenen Dorf.
        </p>
      )}
    </section>
  );
}

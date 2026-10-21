"use client";

import dynamic from "next/dynamic";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { ZentraleStyle } from "@/lib/styles";

const StylePreview = dynamic(() => import("@/components/village/style-preview"), { ssr: false });

/** Entwickler-Galerie: Haustyp eines Fachbereichs (4 Zustände) und Zentrale nebeneinander. */
export function Gallery({ fach, zentrale }: { fach: FachbereichId; zentrale: ZentraleStyle }) {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="h-[460px] overflow-hidden rounded-xl border" data-testid="haeuser">
        <StylePreview mode="haus" fach={fach} />
      </div>
      <div className="h-[460px] overflow-hidden rounded-xl border" data-testid="zentrale">
        <StylePreview mode="zentrale" zentraleStyle={zentrale} />
      </div>
    </div>
  );
}

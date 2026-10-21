"use client";

import dynamic from "next/dynamic";
import type { HouseStyle, ZentraleStyle } from "@/lib/styles";

const StylePreview = dynamic(() => import("@/components/village/style-preview"), { ssr: false });

/** Entwickler-Galerie: zeigt Haus-Stil (4 Zustände) und Zentrale nebeneinander. */
export function Gallery({ house, zentrale }: { house: HouseStyle; zentrale: ZentraleStyle }) {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="h-[460px] overflow-hidden rounded-xl border" data-testid="haeuser">
        <StylePreview mode="haeuser" houseStyle={house} zentraleStyle={zentrale} />
      </div>
      <div className="h-[460px] overflow-hidden rounded-xl border" data-testid="zentrale">
        <StylePreview mode="zentrale" houseStyle={house} zentraleStyle={zentrale} />
      </div>
    </div>
  );
}

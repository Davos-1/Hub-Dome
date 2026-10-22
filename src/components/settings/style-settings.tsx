"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { updateVillageStyle } from "@/app/einstellungen/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ZENTRALE_STYLES, ZENTRALE_STYLE_INFO, type ZentraleStyle } from "@/lib/styles";

const StylePreview = dynamic(() => import("@/components/village/style-preview"), {
  ssr: false,
  loading: () => <p className="hd-note p-4">Vorschau wird geladen…</p>,
});

/** Stil-Auswahl für die Zentrale mit Live-Vorschau. */
export function StyleSettings({ zentraleStyle }: { zentraleStyle: ZentraleStyle }) {
  const [zentrale, setZentrale] = useState<ZentraleStyle>(zentraleStyle);

  return (
    <ActionForm
      action={updateVillageStyle}
      submitLabel="Stil speichern"
      successText="Gespeichert. Dein Dorf sieht jetzt anders aus."
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="hd-label mb-1.5">Stil der Zentrale</legend>
          {ZENTRALE_STYLES.map((s) => {
            const on = zentrale === s;
            return (
              <label
                key={s}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${
                  on
                    ? "border-[#2f5d4a] bg-[#eef5f0]"
                    : "border-[#e4d9c0] bg-[#fffdf8] hover:bg-[#f7efdc]"
                }`}
              >
                <input
                  type="radio"
                  name="zentraleStyle"
                  value={s}
                  checked={on}
                  onChange={() => setZentrale(s)}
                  className="mt-1 accent-[#2f5d4a]"
                />
                <span>
                  <span className="block text-[14px] font-bold">
                    {ZENTRALE_STYLE_INFO[s].label}
                  </span>
                  <span className="hd-note block">{ZENTRALE_STYLE_INFO[s].description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-2 md:sticky md:top-0 md:self-start">
          <div className="hd-frame h-72 overflow-hidden rounded-2xl">
            <StylePreview mode="zentrale" zentraleStyle={zentrale} />
          </div>
          <p className="hd-note">Drehen mit der Maus, zoomen mit dem Mausrad.</p>
        </div>
      </div>
    </ActionForm>
  );
}

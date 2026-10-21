"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { updateVillageStyle } from "@/app/einstellungen/actions";
import { ActionForm } from "@/components/ui/action-form";
import {
  HOUSE_STYLES,
  HOUSE_STYLE_INFO,
  ZENTRALE_STYLES,
  ZENTRALE_STYLE_INFO,
  type HouseStyle,
  type ZentraleStyle,
} from "@/lib/styles";

const StylePreview = dynamic(() => import("@/components/village/style-preview"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-zinc-500">Vorschau wird geladen…</p>,
});

type Props = {
  houseStyle: HouseStyle;
  zentraleStyle: ZentraleStyle;
  /** Ob bereits ein eigenes Modell hochgeladen wurde (Voraussetzung für «Eigenes Modell»). */
  hasModel: boolean;
};

function Choice({
  name,
  value,
  checked,
  label,
  description,
  disabled,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  description: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
        checked ? "border-blue-600 bg-blue-50" : "border-zinc-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-zinc-600">{description}</span>
      </span>
    </label>
  );
}

/** Stil-Auswahl für Häuser und Zentrale mit Live-Vorschau. */
export function StyleSettings({ houseStyle, zentraleStyle, hasModel }: Props) {
  const [house, setHouse] = useState<HouseStyle>(houseStyle);
  const [zentrale, setZentrale] = useState<ZentraleStyle>(zentraleStyle);
  const [mode, setMode] = useState<"haeuser" | "zentrale">("haeuser");

  return (
    <ActionForm
      action={updateVillageStyle}
      submitLabel="Stile speichern"
      successText="Gespeichert. Dein Dorf sieht jetzt anders aus."
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2" onFocus={() => setMode("haeuser")}>
            <legend className="mb-1 text-lg font-semibold">Haus-Stil (alle Häuser)</legend>
            {HOUSE_STYLES.map((s) => (
              <Choice
                key={s}
                name="houseStyle"
                value={s}
                checked={house === s}
                label={HOUSE_STYLE_INFO[s].label}
                description={HOUSE_STYLE_INFO[s].description}
                onChange={() => {
                  setHouse(s);
                  setMode("haeuser");
                }}
              />
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2" onFocus={() => setMode("zentrale")}>
            <legend className="mb-1 text-lg font-semibold">Stil der Zentrale</legend>
            {ZENTRALE_STYLES.map((s) => (
              <Choice
                key={s}
                name="zentraleStyle"
                value={s}
                checked={zentrale === s}
                label={ZENTRALE_STYLE_INFO[s].label}
                description={
                  s === "custom" && !hasModel
                    ? "Zuerst unten ein Modell hochladen."
                    : ZENTRALE_STYLE_INFO[s].description
                }
                disabled={s === "custom" && !hasModel}
                onChange={() => {
                  setZentrale(s);
                  setMode("zentrale");
                }}
              />
            ))}
          </fieldset>
        </div>

        <div className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex gap-2 text-sm" role="tablist" aria-label="Vorschau">
            {(["haeuser", "zentrale"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full border px-3 py-1 ${
                  mode === m ? "bg-blue-600 text-white" : "border-zinc-300"
                }`}
              >
                {m === "haeuser" ? "Häuser" : "Zentrale"}
              </button>
            ))}
          </div>
          <div className="h-80 overflow-hidden rounded-xl border border-zinc-300">
            {zentrale === "custom" && mode === "zentrale" ? (
              <p className="p-4 text-sm text-zinc-600">
                Das eigene Modell siehst du in deinem Dorf (die Vorschau zeigt nur die fertigen
                Stile).
              </p>
            ) : (
              <StylePreview
                mode={mode}
                houseStyle={house}
                zentraleStyle={zentrale === "custom" ? "rathaus" : zentrale}
              />
            )}
          </div>
          {mode === "haeuser" && (
            <p className="text-xs text-zinc-500">
              Von links nach rechts: Baustelle (leeres Haus), dann Stufe 1 (0–2 Objekte), Stufe 2
              (3–6) und Stufe 3 (7+).
            </p>
          )}
        </div>
      </div>
    </ActionForm>
  );
}

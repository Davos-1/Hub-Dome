"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { updateVillageStyle } from "@/app/einstellungen/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ZENTRALE_STYLES, ZENTRALE_STYLE_INFO, type ZentraleStyle } from "@/lib/styles";

const StylePreview = dynamic(() => import("@/components/village/style-preview"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-zinc-500">Vorschau wird geladen…</p>,
});

type Props = {
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

/** Stil-Auswahl für die Zentrale mit Live-Vorschau. */
export function StyleSettings({ zentraleStyle, hasModel }: Props) {
  const [zentrale, setZentrale] = useState<ZentraleStyle>(zentraleStyle);

  return (
    <ActionForm
      action={updateVillageStyle}
      submitLabel="Stil speichern"
      successText="Gespeichert. Dein Dorf sieht jetzt anders aus."
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
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
              onChange={() => setZentrale(s)}
            />
          ))}
        </fieldset>

        <div className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
          <div className="h-80 overflow-hidden rounded-xl border border-zinc-300">
            {zentrale === "custom" ? (
              <p className="p-4 text-sm text-zinc-600">
                Das eigene Modell siehst du in deinem Dorf (die Vorschau zeigt nur die fertigen
                Stile).
              </p>
            ) : (
              <StylePreview mode="zentrale" zentraleStyle={zentrale} />
            )}
          </div>
        </div>
      </div>
    </ActionForm>
  );
}

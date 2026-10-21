"use client";

import { useState } from "react";
import { createHouse } from "@/app/dorf/actions";
import { ActionForm, inputClass } from "@/components/ui/action-form";
import type { ModuleOption } from "@/lib/types";

export function HouseCreateForm({
  modules,
  onSuccess,
}: {
  modules: ModuleOption[];
  onSuccess?: () => void;
}) {
  const [kind, setKind] = useState<"modul" | "thema">("modul");

  return (
    <ActionForm
      action={createHouse}
      submitLabel="Haus anlegen"
      successText="Haus angelegt."
      onSuccess={onSuccess}
    >
      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm font-medium">Art</legend>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="kind"
            value="modul"
            checked={kind === "modul"}
            onChange={() => setKind("modul")}
          />
          Modulhaus
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="kind"
            value="thema"
            checked={kind === "thema"}
            onChange={() => setKind("thema")}
          />
          Themenhaus
        </label>
      </fieldset>
      {kind === "modul" ? (
        <>
          <label htmlFor="moduleCode" className="text-sm font-medium">
            Modul
          </label>
          <select id="moduleCode" name="moduleCode" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Modul wählen…
            </option>
            {modules.map((m) => (
              <option key={m.code} value={m.code}>
                {m.title}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label htmlFor="title" className="text-sm font-medium">
            Titel
          </label>
          <input id="title" name="title" required maxLength={80} className={inputClass} />
        </>
      )}
      <label htmlFor="semester" className="text-sm font-medium">
        Semester (optional)
      </label>
      <input
        id="semester"
        name="semester"
        type="number"
        min={1}
        max={12}
        inputMode="numeric"
        className={inputClass}
      />
      <label htmlFor="color" className="text-sm font-medium">
        Farbe
      </label>
      <input id="color" name="color" type="color" defaultValue="#8fb3ff" className="h-10 w-20" />
    </ActionForm>
  );
}

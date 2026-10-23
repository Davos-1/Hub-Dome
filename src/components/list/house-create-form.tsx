"use client";

import { useId, useState } from "react";
import { createHouse } from "@/app/dorf/actions";
import { ActionForm, inputClass } from "@/components/ui/action-form";
import type { ModuleOption } from "@/lib/types";
import { HouseFields } from "./house-fields";

export function HouseCreateForm({
  modules,
  onSuccess,
}: {
  modules: ModuleOption[];
  onSuccess?: () => void;
}) {
  const [kind, setKind] = useState<"modul" | "thema">("modul");
  const id = useId();

  return (
    <ActionForm
      action={createHouse}
      submitLabel="Haus anlegen"
      successText="Haus angelegt."
      onSuccess={onSuccess}
    >
      <fieldset className="flex gap-4">
        <legend className="hd-label mb-1">Art</legend>
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
          <label htmlFor={`${id}-module`} className="hd-label">
            Modul
          </label>
          <select
            id={`${id}-module`}
            name="moduleCode"
            required
            className={inputClass}
            defaultValue=""
          >
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
          <label htmlFor={`${id}-title`} className="hd-label">
            Titel
          </label>
          <input id={`${id}-title`} name="title" required maxLength={80} className={inputClass} />
        </>
      )}
      <HouseFields color="#8fb3ff" />
    </ActionForm>
  );
}

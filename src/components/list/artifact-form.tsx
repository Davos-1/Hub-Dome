"use client";

import { useState } from "react";
import { ActionForm, inputClass } from "@/components/ui/action-form";
import { ITEM_TYPE_LABELS, LINK_ITEM_TYPES } from "@/lib/item-types";
import { ARTIFACT_KINDS, ARTIFACT_KIND_LABELS, type ActionState, type Artifact } from "@/lib/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  houses: { id: string; title: string }[];
  defaultHouseId?: string;
  artifact?: Artifact;
  submitLabel: string;
  onSuccess?: () => void;
};

export function ArtifactForm({
  action,
  houses,
  defaultHouseId,
  artifact,
  submitLabel,
  onSuccess,
}: Props) {
  // Eindeutige IDs: dieselbe Seite enthält mehrere Formulare (pro Haus und pro Artifact).
  const id = artifact?.id ?? `neu-${defaultHouseId}`;
  // Übernahmen sind immer privat; eine neue URL macht daraus eine eigene Version («basiert auf»).
  const isCopy = artifact?.is_copy ?? false;
  const [visibility, setVisibility] = useState(artifact?.visibility ?? "shared");
  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      successText="Gespeichert."
      onSuccess={onSuccess}
    >
      {artifact && <input type="hidden" name="id" value={artifact.id} />}
      {isCopy && (
        <p className="rounded-xl bg-[#e0f2fe] p-3 text-[13px] text-[#0c4a6e]">
          <strong>Eigene Version verknüpfen:</strong> Passe das Objekt in Claude an (bei geteilten
          Artifacts z.B. über «Remix», falls angeboten) und füge hier den Link deiner Version ein.
        </p>
      )}
      <label htmlFor={`url-${id}`} className="hd-label">
        Link
      </label>
      <input
        id={`url-${id}`}
        name="url"
        type="url"
        required
        placeholder="https://…"
        defaultValue={artifact?.url}
        className={inputClass}
      />
      <label htmlFor={`type-${id}`} className="hd-label">
        Objekttyp
      </label>
      <select
        id={`type-${id}`}
        name="itemType"
        defaultValue={artifact?.item_type ?? "auto"}
        className={inputClass}
      >
        <option value="auto">Automatisch erkennen</option>
        {LINK_ITEM_TYPES.map((t) => (
          <option key={t} value={t}>
            {ITEM_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <label htmlFor={`title-${id}`} className="hd-label">
        Titel
      </label>
      <input
        id={`title-${id}`}
        name="title"
        required
        maxLength={120}
        defaultValue={artifact?.title}
        className={inputClass}
      />
      <label htmlFor={`desc-${id}`} className="hd-label">
        Beschreibung (optional)
      </label>
      <textarea
        id={`desc-${id}`}
        name="description"
        maxLength={500}
        rows={2}
        defaultValue={artifact?.description ?? ""}
        className={inputClass}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`house-${id}`} className="hd-label">
            Haus
          </label>
          <select
            id={`house-${id}`}
            name="houseId"
            required
            defaultValue={artifact?.house_id ?? defaultHouseId}
            className={inputClass}
          >
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`kind-${id}`} className="hd-label">
            Typ
          </label>
          <select
            id={`kind-${id}`}
            name="kind"
            defaultValue={artifact?.kind ?? "sonstiges"}
            className={inputClass}
          >
            {ARTIFACT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ARTIFACT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`tags-${id}`} className="hd-label">
            Tags (kommagetrennt, max. 5)
          </label>
          <input
            id={`tags-${id}`}
            name="tags"
            defaultValue={artifact?.tags.join(", ")}
            className={inputClass}
          />
        </div>
        {isCopy ? (
          <div className="flex flex-col gap-1">
            <input type="hidden" name="visibility" value="private" />
            <span className="hd-label">Sichtbarkeit</span>
            <p className="hd-note">Übernahmen sind nur für dich sichtbar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor={`vis-${id}`} className="hd-label">
              Sichtbarkeit
            </label>
            <select
              id={`vis-${id}`}
              name="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "shared" | "private")}
              className={inputClass}
            >
              <option value="shared">Für Freunde sichtbar</option>
              <option value="private">Nur für mich</option>
            </select>
          </div>
        )}
      </div>
      {!isCopy && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              name="allowCopy"
              defaultChecked={artifact?.allow_copy ?? true}
              className="h-4 w-4"
            />
            Andere dürfen übernehmen
          </label>
          <label
            className={`flex items-start gap-2 text-[14px] ${visibility === "shared" ? "" : "opacity-50"}`}
          >
            <input
              type="checkbox"
              name="topdorfOk"
              defaultChecked={artifact?.topdorf_ok ?? false}
              disabled={visibility !== "shared"}
              className="mt-1 h-4 w-4"
            />
            <span>
              Im Topdorf zeigen
              <span className="hd-note block">
                Für alle angemeldeten Hub-Dome-Nutzer sichtbar, mit deinem Namen.
              </span>
            </span>
          </label>
        </div>
      )}
      <p className="hd-note">
        Claude-Artifacts: Stelle die Freigabe in claude.ai auf «Jeder mit dem Link», sonst können
        deine Freunde das Objekt nicht öffnen.
      </p>
      <p className="hd-note">Teile keine Lösungen zu bewerteten Leistungsnachweisen.</p>
    </ActionForm>
  );
}

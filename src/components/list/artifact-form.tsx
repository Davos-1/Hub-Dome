"use client";

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
  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      successText="Gespeichert."
      onSuccess={onSuccess}
    >
      {artifact && <input type="hidden" name="id" value={artifact.id} />}
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
        <div className="flex flex-col gap-1">
          <label htmlFor={`vis-${id}`} className="hd-label">
            Sichtbarkeit
          </label>
          <select
            id={`vis-${id}`}
            name="visibility"
            defaultValue={artifact?.visibility ?? "shared"}
            className={inputClass}
          >
            <option value="shared">Für Freunde sichtbar</option>
            <option value="private">Nur für mich</option>
          </select>
        </div>
      </div>
      <p className="hd-note">
        Claude-Artifacts: Stelle die Freigabe in claude.ai auf «Jeder mit dem Link», sonst können
        deine Freunde das Objekt nicht öffnen.
      </p>
      <p className="hd-note">Teile keine Lösungen zu bewerteten Leistungsnachweisen.</p>
    </ActionForm>
  );
}

import {
  createArtifact,
  deleteArtifact,
  deleteHouse,
  updateArtifact,
  updateHouse,
} from "@/app/dorf/actions";
import { ActionForm, dangerButton, inputClass } from "@/components/ui/action-form";
import { hostOf, ITEM_TYPE_ICONS, ITEM_TYPE_LABELS } from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact, type House } from "@/lib/types";
import { ObjectPreview } from "./object-preview";
import { ArtifactForm } from "./artifact-form";

type Props = {
  house: House;
  artifacts: Artifact[];
  houses: { id: string; title: string }[];
  isOwner: boolean;
};

export function HouseSection({ house, artifacts, houses, isOwner }: Props) {
  return (
    <section aria-labelledby={`h-${house.id}`} className="rounded-xl border border-zinc-300 p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-4 w-4 rounded-full" style={{ background: house.color }} />
        <h2 id={`h-${house.id}`} className="text-xl font-semibold">
          {house.title}
        </h2>
        <span className="text-sm text-zinc-500">{artifacts.length} Objekte</span>
      </div>

      {artifacts.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">
          {house.kind === "zentrale"
            ? "Noch nichts in der Zentrale."
            : "Baustelle: noch keine Objekte."}
        </p>
      )}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {artifacts.map((a) => (
          <li key={a.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline"
              >
                {a.title}
              </a>
              <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-black">
                {ARTIFACT_KIND_LABELS[a.kind]}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              <span aria-hidden>{ITEM_TYPE_ICONS[a.item_type]}</span>{" "}
              {ITEM_TYPE_LABELS[a.item_type]}
              {a.item_type !== "claude_artifact" && ` · ${hostOf(a.url)}`}
            </p>
            {a.description && <p className="mt-1 text-sm">{a.description}</p>}
            <ObjectPreview artifact={a} />
            {a.tags.length > 0 && (
              <p className="mt-1 text-xs text-zinc-500">#{a.tags.join(" #")}</p>
            )}
            {a.visibility === "private" && <p className="mt-1 text-xs text-amber-700">Privat</p>}
            {isOwner && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm underline">Bearbeiten</summary>
                <div className="mt-2 flex flex-col gap-2">
                  <ArtifactForm
                    action={updateArtifact}
                    artifact={a}
                    houses={houses}
                    submitLabel="Speichern"
                  />
                  <ActionForm
                    action={deleteArtifact}
                    submitLabel="Löschen"
                    confirm="Objekt wirklich löschen?"
                    buttonClassName={dangerButton}
                  >
                    <input type="hidden" name="id" value={a.id} />
                  </ActionForm>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="mt-3 flex flex-col gap-2">
          <details>
            <summary className="cursor-pointer text-sm font-medium underline">
              Objekt hinzufügen
            </summary>
            <div className="mt-2">
              <ArtifactForm
                action={createArtifact}
                houses={houses}
                defaultHouseId={house.id}
                submitLabel="Objekt speichern"
              />
            </div>
          </details>
          {house.kind !== "zentrale" && (
            <details>
              <summary className="cursor-pointer text-sm underline">Haus bearbeiten</summary>
              <div className="mt-2 flex flex-col gap-2">
                <ActionForm action={updateHouse} submitLabel="Speichern" successText="Gespeichert.">
                  <input type="hidden" name="id" value={house.id} />
                  <label htmlFor={`ht-${house.id}`} className="text-sm font-medium">
                    Titel
                  </label>
                  <input
                    id={`ht-${house.id}`}
                    name="title"
                    required
                    maxLength={80}
                    defaultValue={house.title}
                    className={inputClass}
                  />
                  <label htmlFor={`hc-${house.id}`} className="text-sm font-medium">
                    Farbe
                  </label>
                  <input
                    id={`hc-${house.id}`}
                    name="color"
                    type="color"
                    defaultValue={house.color}
                    className="h-10 w-20"
                  />
                </ActionForm>
                <ActionForm
                  action={deleteHouse}
                  submitLabel="Haus löschen"
                  confirm={`Haus «${house.title}» löschen? Alle ${artifacts.length} Objekte darin werden ebenfalls gelöscht.`}
                  buttonClassName={dangerButton}
                >
                  <input type="hidden" name="id" value={house.id} />
                </ActionForm>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

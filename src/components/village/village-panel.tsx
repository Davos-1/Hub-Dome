"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { hostOf, ITEM_TYPE_ICONS, ITEM_TYPE_LABELS } from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact, type House } from "@/lib/types";

type Props = {
  villageName: string;
  ownerUsername: string;
  isOwner: boolean;
  houses: House[];
  artifacts: Artifact[];
  house: House | null;
  artifact: Artifact | null;
  previews: Record<string, ReactNode>;
  onSelectHouse: (id: string | null) => void;
  onSelectArtifact: (id: string | null) => void;
};

const btn =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-left hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600";

export function VillagePanel({
  villageName,
  ownerUsername,
  isOwner,
  houses,
  artifacts,
  house,
  artifact,
  previews,
  onSelectHouse,
  onSelectArtifact,
}: Props) {
  const countOf = (houseId: string) => artifacts.filter((a) => a.house_id === houseId).length;
  const listHref = `/dorf/${ownerUsername}/liste`;

  // --- Detail eines Objekts ---
  if (artifact) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="self-start text-sm underline"
          onClick={() => onSelectArtifact(null)}
        >
          ← Zurück zu {house?.title ?? "Haus"}
        </button>
        <h2 className="text-xl font-semibold">{artifact.title}</h2>
        <p className="text-sm text-zinc-500">
          <span aria-hidden>{ITEM_TYPE_ICONS[artifact.item_type]}</span>{" "}
          {ITEM_TYPE_LABELS[artifact.item_type]} · {ARTIFACT_KIND_LABELS[artifact.kind]}
          {artifact.item_type !== "claude_artifact" && ` · ${hostOf(artifact.url)}`}
        </p>
        {artifact.description && <p>{artifact.description}</p>}
        {artifact.tags.length > 0 && (
          <p className="text-xs text-zinc-500">#{artifact.tags.join(" #")}</p>
        )}
        {artifact.visibility === "private" && <p className="text-xs text-amber-700">Privat</p>}
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white"
        >
          Öffnen
        </a>
        {previews[artifact.id]}
      </div>
    );
  }

  // --- Objekte eines Hauses ---
  if (house) {
    const items = artifacts.filter((a) => a.house_id === house.id);
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="self-start text-sm underline"
          onClick={() => onSelectHouse(null)}
        >
          ← Zurück zur Übersicht
        </button>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <span aria-hidden className="h-4 w-4 rounded-full" style={{ background: house.color }} />
          {house.title}
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Baustelle: hier gibt es noch keine Objekte.
            {isOwner && " Füge in der Listenansicht dein erstes Objekt hinzu."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((a) => (
              <li key={a.id}>
                <button type="button" className={btn} onClick={() => onSelectArtifact(a.id)}>
                  <span aria-hidden>{ITEM_TYPE_ICONS[a.item_type]}</span> {a.title}
                  <span className="block text-xs text-zinc-500">
                    {ITEM_TYPE_LABELS[a.item_type]} · {ARTIFACT_KIND_LABELS[a.kind]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {isOwner && (
          <Link href={listHref} className="text-sm underline">
            In der Listenansicht bearbeiten
          </Link>
        )}
      </div>
    );
  }

  // --- Übersicht ---
  const moduleHouses = houses.filter((h) => h.kind !== "zentrale");
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{villageName}</h2>
      <p className="text-sm text-zinc-500">
        {moduleHouses.length} Häuser · {artifacts.length} Objekte. Klicke auf ein Haus oder wähle es
        hier aus.
      </p>
      {moduleHouses.length === 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {isOwner ? (
            <>
              Lege dein erstes Modulhaus an – in der{" "}
              <Link href={listHref} className="underline">
                Listenansicht
              </Link>
              .
            </>
          ) : (
            "Hier gibt es noch keine Häuser."
          )}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {houses.map((h) => (
          <li key={h.id}>
            <button type="button" className={btn} onClick={() => onSelectHouse(h.id)}>
              <span
                aria-hidden
                className="mr-2 inline-block h-3 w-3 rounded-full"
                style={{ background: h.color }}
              />
              {h.title} <span className="ml-2 text-xs text-zinc-500">{countOf(h.id)} Objekte</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { PanelBody, PanelFooter } from "@/components/ui/panel";
import { hostOf, ITEM_TYPE_LABELS } from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact } from "@/lib/types";
import { KIND_COLORS } from "../../village/colors";
import { CopyControl, ItemMeta, openHref, useItemExtras } from "../item-extras";
import { chipBtn, dangerBtn, PreviewTile, primaryBtn, Rows, shortDate } from "./shared";

/**
 * Tafel «Objekt»: Vorschau aus dem Link (README, Code), Beschreibung, Angaben (Info-Menge «ausführlich»),
 * Herkunft und Zahlen. Besitzer: Öffnen, Bearbeiten, Löschen (mit Rückgängig). Besucher: Öffnen und «In mein
 * Dorf» mit Hausvorschlag (gleiches Modul).
 */
export function ObjectDetail({
  artifact,
  preview,
  isOwner,
  onEdit,
  onDelete,
}: {
  artifact: Artifact;
  preview: ReactNode;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const x = useItemExtras();
  const opened = x.stats[artifact.id]?.geoeffnet ?? 0;
  const rows: { k: string; v: ReactNode; dot?: string }[] = [
    { k: "Kategorie", v: ARTIFACT_KIND_LABELS[artifact.kind], dot: KIND_COLORS[artifact.kind] },
    { k: "Sichtbar für", v: artifact.visibility === "private" ? "Nur ich" : "Freunde" },
    ...(isOwner
      ? [{ k: "Geöffnet", v: opened === 0 ? "noch nie" : `von ${opened} Personen` }]
      : []),
    { k: "Typ", v: ITEM_TYPE_LABELS[artifact.item_type] },
    { k: "Link", v: <span className="hd-mono truncate text-[12px]">{hostOf(artifact.url)}</span> },
    { k: "Hinzugefügt", v: shortDate(artifact.created_at) },
    ...(isOwner && !artifact.is_copy
      ? [{ k: "Übernehmen", v: artifact.allow_copy === false ? "gesperrt" : "erlaubt" }]
      : []),
  ];
  return (
    <>
      <PanelBody className="!gap-2.5">
        {preview ? (
          <div className="max-h-56 overflow-auto rounded-hd-ctl bg-hd-raised p-3 text-[13px]">
            {preview}
          </div>
        ) : (
          <div className="overflow-hidden rounded-hd-ctl">
            <PreviewTile
              kind={artifact.kind}
              itemType={artifact.item_type}
              height={120}
              label="Vorschau aus Link"
            />
          </div>
        )}
        {artifact.description && (
          <p className="text-[13.5px] leading-normal text-hd-ink-2">{artifact.description}</p>
        )}
        <Rows rows={rows} />
        <ItemMeta artifact={artifact} />
        {!isOwner && <CopyControl artifact={artifact} hotkey />}
      </PanelBody>
      <PanelFooter line={false}>
        <a
          href={openHref(artifact)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${primaryBtn} flex-1`}
        >
          Öffnen
        </a>
        {isOwner && (
          <>
            <button type="button" onClick={onEdit} className={chipBtn}>
              {artifact.is_copy ? "Eigene Version" : "Bearbeiten"}
            </button>
            <button type="button" onClick={onDelete} className={dangerBtn}>
              Löschen
            </button>
          </>
        )}
      </PanelFooter>
    </>
  );
}

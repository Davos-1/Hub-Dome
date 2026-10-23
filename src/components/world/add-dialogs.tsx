"use client";

import { useEffect, type ReactNode } from "react";
import {
  createArtifact,
  deleteArtifact,
  deleteHouse,
  updateArtifact,
  updateHouse,
} from "@/app/dorf/actions";
import { ArtifactForm } from "@/components/list/artifact-form";
import { HouseCreateForm } from "@/components/list/house-create-form";
import { HouseFields } from "@/components/list/house-fields";
import { ActionForm, dangerButton } from "@/components/ui/action-form";
import type { ActionState, Artifact, House, ModuleOption } from "@/lib/types";
import { DialogShell } from "./dialog-shell";

/** Karte mit Hinweis und Löschknopf am Ende der Bearbeiten-Dialoge. */
function DeleteCard({
  note,
  action,
  id,
  submitLabel,
  confirm,
  onSuccess,
}: {
  note: ReactNode;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  submitLabel: string;
  confirm: string;
  onSuccess: () => void;
}) {
  return (
    <div className="hd-card flex items-center justify-between gap-3">
      <span className="hd-note">{note}</span>
      <ActionForm
        action={action}
        submitLabel={submitLabel}
        confirm={confirm}
        buttonClassName={dangerButton}
        className=""
        onSuccess={onSuccess}
      >
        <input type="hidden" name="id" value={id} />
      </ActionForm>
    </div>
  );
}

/** Objekt direkt aus der 3D-Welt anlegen (z.B. vom Baustellenschild oder aus dem Haus-Fenster). */
export function AddObjectDialog({
  houses,
  houseId,
  lowDetail,
  onClose,
}: {
  houses: { id: string; title: string }[];
  houseId: string | null;
  lowDetail: boolean;
  onClose: () => void;
}) {
  const target = houses.find((h) => h.id === houseId) ?? houses[0];
  return (
    <DialogShell
      title="Objekt hinzufügen"
      kicker="Hub Dome · Neu"
      icon="objekt"
      subtitle={target ? `In «${target.title}»` : undefined}
      onClose={onClose}
      lowDetail={lowDetail}
    >
      {target ? (
        <ArtifactForm
          action={createArtifact}
          houses={houses}
          defaultHouseId={target.id}
          submitLabel="Objekt speichern"
          onSuccess={onClose}
        />
      ) : (
        <p className="text-sm">Lege zuerst ein Haus an.</p>
      )}
    </DialogShell>
  );
}

/** Objekt bearbeiten, in ein anderes Haus verschieben oder löschen. */
export function EditObjectDialog({
  artifact,
  houses,
  lowDetail,
  onClose,
}: {
  artifact: Artifact | undefined;
  houses: { id: string; title: string }[];
  lowDetail: boolean;
  onClose: () => void;
}) {
  // Gibt es das Objekt nicht (mehr), z.B. nach dem Löschen, schliesst sich der Dialog
  useEffect(() => {
    if (!artifact) onClose();
  }, [artifact, onClose]);
  if (!artifact) return null;
  return (
    <DialogShell
      title="Objekt bearbeiten"
      kicker="Hub Dome · Objekt"
      icon="bearbeiten"
      subtitle={artifact.title}
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-5">
        <ArtifactForm
          action={updateArtifact}
          artifact={artifact}
          houses={houses}
          submitLabel="Speichern"
          onSuccess={onClose}
        />
        <DeleteCard
          note="Das Objekt wird aus deinem Dorf entfernt."
          action={deleteArtifact}
          id={artifact.id}
          submitLabel="Löschen"
          confirm="Objekt wirklich löschen?"
          onSuccess={onClose}
        />
      </div>
    </DialogShell>
  );
}

/** Neues Modul- oder Themenhaus anlegen. */
export function AddHouseDialog({
  modules,
  lowDetail,
  onClose,
}: {
  modules: ModuleOption[];
  lowDetail: boolean;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title="Haus anlegen"
      kicker="Hub Dome · Neu"
      icon="haus"
      subtitle="Ein Modul aus dem Katalog oder ein eigenes Thema."
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <HouseCreateForm modules={modules} onSuccess={onClose} />
    </DialogShell>
  );
}

/** Haus umbenennen, Farbe und Semester ändern oder das Haus samt Objekten löschen. */
export function EditHouseDialog({
  house,
  objectCount,
  lowDetail,
  onClose,
}: {
  house: House | undefined;
  objectCount: number;
  lowDetail: boolean;
  onClose: () => void;
}) {
  // Gibt es das Haus nicht (mehr), z.B. nach dem Löschen, schliesst sich der Dialog
  useEffect(() => {
    if (!house) onClose();
  }, [house, onClose]);
  if (!house) return null;
  const deleteNote =
    objectCount === 0
      ? "Das leere Haus wird entfernt."
      : objectCount === 1
        ? "Das Objekt darin wird ebenfalls gelöscht."
        : `Alle ${objectCount} Objekte darin werden ebenfalls gelöscht.`;
  return (
    <DialogShell
      title="Haus bearbeiten"
      kicker="Hub Dome · Haus"
      icon="bearbeiten"
      subtitle={house.title}
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-5">
        <ActionForm
          action={updateHouse}
          submitLabel="Speichern"
          successText="Gespeichert."
          onSuccess={onClose}
        >
          <input type="hidden" name="id" value={house.id} />
          <label htmlFor="edit-house-title" className="hd-label">
            Titel
          </label>
          <input
            id="edit-house-title"
            name="title"
            required
            maxLength={80}
            defaultValue={house.title}
            className="hd-input"
          />
          <HouseFields semester={house.semester} color={house.color} />
        </ActionForm>
        <DeleteCard
          note={deleteNote}
          action={deleteHouse}
          id={house.id}
          submitLabel="Haus löschen"
          confirm={`Haus «${house.title}» löschen? ${deleteNote}`}
          onSuccess={onClose}
        />
      </div>
    </DialogShell>
  );
}

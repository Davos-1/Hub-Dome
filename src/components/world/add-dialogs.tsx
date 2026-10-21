"use client";

import Link from "next/link";
import { createArtifact } from "@/app/dorf/actions";
import { ArtifactForm } from "@/components/list/artifact-form";
import { HouseCreateForm } from "@/components/list/house-create-form";
import type { ModuleOption } from "@/lib/types";
import { DialogShell, dlgLink } from "./dialog-shell";

/** Objekt direkt aus der 3D-Welt anlegen (z.B. vom Baustellenschild oder aus dem Haus-Fenster). */
export function AddObjectDialog({
  houses,
  houseId,
  ownerUsername,
  lowDetail,
  onClose,
}: {
  houses: { id: string; title: string }[];
  houseId: string | null;
  ownerUsername: string;
  lowDetail: boolean;
  onClose: () => void;
}) {
  const target = houses.find((h) => h.id === houseId) ?? houses[0];
  return (
    <DialogShell
      title="Objekt hinzufügen"
      subtitle={target ? `In «${target.title}»` : undefined}
      onClose={onClose}
      lowDetail={lowDetail}
    >
      {target ? (
        <div className="flex flex-col gap-4">
          <ArtifactForm
            action={createArtifact}
            houses={houses}
            defaultHouseId={target.id}
            submitLabel="Objekt speichern"
            onSuccess={onClose}
          />
          <Link href={`/dorf/${ownerUsername}/liste#h-${target.id}`} className={dlgLink}>
            Lieber in der Listenansicht bearbeiten
          </Link>
        </div>
      ) : (
        <p className="text-sm">Lege zuerst ein Haus an.</p>
      )}
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
      subtitle="Ein Modul aus dem Katalog oder ein eigenes Thema."
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <HouseCreateForm modules={modules} onSuccess={onClose} />
    </DialogShell>
  );
}

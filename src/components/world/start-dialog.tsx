"use client";

import { signOut } from "@/app/doerfer/actions";
import type { ShellData } from "@/lib/shell-data";
import { DialogShell, dlgLink, dlgPrimary, dlgSecondary } from "./dialog-shell";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl bg-[#efeae0] px-4 py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[12.5px] text-[#6d6a63]">{label}</div>
    </div>
  );
}

/** Einstieg nach dem Login: die Welt lädt im Hintergrund, hier entscheidet man, wohin es geht. */
export function StartDialog({
  shell,
  village,
  isOwner,
  lowDetail,
  onEnter,
  onTravel,
  onSettings,
  onAddHouse,
}: {
  shell: ShellData;
  village: { name: string; houses: number; objects: number; fresh: number };
  isOwner: boolean;
  lowDetail: boolean;
  onEnter: () => void;
  onTravel: () => void;
  onSettings: () => void;
  onAddHouse: () => void;
}) {
  const others = shell.villages.filter((v) => !v.mine).length;
  return (
    <DialogShell
      title={`Willkommen zurück, ${shell.me.displayName}`}
      subtitle={`Dein Dorf «${village.name}» lädt gerade im Hintergrund.`}
      onClose={onEnter}
      lowDetail={lowDetail}
      hideClose
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-3">
          <Stat value={village.houses} label={village.houses === 1 ? "Haus" : "Häuser"} />
          <Stat value={village.objects} label={village.objects === 1 ? "Objekt" : "Objekte"} />
          <Stat value={village.fresh} label="neu (7 Tage)" />
        </div>

        <div className="flex flex-col gap-2.5">
          <button type="button" data-autofocus onClick={onEnter} className={dlgPrimary}>
            Mein Dorf betreten
          </button>
          <button type="button" onClick={onTravel} className={dlgSecondary}>
            Dörfer besuchen
            {others > 0 && <span className="ml-2 text-[#6d6a63]">({others} mit dir geteilt)</span>}
          </button>
          <div className="flex gap-2.5">
            {isOwner && (
              <button type="button" onClick={onAddHouse} className={`${dlgSecondary} flex-1`}>
                Haus anlegen
              </button>
            )}
            <button type="button" onClick={onSettings} className={`${dlgSecondary} flex-1`}>
              Einstellungen
            </button>
          </div>
        </div>

        <p className="rounded-lg bg-[#fff8e1] px-3 py-2.5 text-[13px] text-[#6b4e00]">
          Teile keine Lösungen zu bewerteten Leistungsnachweisen.
        </p>

        <form action={signOut} className="flex justify-between text-[13px] text-[#6d6a63]">
          <span>Angemeldet als @{shell.me.username}</span>
          <button type="submit" className={dlgLink}>
            Abmelden
          </button>
        </form>
      </div>
    </DialogShell>
  );
}

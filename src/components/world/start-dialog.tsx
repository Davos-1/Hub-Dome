"use client";

import { signOut } from "@/app/doerfer/actions";
import type { ShellData } from "@/lib/shell-data";
import { DialogShell, dlgLink } from "./dialog-shell";

function Stat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="hd-card flex-1 !px-4 !py-3" style={{ borderTop: `5px solid ${accent}` }}>
      <div className="text-[26px] leading-none font-bold">{value}</div>
      <div className="hd-note mt-1">{label}</div>
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
  onFriends,
  onSettings,
  onAddHouse,
}: {
  shell: ShellData;
  village: { name: string; houses: number; objects: number; fresh: number };
  isOwner: boolean;
  lowDetail: boolean;
  onEnter: () => void;
  onTravel: () => void;
  onFriends: () => void;
  onSettings: () => void;
  onAddHouse: () => void;
}) {
  const friends = shell.friends.filter((f) => f.status === "freund").length;
  const requests = shell.friends.filter((f) => f.status === "eingehend").length;
  return (
    <DialogShell
      title={`Willkommen zurück, ${shell.me.displayName}`}
      kicker="Hub Dome"
      icon="start"
      subtitle={`Dein Dorf «${village.name}» lädt gerade im Hintergrund.`}
      onClose={onEnter}
      lowDetail={lowDetail}
      hideClose
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-3">
          <Stat
            value={village.houses}
            label={village.houses === 1 ? "Haus" : "Häuser"}
            accent="#8fb3ff"
          />
          <Stat
            value={village.objects}
            label={village.objects === 1 ? "Objekt" : "Objekte"}
            accent="#10b981"
          />
          <Stat value={village.fresh} label="neu (7 Tage)" accent="var(--hd-highlight)" />
        </div>

        {requests > 0 && (
          <button
            type="button"
            onClick={onFriends}
            className="flex cursor-pointer items-center justify-between rounded-xl border-2 border-hd-highlight bg-hd-new px-4 py-3 text-left text-[14px] font-bold"
          >
            <span>
              {requests === 1
                ? "1 neue Freundschaftsanfrage"
                : `${requests} neue Freundschaftsanfragen`}
            </span>
            <span className="text-hd-accent underline">Ansehen</span>
          </button>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-autofocus
            onClick={onEnter}
            className="hd-btn hd-btn-primary !py-3 !text-[15px]"
          >
            Mein Dorf betreten
          </button>
          <button type="button" onClick={onTravel} className="hd-btn hd-btn-ghost">
            Reise und Freunde
            {friends > 0 && (
              <span className="hd-note">
                ({friends} {friends === 1 ? "Freund" : "Freunde"})
              </span>
            )}
          </button>
          <div className="flex gap-2.5">
            {isOwner && (
              <button type="button" onClick={onAddHouse} className="hd-btn hd-btn-ghost flex-1">
                Haus anlegen
              </button>
            )}
            <button type="button" onClick={onSettings} className="hd-btn hd-btn-ghost flex-1">
              Einstellungen
            </button>
          </div>
        </div>

        <p className="rounded-xl bg-hd-new px-3.5 py-2.5 text-[13px] text-hd-new-ink">
          Teile keine Lösungen zu bewerteten Leistungsnachweisen.
        </p>

        <form action={signOut} className="hd-note flex justify-between">
          <span>Angemeldet als @{shell.me.username}</span>
          <button type="submit" className={dlgLink}>
            Abmelden
          </button>
        </form>
      </div>
    </DialogShell>
  );
}

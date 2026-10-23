"use client";

import { formatDate } from "@/components/ui/date-format";
import type { ShellData, ShellVillage } from "@/lib/shell-data";

function travelLabel(v: ShellVillage, current: boolean, traveling: boolean): string {
  if (current) return "Hier";
  if (traveling) return "Reise…";
  return v.mine ? "Heimreise" : "Besuchen";
}

function VillageCard({
  v,
  current,
  traveling,
  onGo,
}: {
  v: ShellVillage;
  current: boolean;
  traveling: boolean;
  onGo: () => void;
}) {
  return (
    <li className="hd-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-[16px] font-bold">{v.name}</div>
        <div className="hd-note">
          {v.mine ? "Dein Dorf" : `von ${v.ownerName} (@${v.ownerUsername})`} · {v.houseCount}{" "}
          Häuser · {v.objectCount} Objekte
          {v.last && ` · zuletzt ${formatDate(v.last)}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onGo}
        disabled={traveling}
        className="hd-btn hd-btn-primary flex-none"
      >
        {travelLabel(v, current, traveling)}
      </button>
    </li>
  );
}

/** Tab «Dörfer»: eigene Dörfer und die der Freunde, mit Reise-Knopf. */
export function VillagesTab({
  shell,
  currentUsername,
  onTravel,
  pending,
  onFriends,
}: {
  shell: ShellData;
  currentUsername: string;
  onTravel: (username: string) => void;
  pending: boolean;
  onFriends: () => void;
}) {
  const mine = shell.villages.filter((v) => v.mine);
  const shared = shell.villages.filter((v) => !v.mine);

  function cards(villages: ShellVillage[]) {
    return villages.map((v) => (
      <VillageCard
        key={v.id}
        v={v}
        current={v.ownerUsername === currentUsername}
        traveling={pending}
        onGo={() => onTravel(v.ownerUsername)}
      />
    ));
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">{cards(mine)}</ul>
      <section className="flex flex-col gap-2.5">
        <h3 className="hd-label">Dörfer deiner Freunde</h3>
        {shared.length === 0 ? (
          <p className="hd-card hd-note">
            Noch keine Freunde. Sende im Tab{" "}
            <button
              type="button"
              onClick={onFriends}
              className="font-semibold text-[#2f5d4a] underline"
            >
              Freunde
            </button>{" "}
            eine Anfrage; sobald sie angenommen wird, siehst du das Dorf hier.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">{cards(shared)}</ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { leaveVillage } from "@/app/doerfer/actions";
import { ActionForm } from "@/components/ui/action-form";
import type { ShellData, ShellVillage } from "@/lib/shell-data";
import { DialogShell, dlgSecondary } from "./dialog-shell";

const fmt = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

/** Aus einem eingefügten Einladungslink (oder nur dem Code) den Token holen. */
export function inviteTokenFrom(input: string): string | null {
  const t = input.trim().split(/[/?#]/).filter(Boolean).at(-1) ?? "";
  return /^[A-Za-z0-9_-]{16,}$/.test(t) ? t : null;
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
    <li className="flex flex-col gap-2 rounded-xl border border-[#e2ddd2] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold">{v.name}</div>
          <div className="text-[13px] text-[#6d6a63]">
            {v.mine ? "Dein Dorf" : `von ${v.ownerName} (@${v.ownerUsername})`} · {v.houseCount}{" "}
            Häuser · {v.objectCount} Objekte
            {v.last && ` · zuletzt ${fmt.format(new Date(v.last))}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onGo}
          disabled={traveling}
          className="flex-none cursor-pointer rounded-lg bg-[#2f5d4a] px-3.5 py-2 text-[13px] font-semibold text-[#fffdf8] hover:bg-[#274d3e] disabled:opacity-60"
        >
          {current ? "Hier" : traveling ? "Reise…" : v.mine ? "Heimreise" : "Besuchen"}
        </button>
      </div>
      {!v.mine && (
        <ActionForm
          action={leaveVillage}
          submitLabel="Dorf verlassen"
          confirm={`Dorf «${v.name}» verlassen? Du verlierst den Zugriff, bis du erneut eingeladen wirst.`}
          buttonClassName="cursor-pointer text-[12.5px] text-[#6d6a63] underline"
          className="self-start"
        >
          <input type="hidden" name="villageId" value={v.id} />
        </ActionForm>
      )}
    </li>
  );
}

/** Reise zu anderen Dörfern: eigenes zuoberst, darunter alle mit dir geteilten. */
export function TravelDialog({
  shell,
  currentUsername,
  lowDetail,
  onClose,
}: {
  shell: ShellData;
  currentUsername: string;
  lowDetail: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const go = (username: string) => {
    if (username === currentUsername) return onClose();
    setTarget(username);
    start(() => router.push(`/dorf/${username}`));
  };

  const mine = shell.villages.filter((v) => v.mine);
  const shared = shell.villages.filter((v) => !v.mine);

  return (
    <DialogShell
      title="Dörfer besuchen"
      subtitle="Dein Dorf und alle Dörfer, die mit dir geteilt wurden."
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-5" aria-busy={pending}>
        {pending && target && (
          <p role="status" className="rounded-lg bg-[#e6efe9] px-3 py-2 text-[13px] text-[#2f5d4a]">
            Reise nach @{target}…
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {mine.map((v) => (
            <VillageCard
              key={v.id}
              v={v}
              current={v.ownerUsername === currentUsername}
              traveling={pending}
              onGo={() => go(v.ownerUsername)}
            />
          ))}
        </ul>

        <section className="flex flex-col gap-2.5">
          <h3 className="text-[14px] font-semibold">Mit mir geteilt</h3>
          {shared.length === 0 ? (
            <p className="text-[13px] text-[#6d6a63]">
              Noch niemand hat sein Dorf mit dir geteilt. Füge unten einen Einladungslink ein, um
              ein Dorf zu besuchen.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shared.map((v) => (
                <VillageCard
                  key={v.id}
                  v={v}
                  current={v.ownerUsername === currentUsername}
                  traveling={pending}
                  onGo={() => go(v.ownerUsername)}
                />
              ))}
            </ul>
          )}
        </section>

        <form
          className="flex flex-col gap-2 border-t border-[#ebe6dc] pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const token = inviteTokenFrom(code);
            if (!token) return setCodeError("Das sieht nicht nach einem Einladungslink aus.");
            setCodeError(null);
            setTarget("Einladung");
            start(() => router.push(`/einladung/${token}`));
          }}
        >
          <label htmlFor="invite-code" className="text-[13px] font-semibold">
            Einladungslink einlösen
          </label>
          <div className="flex gap-2">
            <input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="https://…/einladung/…"
              className="w-full rounded-lg border border-[#d9d4c9] bg-white px-3 py-2 text-[14px] text-[#1c1b19]"
            />
            <button type="submit" className={dlgSecondary} disabled={pending}>
              Einlösen
            </button>
          </div>
          {codeError && (
            <p role="alert" className="text-[13px] text-red-700">
              {codeError}
            </p>
          )}
        </form>
      </div>
    </DialogShell>
  );
}

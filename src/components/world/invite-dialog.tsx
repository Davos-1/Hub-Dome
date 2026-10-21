"use client";

import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/einladung/[token]/actions";
import { ActionForm } from "@/components/ui/action-form";
import { DialogShell, dlgSecondary } from "./dialog-shell";

/** Einladungslink: Annehmen führt direkt in das Dorf der einladenden Person. */
export function InviteDialog({ token, lowDetail }: { token: string; lowDetail: boolean }) {
  const router = useRouter();
  return (
    <DialogShell
      title="Einladung in ein Dorf"
      subtitle="Mit dem Annehmen siehst du die geteilten Objekte."
      onClose={() => router.push("/start")}
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px]">
          Du wurdest eingeladen, ein Dorf in Hub Dome anzusehen. Dahinter siehst du dein eigenes
          Dorf; nach dem Annehmen reist du direkt zum eingeladenen Dorf.
        </p>
        <ActionForm
          action={acceptInvite}
          submitLabel="Einladung annehmen"
          pendingLabel="Nehme an…"
          buttonClassName="cursor-pointer rounded-lg bg-[#2f5d4a] px-4 py-2.5 text-[14px] font-semibold text-[#fffdf8] disabled:opacity-60"
        >
          <input type="hidden" name="token" value={token} />
        </ActionForm>
        <button type="button" onClick={() => router.push("/start")} className={dlgSecondary}>
          Später
        </button>
      </div>
    </DialogShell>
  );
}

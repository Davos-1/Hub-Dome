"use client";

import { useRouter } from "next/navigation";
import { acceptFriendLink } from "@/app/freunde/actions";
import { ActionForm } from "@/components/ui/action-form";
import { FRIEND_LINK_MESSAGES, type FriendLinkState } from "@/lib/friend-links";
import { DialogShell } from "./dialog-shell";

export type FriendLinkInfo = {
  token: string;
  state: FriendLinkState;
  username: string | null;
  displayName: string | null;
};

/** Freundschaftslink geöffnet: «@name möchte mit dir befreundet sein», Annehmen führt direkt ins Dorf. */
export function FriendLinkDialog({
  link,
  lowDetail,
}: {
  link: FriendLinkInfo;
  lowDetail: boolean;
}) {
  const router = useRouter();
  const who = link.displayName ? `${link.displayName} (@${link.username})` : "Diese Person";
  return (
    <DialogShell
      title={link.state === "ok" ? "Freundschaftsanfrage" : "Freundschaftslink"}
      kicker="Hub Dome · Freunde"
      icon="reise"
      subtitle={link.username ? `von @${link.username}` : undefined}
      onClose={() => router.push("/start")}
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-4">
        {link.state === "ok" ? (
          <>
            <p className="text-[14px]">
              <strong>{who}</strong> möchte mit dir befreundet sein. Nach dem Annehmen sehen sich
              beide gegenseitig die Dörfer (geteilte Objekte; private bleiben privat). Dahinter
              siehst du dein eigenes Dorf.
            </p>
            <ActionForm
              action={acceptFriendLink}
              submitLabel="Freundschaft annehmen"
              pendingLabel="Nehme an…"
              buttonClassName="hd-btn hd-btn-primary w-full"
            >
              <input type="hidden" name="token" value={link.token} />
            </ActionForm>
          </>
        ) : (
          <>
            <p role="alert" className="rounded-xl bg-[#fff3cf] p-3 text-[14px] text-[#6b4e00]">
              {FRIEND_LINK_MESSAGES[link.state as Exclude<FriendLinkState, "ok">]}
            </p>
            {link.state === "befreundet" && link.username && (
              <button
                type="button"
                className="hd-btn hd-btn-primary"
                onClick={() => router.push(`/dorf/${link.username}`)}
              >
                Zum Dorf von @{link.username}
              </button>
            )}
          </>
        )}
        <button type="button" onClick={() => router.push("/start")} className="hd-btn hd-btn-ghost">
          {link.state === "ok" ? "Später" : "Zu meinem Dorf"}
        </button>
      </div>
    </DialogShell>
  );
}

"use client";

import { createFriendLink, deleteFriendLink } from "@/app/freunde/actions";
import { ActionForm } from "@/components/ui/action-form";
import { formatDate } from "@/components/ui/date-format";
import { InviteResult } from "@/components/ui/invite-result";
import type { ShellLink } from "@/lib/shell-data";

/** Freundschaftslink: wer ihn erzeugt, stimmt der Freundschaft zu; die andere Person nimmt nur noch an. */
export function FriendLinkSection({ links }: { links: ShellLink[] }) {
  return (
    <section className="hd-card flex flex-col gap-2.5">
      <h3 className="hd-label">Freundschaftslink</h3>
      <p className="hd-note">
        Für Personen, die du direkt einladen willst, auch ohne Konto. Der Link gilt 7 Tage; wer ihn
        annimmt, ist sofort mit dir befreundet.
      </p>
      <ActionForm
        action={createFriendLink}
        submitLabel="Link erstellen"
        pendingLabel="Erstelle…"
        className="flex flex-col gap-2.5"
        rowClassName="flex flex-wrap items-end gap-2"
        buttonClassName="hd-btn hd-btn-primary"
        renderResult={(state) => (
          <InviteResult url={state.inviteUrl}>
            Kopiere den Link jetzt; er wird nur einmal angezeigt.
          </InviteResult>
        )}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="link-uses" className="hd-note">
            Wie viele Personen dürfen ihn nutzen?
          </label>
          <input
            id="link-uses"
            name="maxUses"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
            className="hd-input !w-28"
          />
        </div>
      </ActionForm>
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-[#e4d9c0] pt-2.5">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span>
                {l.uses}/{l.maxUses} genutzt · gültig bis {formatDate(l.expiresAt)}
              </span>
              <ActionForm
                action={deleteFriendLink}
                submitLabel="Widerrufen"
                buttonClassName="hd-btn hd-btn-danger hd-btn-sm"
                className=""
              >
                <input type="hidden" name="id" value={l.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

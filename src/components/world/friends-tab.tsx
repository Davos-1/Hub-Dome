"use client";

import {
  cancelFriendRequest,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from "@/app/freunde/actions";
import { ActionForm } from "@/components/ui/action-form";
import { formatDate } from "@/components/ui/date-format";
import type { ShellData, ShellFriend } from "@/lib/shell-data";
import type { ActionState } from "@/lib/types";
import { FriendLinkSection } from "./friend-link-section";

function PersonRow({ f, children }: { f: ShellFriend; children: React.ReactNode }) {
  return (
    <li className="hd-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold">{f.displayName}</div>
        <div className="hd-note">
          @{f.username} · {formatDate(f.since)}
        </div>
      </div>
      <div className="flex flex-none gap-2">{children}</div>
    </li>
  );
}

const TONE_CLASSES = {
  primary: "hd-btn-primary",
  ghost: "hd-btn-ghost",
  danger: "hd-btn-danger",
};

/** Kleiner Knopf in einer Personenzeile, der eine Server Action mit versteckten Feldern auslöst. */
function RowAction({
  action,
  label,
  tone,
  fields,
  confirm,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  tone: keyof typeof TONE_CLASSES;
  fields: Record<string, string>;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel={label}
      confirm={confirm}
      buttonClassName={`hd-btn hd-btn-sm ${TONE_CLASSES[tone]}`}
      className=""
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </ActionForm>
  );
}

/** Tab «Freunde»: Anfrage senden, Freundschaftslink, offene Anfragen und bestehende Freunde. */
export function FriendsTab({ shell }: { shell: ShellData }) {
  const incoming = shell.friends.filter((f) => f.status === "eingehend");
  const outgoing = shell.friends.filter((f) => f.status === "ausgehend");
  const friends = shell.friends.filter((f) => f.status === "freund");
  return (
    <div className="flex flex-col gap-6">
      <section className="hd-card flex flex-col gap-2.5">
        <h3 className="hd-label">Freund hinzufügen</h3>
        <p className="hd-note">
          Gib den Benutzernamen ein. Die Person muss die Anfrage annehmen; danach sehen sich beide
          gegenseitig die Dörfer.
        </p>
        <ActionForm
          action={sendFriendRequest}
          submitLabel="Anfrage senden"
          pendingLabel="Sende…"
          successText="Anfrage gesendet."
          className="flex flex-wrap items-start gap-2"
          buttonClassName="hd-btn hd-btn-primary"
        >
          <div className="min-w-[200px] flex-1">
            <label htmlFor="friend-username" className="sr-only">
              Benutzername
            </label>
            <input
              id="friend-username"
              name="username"
              required
              placeholder="@benutzername"
              autoCapitalize="none"
              autoComplete="off"
              className="hd-input"
            />
          </div>
        </ActionForm>
        <p className="hd-note">Dein Benutzername: @{shell.me.username}</p>
      </section>

      <FriendLinkSection links={shell.links} />

      {incoming.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="hd-label">Anfragen an dich ({incoming.length})</h3>
          <ul className="flex flex-col gap-2.5">
            {incoming.map((f) => (
              <PersonRow key={f.friendshipId} f={f}>
                <RowAction
                  action={respondFriendRequest}
                  label="Annehmen"
                  tone="primary"
                  fields={{ id: f.friendshipId, accept: "1" }}
                />
                <RowAction
                  action={respondFriendRequest}
                  label="Ablehnen"
                  tone="ghost"
                  fields={{ id: f.friendshipId, accept: "0" }}
                />
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="hd-label">Von dir gesendet</h3>
          <ul className="flex flex-col gap-2.5">
            {outgoing.map((f) => (
              <PersonRow key={f.friendshipId} f={f}>
                <span className="hd-note self-center">wartet auf Antwort</span>
                <RowAction
                  action={cancelFriendRequest}
                  label="Zurückziehen"
                  tone="ghost"
                  fields={{ id: f.friendshipId }}
                />
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h3 className="hd-label">Deine Freunde ({friends.length})</h3>
        {friends.length === 0 ? (
          <p className="hd-note">Noch keine Freunde.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {friends.map((f) => (
              <PersonRow key={f.friendshipId} f={f}>
                <RowAction
                  action={removeFriend}
                  label="Entfernen"
                  tone="danger"
                  confirm={`Freundschaft mit ${f.displayName} beenden? Ihr seht danach gegenseitig keine Dörfer mehr.`}
                  fields={{ otherId: f.otherId }}
                />
              </PersonRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

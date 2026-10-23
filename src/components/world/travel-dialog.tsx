"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  cancelFriendRequest,
  createFriendLink,
  deleteFriendLink,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from "@/app/freunde/actions";
import { ActionForm } from "@/components/ui/action-form";
import { CopyField } from "@/components/ui/copy-field";
import type { ActionState } from "@/lib/types";
import type { ShellData, ShellFriend, ShellLink, ShellVillage } from "@/lib/shell-data";
import { DialogShell } from "./dialog-shell";

const fmt = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

export const TRAVEL_TABS = [
  ["doerfer", "Dörfer"],
  ["freunde", "Freunde"],
] as const;
export type TravelTab = (typeof TRAVEL_TABS)[number][0];

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
          {v.last && ` · zuletzt ${fmt.format(new Date(v.last))}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onGo}
        disabled={traveling}
        className="hd-btn hd-btn-primary flex-none"
      >
        {current ? "Hier" : traveling ? "Reise…" : v.mine ? "Heimreise" : "Besuchen"}
      </button>
    </li>
  );
}

function VillagesTab({
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
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {mine.map((v) => (
          <VillageCard
            key={v.id}
            v={v}
            current={v.ownerUsername === currentUsername}
            traveling={pending}
            onGo={() => onTravel(v.ownerUsername)}
          />
        ))}
      </ul>
      <section className="flex flex-col gap-2.5">
        <h3 className="hd-label">Dörfer deiner Freunde</h3>
        {shared.length === 0 ? (
          <p className="hd-card hd-note">
            Noch keine Freunde. Sende im Tab{" "}
            <button
              type="button"
              onClick={onFriends}
              className="font-semibold text-hd-accent underline"
            >
              Freunde
            </button>{" "}
            eine Anfrage; sobald sie angenommen wird, siehst du das Dorf hier.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shared.map((v) => (
              <VillageCard
                key={v.id}
                v={v}
                current={v.ownerUsername === currentUsername}
                traveling={pending}
                onGo={() => onTravel(v.ownerUsername)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PersonRow({ f, children }: { f: ShellFriend; children: React.ReactNode }) {
  return (
    <li className="hd-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold">{f.displayName}</div>
        <div className="hd-note">
          @{f.username} · {fmt.format(new Date(f.since))}
        </div>
      </div>
      <div className="flex flex-none gap-2">{children}</div>
    </li>
  );
}

/** Freundschaftslink: wer ihn erzeugt, stimmt der Freundschaft zu; die andere Person nimmt nur noch an. */
function FriendLinkSection({ links }: { links: ShellLink[] }) {
  const [state, action, pending] = useActionState(createFriendLink, {} as ActionState);
  return (
    <section className="hd-card flex flex-col gap-2.5">
      <h3 className="hd-label">Freundschaftslink</h3>
      <p className="hd-note">
        Für Personen, die du direkt einladen willst, auch ohne Konto. Der Link gilt 7 Tage; wer ihn
        annimmt, ist sofort mit dir befreundet.
      </p>
      <form action={action} className="flex flex-wrap items-end gap-2">
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
        <button type="submit" disabled={pending} className="hd-btn hd-btn-primary">
          {pending ? "Erstelle…" : "Link erstellen"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="hd-error">
          {state.error}
        </p>
      )}
      {state.inviteUrl && (
        <div className="flex flex-col gap-1">
          <CopyField value={state.inviteUrl} />
          <p className="hd-note">Kopiere den Link jetzt; er wird nur einmal angezeigt.</p>
        </div>
      )}
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-hd-line pt-2.5">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span>
                {l.uses}/{l.maxUses} genutzt · gültig bis {fmt.format(new Date(l.expiresAt))}
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

function FriendsTab({ shell }: { shell: ShellData }) {
  const incoming = shell.friends.filter((f) => f.status === "eingehend");
  const outgoing = shell.friends.filter((f) => f.status === "ausgehend");
  const friends = shell.friends.filter((f) => f.status === "freund");
  const small = "hd-btn hd-btn-sm";
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
                <ActionForm
                  action={respondFriendRequest}
                  submitLabel="Annehmen"
                  buttonClassName={`${small} hd-btn-primary`}
                  className=""
                >
                  <input type="hidden" name="id" value={f.friendshipId} />
                  <input type="hidden" name="accept" value="1" />
                </ActionForm>
                <ActionForm
                  action={respondFriendRequest}
                  submitLabel="Ablehnen"
                  buttonClassName={`${small} hd-btn-ghost`}
                  className=""
                >
                  <input type="hidden" name="id" value={f.friendshipId} />
                  <input type="hidden" name="accept" value="0" />
                </ActionForm>
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
                <ActionForm
                  action={cancelFriendRequest}
                  submitLabel="Zurückziehen"
                  buttonClassName={`${small} hd-btn-ghost`}
                  className=""
                >
                  <input type="hidden" name="id" value={f.friendshipId} />
                </ActionForm>
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
                <ActionForm
                  action={removeFriend}
                  submitLabel="Entfernen"
                  confirm={`Freundschaft mit ${f.displayName} beenden? Ihr seht danach gegenseitig keine Dörfer mehr.`}
                  buttonClassName={`${small} hd-btn-danger`}
                  className=""
                >
                  <input type="hidden" name="otherId" value={f.otherId} />
                </ActionForm>
              </PersonRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Reise und Freunde: Dörfer besuchen, Freundschaftsanfragen senden, annehmen und beenden. */
export function TravelDialog({
  shell,
  currentUsername,
  tab,
  onTab,
  lowDetail,
  onClose,
}: {
  shell: ShellData;
  currentUsername: string;
  tab: string | null;
  onTab: (t: TravelTab) => void;
  lowDetail: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const current: TravelTab = tab === "freunde" ? "freunde" : "doerfer";
  const requests = shell.friends.filter((f) => f.status === "eingehend").length;

  const go = (username: string) => {
    if (username === currentUsername) return onClose();
    setTarget(username);
    start(() => router.push(`/dorf/${username}`));
  };

  return (
    <DialogShell
      title="Reise und Freunde"
      kicker="Hub Dome · Reise"
      icon="reise"
      subtitle="Besuche die Dörfer deiner Freunde."
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-5" aria-busy={pending}>
        <div
          role="tablist"
          aria-label="Reise und Freunde"
          className="flex gap-0.5 rounded-xl bg-hd-sunken p-[3px]"
        >
          {TRAVEL_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={current === id}
              onClick={() => onTab(id)}
              className={`flex-1 cursor-pointer rounded-[9px] px-2 py-2 text-[13px] font-bold ${
                current === id
                  ? "bg-hd-selected text-hd-selected-ink"
                  : "text-hd-ink-2 hover:bg-hd-line"
              }`}
            >
              {label}
              {id === "freunde" && requests > 0 && (
                <span className="ml-1.5 rounded-full bg-hd-highlight px-1.5 py-0.5 text-[11px] text-hd-highlight-ink">
                  {requests}
                </span>
              )}
            </button>
          ))}
        </div>

        {pending && target && (
          <p
            role="status"
            className="rounded-lg bg-hd-accent-soft px-3 py-2 text-[13px] text-hd-accent"
          >
            Reise nach @{target}…
          </p>
        )}
        {current === "doerfer" ? (
          <VillagesTab
            shell={shell}
            currentUsername={currentUsername}
            onTravel={go}
            pending={pending}
            onFriends={() => onTab("freunde")}
          />
        ) : (
          <FriendsTab shell={shell} />
        )}
      </div>
    </DialogShell>
  );
}

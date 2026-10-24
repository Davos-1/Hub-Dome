"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  cancelFriendRequest,
  createFriendLink,
  deleteFriendLink,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from "@/app/freunde/actions";
import { Stepper } from "@/components/ui/controls";
import { CopyField } from "@/components/ui/copy-field";
import { Panel, PanelBody, PanelFooter } from "@/components/ui/panel";
import { useViewport } from "@/components/village/hud/use-viewport";
import { FRIEND_LINK_DAYS } from "@/lib/friend-links";
import type { ShellData, ShellFriend, ShellLink, ShellVillage } from "@/lib/shell-data";
import { activityOf, islandColor, layoutIslands, type PlacedIsland } from "@/lib/travel-layout";
import type { ActionState } from "@/lib/types";

/**
 * «Reise» als Inselkarte (Phase 4h, Prototyp 11c): das eigene Dorf in der Mitte, die Dörfer der Freunde als
 * Inseln darum, je näher, desto aktiver (letzte Änderung). Inseln werden kollisionsfrei verteilt. Dazu
 * Anfragen, Freund einladen und Freundschaftslink. Esc und Schliessen verwaltet der Aufrufer; das Reisen
 * selbst (Navigation, Ladeanzeige) ebenfalls (`onTravel`).
 */

const idle: ActionState = {};
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const DATE = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

/* Meer und Land sind Illustrationsfarben (keine UI-Farben): dunkles Petrol aus dem Akzent, Land in Grün. */
const SEA =
  "radial-gradient(ellipse at 50% 55%, color-mix(in srgb, var(--hd-accent) 45%, #0b1416) 0%, #0e1d20 55%, #0a1214 100%)";
const LAND = "radial-gradient(circle at 40% 40%, #35503f, #25352c)";
/** Lage der kleinen Häuser auf einer Insel (links, oben). */
const MINI_HOUSES = [
  ["28%", "36%"],
  ["46%", "54%"],
  ["60%", "30%"],
] as const;

const nHouses = (n: number) => `${n} ${n === 1 ? "Haus" : "Häuser"}`;
const nObjects = (n: number) => `${n} ${n === 1 ? "Objekt" : "Objekte"}`;
const stop = (e: MouseEvent) => e.stopPropagation();

/* ------------------------------------------------------------------------------------ Bausteine */

/** Fokus beim Öffnen in die Karte, beim Schliessen zurück zum Auslöser. */
function useFocusScope(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, [ref]);
}

/** Tab-Taste bleibt in der Karte (die Welt darunter ist nur Kulisse). */
function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== "Tab" || !root) return;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (n) => n.offsetParent !== null,
  );
  if (nodes.length === 0) {
    e.preventDefault();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Knopf mit Server Action mitten in einer Zeile. Das Formular ist unsichtbar (`contents`), ein Fehler
 * bricht auf eine eigene Zeile über die volle Breite um (die Zeile ist ein `flex-wrap`).
 */
function RowAction({
  action,
  fields,
  label,
  pendingLabel = "…",
  confirm,
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  /** Wenn gesetzt, wird vor dem Absenden nachgefragt. */
  confirm?: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  return (
    <form
      action={formAction}
      className="contents"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p role="alert" className="hd-error order-last w-full basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Zeile einer Person: Initiale, Name, @Benutzername, rechts die Knöpfe. */
function PersonRow({
  f,
  second,
  children,
}: {
  f: ShellFriend;
  second?: string;
  children: ReactNode;
}) {
  const initial = Array.from(f.displayName.trim())[0]?.toUpperCase() ?? "?";
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-hd-ctl bg-hd-raised p-2">
      <span
        aria-hidden
        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-hd-chip text-[12px] font-bold"
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{f.displayName}</span>
        <span className="hd-mono block truncate text-[11px] text-hd-muted">
          @{f.username}
          {second && ` · ${second}`}
        </span>
      </span>
      {children}
    </li>
  );
}

/** Karte unten links: Anfragen an dich (annehmen oder ablehnen) und eigene offene Anfragen. */
function RequestsCard({ shell }: { shell: ShellData }) {
  const incoming = shell.friends.filter((f) => f.status === "eingehend");
  const outgoing = shell.friends.filter((f) => f.status === "ausgehend");
  return (
    <section
      aria-label="Freundschaftsanfragen"
      onClick={stop}
      className="absolute bottom-[18px] left-[18px] flex max-h-[44%] w-[330px] max-w-[calc(100%-36px)] flex-col gap-2 overflow-y-auto rounded-hd-panel border border-hd-line bg-hd-surface p-3.5"
    >
      <h3 className="hd-kicker">Anfragen an dich · {incoming.length}</h3>
      {incoming.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {incoming.map((f) => (
            <PersonRow key={f.friendshipId} f={f}>
              <RowAction
                action={respondFriendRequest}
                fields={{ id: f.friendshipId, accept: "1" }}
                label="Annehmen"
                className="hd-btn hd-btn-primary hd-btn-sm"
              />
              <RowAction
                action={respondFriendRequest}
                fields={{ id: f.friendshipId, accept: "0" }}
                label="Ablehnen"
                className="hd-btn hd-btn-sm text-hd-muted"
              />
            </PersonRow>
          ))}
        </ul>
      )}
      {outgoing.length > 0 && (
        <>
          <h3 className="hd-kicker mt-1">Von dir gesendet · {outgoing.length}</h3>
          <ul className="flex flex-col gap-1.5">
            {outgoing.map((f) => (
              <PersonRow key={f.friendshipId} f={f} second="wartet auf Antwort">
                <RowAction
                  action={cancelFriendRequest}
                  fields={{ id: f.friendshipId }}
                  label="Zurückziehen"
                  className="hd-btn hd-btn-sm text-hd-muted"
                />
              </PersonRow>
            ))}
          </ul>
        </>
      )}
      {incoming.length === 0 && outgoing.length === 0 && (
        <p className="text-[12.5px] text-hd-muted">Keine offenen Anfragen.</p>
      )}
    </section>
  );
}

/** Freundschaftsanfrage per Benutzername. */
function AddFriendForm({ fieldId }: { fieldId: string }) {
  const [state, action, pending] = useActionState(sendFriendRequest, idle);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <label htmlFor={fieldId} className="sr-only">
          Benutzername der Person
        </label>
        <input
          id={fieldId}
          name="username"
          required
          placeholder="@benutzername"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className="hd-input min-w-0 flex-1 !px-2.5 !py-2 !text-[13px]"
        />
        <button type="submit" disabled={pending} className="hd-btn hd-btn-primary !px-3 !py-2">
          {pending ? "Sende…" : "Senden"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="hd-error">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="hd-ok">
          Anfrage gesendet.
        </p>
      )}
    </form>
  );
}

/** Freundschaftslink: Anzahl Personen, einmal sichtbarer Link und die eigenen aktiven Links. */
function FriendLinkForm({ links }: { links: ShellLink[] }) {
  const [state, action, pending] = useActionState(createFriendLink, idle);
  const [uses, setUses] = useState(1);
  return (
    <>
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="maxUses" value={uses} />
        <Stepper label="Anzahl Personen" value={uses} min={1} max={100} onChange={setUses} />
        <span className="min-w-0 flex-1 text-[12px] text-hd-muted">
          {uses === 1 ? "1 Person" : `${uses} Personen`} · {FRIEND_LINK_DAYS} Tage
        </span>
        <button
          type="submit"
          disabled={pending}
          className="hd-btn hd-btn-ghost whitespace-nowrap !px-3 !py-2"
        >
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
          <p className="text-[12px] text-hd-muted">
            Kopiere den Link jetzt; er wird nur einmal angezeigt.
          </p>
        </div>
      )}
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-hd-line pt-2">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
              <span className="min-w-0 flex-1 text-hd-ink-2">
                {l.uses}/{l.maxUses} genutzt · gültig bis {DATE.format(new Date(l.expiresAt))}
              </span>
              <RowAction
                action={deleteFriendLink}
                fields={{ id: l.id }}
                label="Widerrufen"
                className="hd-btn hd-btn-danger hd-btn-sm"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Eine Insel: Land mit kleinen Häusern in der Datenfarbe des Dorfs, darunter das Namensschild. */
function Island({
  p,
  village,
  selected,
  onSelect,
}: {
  p: PlacedIsland;
  village: ShellVillage;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = islandColor(village.id);
  const h = Math.round(p.w * 0.72);
  const houses = Math.min(3, village.houseCount);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${village.mine ? "Dein Dorf" : "Dorf"} ${village.name}, ${nHouses(village.houseCount)}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hd-accent-line motion-safe:hover:scale-[1.04]"
      style={{ left: p.x, top: p.y }}
    >
      <span
        aria-hidden
        className={`relative block transition-shadow ${
          selected
            ? "border-2 border-hd-accent-line shadow-[0_0_0_7px_color-mix(in_srgb,var(--hd-accent-line)_22%,transparent)]"
            : village.mine
              ? "border-2 border-hd-accent"
              : "border border-hd-line-strong"
        }`}
        style={{
          width: p.w,
          height: h,
          borderRadius: "46% 54% 50% 50% / 55% 45% 55% 45%",
          background: LAND,
        }}
      >
        {MINI_HOUSES.slice(0, houses).map(([left, top]) => (
          <span
            key={left}
            className="absolute h-2 w-[11px] border-t-2 bg-hd-line-strong"
            style={{ left, top, borderTopColor: color }}
          />
        ))}
      </span>
      <span className="rounded-full border border-hd-line bg-hd-surface px-2.5 py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-hd-ink">
        {village.mine ? `${village.name} · du` : village.name}
      </span>
    </button>
  );
}

/* --------------------------------------------------------------------------------------- Karte */

export function TravelMap({
  shell,
  currentUsername,
  onClose,
  onTravel,
}: {
  shell: ShellData;
  /** Besitzer des Dorfs, das gerade gezeigt wird. */
  currentUsername: string;
  onClose: () => void;
  /** Navigiert nach `/dorf/<username>` (die Ladeanzeige zeigt der Aufrufer). */
  onTravel: (username: string) => void;
}) {
  const { width, height } = useViewport();
  const [now] = useState(() => Date.now());
  const [sel, setSel] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useFocusScope(root);
  const base = useId();
  const titleId = `${base}-title`;

  const mine = shell.villages.find((v) => v.mine) ?? null;
  const others = shell.villages.filter((v) => !v.mine);
  const lay = layoutIslands(
    others.map((v) => ({ id: v.id, houses: v.houseCount, act: activityOf(v.last, now) })),
    { width, height },
  );
  const spots = new Map(lay.islands.map((i) => [i.id, i]));
  if (mine) spots.set(mine.id, lay.own);

  const picked = sel ? (shell.villages.find((v) => v.id === sel) ?? null) : null;
  const pickedSpot = picked ? (spots.get(picked.id) ?? null) : null;
  const route =
    picked && !picked.mine && pickedSpot
      ? {
          len: Math.hypot(pickedSpot.x - lay.own.x, pickedSpot.y - lay.own.y),
          ang: (Math.atan2(pickedSpot.y - lay.own.y, pickedSpot.x - lay.own.x) * 180) / Math.PI,
        }
      : null;
  const friendOfPicked =
    picked && !picked.mine
      ? shell.friends.find((f) => f.status === "freund" && f.otherId === picked.ownerId)
      : undefined;

  const goLabel = !picked
    ? ""
    : picked.ownerUsername === currentUsername
      ? "Hier bleiben"
      : picked.mine
        ? "Heimreise"
        : "Hinreisen";

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(e) => trapTab(e, root.current)}
      onClick={() => setSel(null)}
      className="hd-fade-in pointer-events-auto absolute inset-0 z-30 overflow-hidden text-hd-ink outline-none"
      style={{ background: SEA }}
    >
      {/* Wellenringe um das eigene Dorf */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `repeating-radial-gradient(circle at ${lay.own.x}px ${lay.own.y}px, transparent 0 70px, color-mix(in srgb, var(--hd-accent-line) 9%, transparent) 70px 71px)`,
        }}
      />

      <div className="absolute top-4 left-5 flex items-baseline gap-3">
        <h2 id={titleId} className="text-[20px] font-bold">
          Reise
        </h2>
        <span className="text-[13px] text-hd-muted max-sm:hidden">
          Deine Freunde als Inseln, je näher, desto aktiver
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-keyshortcuts="Escape"
        className="absolute top-3.5 right-[18px] cursor-pointer rounded-hd-ctl border border-hd-line bg-hd-surface px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap hover:bg-hd-raised"
      >
        Zurück ins Dorf · Esc
      </button>

      {route && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-0 origin-top-left border-t-2 border-dashed border-hd-accent-line"
          style={{
            left: lay.own.x,
            top: lay.own.y,
            width: route.len,
            transform: `rotate(${route.ang}deg)`,
          }}
        />
      )}

      {mine && (
        <Island
          p={lay.own}
          village={mine}
          selected={sel === mine.id}
          onSelect={() => setSel(mine.id)}
        />
      )}
      {others.map((v) => {
        const p = spots.get(v.id);
        return p ? (
          <Island
            key={v.id}
            p={p}
            village={v}
            selected={sel === v.id}
            onSelect={() => setSel(v.id)}
          />
        ) : null;
      })}

      {others.length === 0 && (
        <p
          onClick={stop}
          className="absolute max-w-[320px] -translate-x-1/2 rounded-hd-panel border border-hd-line bg-hd-surface px-4 py-3 text-center text-[13px] text-hd-ink-2"
          style={{ left: lay.own.x, top: lay.own.y + lay.own.w * 0.36 + 56 }}
        >
          Noch keine Freunde. Lade jemanden mit Benutzername oder Link ein.
        </p>
      )}

      {picked && pickedSpot && (
        <div
          key={picked.id}
          onClick={stop}
          className="hd-rise absolute w-[240px]"
          style={{
            left: Math.max(8, Math.min(width - 260, pickedSpot.x + pickedSpot.w / 2 + 24)),
            top: Math.max(60, Math.min(height - 230, pickedSpot.y - 70)),
          }}
        >
          <Panel
            kicker={picked.mine ? "Dein Dorf" : `${picked.ownerName} · @${picked.ownerUsername}`}
            title={picked.name}
            titleSize={16}
            icon={picked.mine ? "⌂" : undefined}
            onClose={() => setSel(null)}
            closeLabel="Auswahl aufheben"
            scroll={false}
            className="w-full"
          >
            <PanelBody className="!gap-0.5 !pt-0">
              <span className="text-[12.5px] text-hd-muted">
                {nHouses(picked.houseCount)} · {nObjects(picked.objectCount)}
              </span>
              {picked.last && (
                <span className="text-[12px] text-hd-faint">
                  zuletzt {DATE.format(new Date(picked.last))}
                </span>
              )}
            </PanelBody>
            <PanelFooter line={false}>
              <button
                type="button"
                onClick={() =>
                  goLabel === "Hier bleiben" ? onClose() : onTravel(picked.ownerUsername)
                }
                className="hd-btn hd-btn-primary w-full"
              >
                {goLabel}
              </button>
              {friendOfPicked && (
                <RowAction
                  action={removeFriend}
                  fields={{ otherId: friendOfPicked.otherId }}
                  label="Freund entfernen"
                  pendingLabel="Entferne…"
                  confirm={`Freundschaft mit ${friendOfPicked.displayName} beenden? Ihr seht danach gegenseitig keine Dörfer mehr.`}
                  className="cursor-pointer text-[12px] font-semibold text-hd-danger underline-offset-2 hover:underline disabled:opacity-45"
                />
              )}
            </PanelFooter>
          </Panel>
        </div>
      )}

      <RequestsCard shell={shell} />

      <section
        aria-label="Freunde einladen"
        onClick={stop}
        className="absolute right-[18px] bottom-[18px] flex max-h-[calc(100%-96px)] w-[330px] max-w-[calc(100%-36px)] flex-col gap-2 overflow-y-auto rounded-hd-panel border border-hd-line bg-hd-surface p-3.5"
      >
        <h3 className="text-[13px] font-bold">Freund hinzufügen</h3>
        <AddFriendForm fieldId={`${base}-friend`} />
        <h3 className="mt-1.5 text-[13px] font-bold">Freundschaftslink</h3>
        <FriendLinkForm links={shell.links} />
      </section>
    </div>
  );
}

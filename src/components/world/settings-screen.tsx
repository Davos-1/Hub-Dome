"use client";

import dynamic from "next/dynamic";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { signOut } from "@/app/doerfer/actions";
import { setTopdorfAll } from "@/app/dorf/actions";
import {
  requestAccountDeletion,
  updateDisplayName,
  updateVillageStyle,
} from "@/app/einstellungen/actions";
import { createMcpToken, revokeMcpToken } from "@/app/einstellungen/claude-actions";
import { ActionForm } from "@/components/ui/action-form";
import { Segment } from "@/components/ui/controls";
import { CopyField } from "@/components/ui/copy-field";
import type { ShellData, ShellToken } from "@/lib/shell-data";
import { ZENTRALE_STYLES, ZENTRALE_STYLE_INFO, type ZentraleStyle } from "@/lib/styles";
import type { ActionState } from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { describeMap } from "@/lib/world/map";
import { GENERATOR_VERSION } from "@/lib/world/seed";
import { randomSeed } from "./world-settings";

/**
 * Einstellungen als Vollbild-Bereich (Phase 4h, Prototyp 10a): ein Blatt fährt von unten über die Welt, die
 * oben als Streifen stehen bleibt. Navigation links, gewählter Bereich rechts. Alle Funktionen des früheren
 * Dialogs (Profil, Landschaft, Stil der Zentrale, Topdorf, Claude-Connector, Konto löschen) bleiben erhalten;
 * neu ist die Tageszeit «Auto/Fest». Esc und Schliessen verwaltet der Aufrufer.
 */

export type SettingsScreenTab = "profil" | "dorf" | "claude" | "konto";

const TABS: { id: SettingsScreenTab; label: string; sub: string }[] = [
  { id: "profil", label: "Profil", sub: "Name, Abmelden" },
  { id: "dorf", label: "Dorf", sub: "Landschaft, Zentrale, Topdorf" },
  { id: "claude", label: "Claude", sub: "Connector und Skill" },
  { id: "konto", label: "Konto", sub: "Löschen, Datenschutz" },
];

type WorldProps = { model: VillageModel; isOwner: boolean; onPreview: (seed: string) => void };

const idle: ActionState = {};
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Karte im Inhaltsbereich (Prototyp: Fläche «raised», Linie, Ecken wie Tafeln). Ohne Rand- und Abstandsfarbe
 * getrennt, damit eine Karte (Konto löschen) eine andere Randfarbe bekommt, ohne dass zwei Klassen streiten.
 */
const BOX = "rounded-hd-panel border bg-hd-raised p-4";
const CARD = `${BOX} border-hd-line flex flex-col gap-2.5`;
const FMT = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

const StylePreview = dynamic(() => import("@/components/village/style-preview"), {
  ssr: false,
  loading: () => <p className="hd-note p-4">Vorschau wird geladen…</p>,
});

/** Fokus beim Öffnen ins Blatt, beim Schliessen zurück zum Auslöser. */
function useFocusScope(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, [ref]);
}

/** Tab-Taste bleibt im Blatt (die Welt darüber ist nur noch Kulisse). */
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

/* ----------------------------------------------------------------------------------------------- Profil */

function ProfilTab({ shell }: { shell: ShellData }) {
  return (
    <>
      <section className={`${CARD} max-w-[640px]`}>
        <label htmlFor="settings-display-name" className="text-[15px] font-bold">
          Anzeigename
        </label>
        <ActionForm
          action={updateDisplayName}
          submitLabel="Speichern"
          successText="Gespeichert."
          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 [&>p]:col-span-2"
          buttonClassName="hd-btn hd-btn-primary"
        >
          <input
            key={shell.me.displayName}
            id="settings-display-name"
            name="displayName"
            defaultValue={shell.me.displayName}
            required
            maxLength={60}
            autoComplete="name"
            className="hd-input"
          />
        </ActionForm>
        <p className="hd-note">Benutzername @{shell.me.username} · so finden dich Freunde</p>
      </section>
      <form action={signOut}>
        <button type="submit" className="hd-btn hd-btn-ghost">
          Abmelden
        </button>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ Dorf */

/** Landschaft des angezeigten Dorfs; «Welt neu würfeln» startet die Vorschau in der Szene. */
function LandscapeCard({ world }: { world: WorldProps }) {
  const w = world.model.world;
  if (!world.isOwner) {
    return (
      <section className={`${CARD} max-w-[820px]`}>
        <h3 className="text-[15px] font-bold">Landschaft</h3>
        <p className="hd-note">
          Du besuchst gerade ein anderes Dorf. Die Landschaft deines Dorfs änderst du in deinem
          eigenen Dorf.
        </p>
      </section>
    );
  }
  const outdated = w.version < GENERATOR_VERSION;
  return (
    <section
      className={`${BOX} flex max-w-[820px] flex-col gap-4 border-hd-line md:grid md:grid-cols-[200px_minmax(0,1fr)] md:items-center`}
    >
      {/* Platzhalter wie im Prototyp (die Karte selbst zeigt die Welt darüber) */}
      <span
        aria-hidden
        className="hd-hatch-world hd-mono flex h-[110px] items-center justify-center rounded-hd-ctl text-[9.5px] text-hd-faint"
      >
        KARTE
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-bold">Landschaft</h3>
        <p className="text-[13px] text-hd-ink-2">{describeMap(w.map)}</p>
        <span className="hd-mono text-[11px] text-hd-faint">
          Welt «{w.seed}» · Generator {w.version}
        </span>
        <p className="hd-note">
          Gelände, Wasser, Pflanzen und die Lage der Quartiere entstehen aus diesem Seed und bleiben
          gleich, bis du neu würfelst. Du siehst die neue Welt zuerst als Vorschau; deine eigene
          Deko bleibt, wenn sie in die neue Landschaft passt.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            className="hd-btn hd-btn-ghost hd-btn-sm"
            onClick={() => world.onPreview(randomSeed())}
          >
            Welt neu würfeln …
          </button>
          {outdated && (
            <button
              type="button"
              className="hd-btn hd-btn-primary hd-btn-sm"
              onClick={() => world.onPreview(w.seed)}
            >
              Auf neue Welt-Version aktualisieren …
            </button>
          )}
        </div>
        {outdated && (
          <p className="hd-note">
            Die neue Version bringt mehr Abwechslung: Flüsse durchs Dorf, Seen, Buchten und
            Hochplateaus, Mühlen, Kapellen und andere Fundstücke. Dein Seed bleibt, deine Häuser
            behalten ihre Plätze, wo es passt; du siehst alles zuerst als Vorschau.
          </p>
        )}
      </div>
    </section>
  );
}

/** Stil der Zentrale: sechs Karten (3 pro Reihe), live in 3D, gespeichert mit «Stil speichern». */
function StyleCard({ current }: { current: ZentraleStyle }) {
  const [style, setStyle] = useState<ZentraleStyle>(current);
  return (
    <section className={`${CARD} max-w-[820px]`}>
      <ActionForm
        action={updateVillageStyle}
        submitLabel="Stil speichern"
        successText="Gespeichert. Dein Dorf sieht jetzt anders aus."
        className="flex flex-col gap-3"
      >
        <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 text-[15px] font-bold">Stil der Zentrale</legend>
          <div
            role="img"
            aria-label={`3D-Vorschau der Zentrale im Stil ${ZENTRALE_STYLE_INFO[style].label}`}
            className="hd-frame hd-hatch-world h-56 overflow-hidden rounded-hd-ctl"
          >
            <StylePreview mode="zentrale" zentraleStyle={style} />
          </div>
          <p className="hd-note">Drehen mit der Maus, zoomen mit dem Mausrad.</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ZENTRALE_STYLES.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer flex-col gap-0.5 rounded-hd-panel border border-hd-line bg-hd-surface px-3 py-2.5 transition-colors hover:bg-hd-hover has-[:checked]:border-hd-accent-line has-[:checked]:bg-hd-accent-soft has-[:checked]:shadow-[0_0_0_1px_var(--hd-accent-line)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hd-accent-line"
              >
                <input
                  type="radio"
                  name="zentraleStyle"
                  value={s}
                  checked={style === s}
                  onChange={() => setStyle(s)}
                  className="sr-only"
                />
                <span className="text-[13px] font-bold">{ZENTRALE_STYLE_INFO[s].label}</span>
                <span className="text-[11.5px] text-hd-muted">
                  {ZENTRALE_STYLE_INFO[s].description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </ActionForm>
    </section>
  );
}

/** Topdorf (alle geteilten Objekte freigeben oder zurückziehen) und Tageszeit. */
function TopdorfTimeCard({
  hasOwn,
  timeMode,
  onTimeMode,
}: {
  hasOwn: boolean;
  timeMode: "auto" | "fest";
  onTimeMode: (m: "auto" | "fest") => void;
}) {
  return (
    <section className={`${BOX} flex max-w-[820px] flex-col gap-3 border-hd-line`}>
      {hasOwn && (
        <>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
            <div className="min-w-[220px] flex-1">
              <h3 className="text-[15px] font-bold">Topdorf</h3>
              <p className="text-[12.5px] text-hd-muted">
                Geteilte Objekte für alle Hub-Dome-Nutzer zeigen, mit deinem Namen.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <ActionForm
                action={setTopdorfAll}
                submitLabel="Alle freigeben"
                successText="Freigegeben."
                confirm="Alle deine geteilten Objekte fürs Topdorf freigeben?"
                className="flex flex-col items-start gap-1"
                buttonClassName="hd-btn hd-btn-ghost hd-btn-sm"
              >
                <input type="hidden" name="topdorf" value="an" />
              </ActionForm>
              <ActionForm
                action={setTopdorfAll}
                submitLabel="Alle zurückziehen"
                successText="Zurückgezogen."
                className="flex flex-col items-start gap-1"
                buttonClassName="hd-btn hd-btn-ghost hd-btn-sm"
              >
                <input type="hidden" name="topdorf" value="aus" />
              </ActionForm>
            </div>
          </div>
          <p className="hd-note">
            Im Topdorf erscheinen die meistgenutzten Objekte. Einzelne Objekte stellst du im
            Objektformular ein; Übernahmen und private Objekte sind nie dabei.
          </p>
          <span aria-hidden className="h-px bg-hd-line" />
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <div className="min-w-[220px] flex-1">
          <h3 className="text-[15px] font-bold">Tageszeit</h3>
          <p className="text-[12.5px] text-hd-muted">«Auto» folgt der Uhrzeit in Zürich.</p>
        </div>
        <Segment<"auto" | "fest">
          label="Tageszeit"
          tone="accent"
          value={timeMode}
          onPick={onTimeMode}
          options={[
            { value: "auto", label: "Auto" },
            { value: "fest", label: "Fest" },
          ]}
        />
      </div>
    </section>
  );
}

function DorfTab({
  shell,
  world,
  timeMode,
  onTimeMode,
}: {
  shell: ShellData;
  world: WorldProps;
  timeMode: "auto" | "fest";
  onTimeMode: (m: "auto" | "fest") => void;
}) {
  const own = shell.own;
  return (
    <>
      <LandscapeCard world={world} />
      {own ? (
        <StyleCard current={own.zentraleStyle} />
      ) : (
        <p className="hd-note">Dein Dorf wurde noch nicht angelegt.</p>
      )}
      <TopdorfTimeCard hasOwn={!!own} timeMode={timeMode} onTimeMode={onTimeMode} />
    </>
  );
}

/* ---------------------------------------------------------------------------------------------- Claude */

const STEPS = [
  "Oben ein Token erzeugen und die Connector-URL kopieren.",
  "In claude.ai: Einstellungen › Connectors › Eigenen Connector hinzufügen, URL einfügen.",
  "Skill herunterladen und in claude.ai unter Fähigkeiten hochladen.",
  "Ein Artifact erstellen. Claude fragt, in welches Haus es soll.",
];

function TokenCard({ tokens }: { tokens: ShellToken[] }) {
  const [state, action, pending] = useActionState(createMcpToken, idle);
  return (
    <section className={`${CARD} max-w-[720px]`}>
      <h3 className="text-[15px] font-bold">1. Token erzeugen</h3>
      <form action={action} className="flex gap-2">
        <label htmlFor="settings-token-label" className="sr-only">
          Name des Tokens (optional)
        </label>
        <input
          id="settings-token-label"
          name="label"
          maxLength={40}
          autoComplete="off"
          placeholder="Name, z.B. Laptop"
          className="hd-input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="hd-btn hd-btn-primary whitespace-nowrap"
        >
          {pending ? "Erstelle…" : "Token erzeugen"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="hd-error">
          {state.error}
        </p>
      )}
      {state.inviteUrl && (
        <div className="flex flex-col gap-1.5">
          <CopyField value={state.inviteUrl} />
          <span className="text-[12px] text-hd-muted">
            Nur jetzt sichtbar. Wer die URL kennt, kann in deinem Dorf Objekte platzieren.
          </span>
        </div>
      )}
      {tokens.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2.5 border-t border-hd-line pt-2 text-[13px]"
            >
              <span className="min-w-0 flex-1">
                <b>{t.label}</b> · erstellt {FMT.format(new Date(t.createdAt))} ·{" "}
                {t.lastUsedAt
                  ? `zuletzt benutzt ${FMT.format(new Date(t.lastUsedAt))}`
                  : "noch nie benutzt"}
              </span>
              <ActionForm
                action={revokeMcpToken}
                submitLabel="Widerrufen"
                confirm={`Token «${t.label}» widerrufen? Der Connector funktioniert danach nicht mehr.`}
                className=""
                buttonClassName="hd-btn hd-btn-danger hd-btn-sm"
              >
                <input type="hidden" name="id" value={t.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClaudeTab({ tokens }: { tokens: ShellToken[] }) {
  return (
    <>
      <p className="max-w-[720px] text-[13.5px] text-hd-ink-2">
        Mit dem Connector platziert Claude deine Artifacts direkt in Hub Dome. Du brauchst dafür ein
        persönliches Token, einen Connector in claude.ai und den Skill.
      </p>
      <TokenCard tokens={tokens} />
      <section className={`${CARD} max-w-[720px]`}>
        <h3 className="text-[15px] font-bold">Anleitung</h3>
        <ol className="flex flex-col gap-2.5">
          {STEPS.map((text, i) => {
            const done = i === 0 && tokens.length > 0;
            return (
              <li key={text} className="flex gap-2.5 text-[13.5px] leading-normal">
                <span
                  aria-hidden
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11.5px] font-bold ${
                    done ? "bg-hd-accent text-hd-accent-ink" : "bg-hd-chip text-hd-ink"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span>
                  <span className="sr-only">Schritt {i + 1}: </span>
                  {text}
                </span>
              </li>
            );
          })}
        </ol>
        <a href="/api/skill" download className="hd-btn hd-btn-primary self-start">
          Skill herunterladen
        </a>
        <p className="hd-note">
          Der Skill (hub-dome-platzieren.zip) sorgt dafür, dass Claude nach jedem Artifact fragt, ob
          es in Hub Dome soll. Teile das Artifact in claude.ai mit «Jeder mit dem Link», damit deine
          Freunde es öffnen können.
        </p>
        <p className="hd-note">
          Hinweis: Gratis-Konten können in claude.ai nur <strong>einen</strong> eigenen Connector
          nutzen. Wer schon einen hat, fügt Objekte über «Objekt hinzufügen» in Hub Dome ein.
        </p>
      </section>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------- Konto */

function KontoTab({ username }: { username: string }) {
  const [state, action, pending] = useActionState(requestAccountDeletion, idle);
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === username;
  return (
    <>
      <section className={`${BOX} flex max-w-[640px] flex-col gap-2.5 border-hd-danger/30`}>
        <h3 className="text-[15px] font-bold text-hd-danger">Konto löschen</h3>
        <p className="text-[13px] leading-normal text-hd-ink-2">
          Löscht nach einem Tag dein Konto mit Dorf, Häusern, Objekten, Freundschaften,
          Connector-Tokens und Nutzungszahlen. Meldest du dich vorher wieder an, wird die Löschung
          abgebrochen. Übernahmen deiner Objekte bei anderen bleiben als «Original entfernt».
        </p>
        <form
          action={action}
          onSubmit={(e) => {
            if (!window.confirm("Konto wirklich löschen? Du wirst abgemeldet.")) e.preventDefault();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="settings-confirm-username" className="text-[12.5px] text-hd-muted">
            Zur Bestätigung Benutzernamen eingeben ({username})
          </label>
          <div className="flex gap-2">
            <input
              id="settings-confirm-username"
              name="confirmUsername"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="hd-input min-w-0 flex-1"
            />
            <button
              type="submit"
              disabled={!matches || pending}
              className="hd-btn bg-hd-danger !font-bold whitespace-nowrap text-hd-danger-ink"
            >
              {pending ? "Wird beantragt…" : "Konto löschen"}
            </button>
          </div>
          {state.error && (
            <p role="alert" className="hd-error">
              {state.error}
            </p>
          )}
        </form>
      </section>
      <section className={`${CARD} max-w-[640px]`}>
        <h3 className="text-[15px] font-bold">Datenschutz</h3>
        <p className="text-[13px] leading-normal text-hd-ink-2">
          Welche Daten Hub Dome speichert und wie du sie löschen lässt, steht in der
          Datenschutzerklärung.
        </p>
        <a
          href="/datenschutz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-semibold text-hd-accent-text underline underline-offset-2"
        >
          Datenschutzerklärung lesen
        </a>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------------------------- Rahmen */

export function SettingsScreen({
  shell,
  tab,
  onTab,
  onClose,
  world,
  timeMode,
  onTimeMode,
}: {
  shell: ShellData;
  /** Unbekannt oder `null` gilt als «profil». */
  tab: string | null;
  onTab: (t: SettingsScreenTab) => void;
  onClose: () => void;
  /** Landschaft des angezeigten Dorfs («Welt neu würfeln» als Vorschau in der Szene). */
  world: WorldProps;
  timeMode: "auto" | "fest";
  onTimeMode: (m: "auto" | "fest") => void;
}) {
  const current: SettingsScreenTab = TABS.some((t) => t.id === tab)
    ? (tab as SettingsScreenTab)
    : "profil";
  const base = useId();
  const sheet = useRef<HTMLDivElement>(null);
  useFocusScope(sheet);
  const titleId = `${base}-title`;

  // Pfeiltasten wechseln den Bereich (Tab-Muster, Fokus wandert mit)
  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === current);
    const n = TABS.length;
    let next: number;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    onTab(TABS[next].id);
    document.getElementById(`${base}-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(e) => trapTab(e, sheet.current)}
      className="pointer-events-auto absolute inset-x-0 top-[150px] bottom-0 z-30 flex flex-col overflow-hidden rounded-t-hd-panel border-t border-hd-line bg-hd-surface text-hd-ink transition-transform duration-[550ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] outline-none starting:translate-y-[105%] motion-reduce:transition-none"
      // Schatten nach oben (Tokens kennen nur Schatten nach unten); Farbe aus dem Scrim-Token
      style={{ boxShadow: "0 -20px 60px var(--hd-scrim)" }}
    >
      <div className="flex items-center gap-3.5 border-b border-hd-line px-[22px] py-3.5">
        <h2 id={titleId} className="text-[20px] font-bold">
          Einstellungen
        </h2>
        <span className="text-[13px] text-hd-muted max-sm:hidden">Änderungen gelten sofort</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-keyshortcuts="Escape"
          className="cursor-pointer rounded-hd-ctl border border-hd-line px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap hover:bg-hd-raised"
        >
          Zurück ins Dorf · Esc
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[230px_minmax(0,1fr)] md:grid-rows-1">
        <div
          role="tablist"
          aria-label="Einstellungen"
          aria-orientation="vertical"
          onKeyDown={onTabKey}
          className="flex gap-1 overflow-x-auto border-b border-hd-line p-2.5 md:flex-col md:overflow-x-visible md:border-r md:border-b-0 md:py-3.5"
        >
          {TABS.map((t) => {
            const on = t.id === current;
            return (
              <button
                key={t.id}
                id={`${base}-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${base}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => onTab(t.id)}
                className={`cursor-pointer rounded-hd-ctl px-3 py-2.5 text-left transition-colors ${
                  on ? "text-hd-accent-ink" : "text-hd-ink hover:bg-hd-raised"
                }`}
                // Gewählter Bereich vollflächig Petrol (Prototyp), nur aus Token-Variablen gemischt
                style={
                  on
                    ? { background: "color-mix(in srgb, var(--hd-accent) 82%, var(--hd-surface))" }
                    : undefined
                }
              >
                <span className="block text-[13.5px] font-bold">{t.label}</span>
                <span
                  className={`block text-[11.5px] ${on ? "" : "text-hd-muted"}`}
                  style={
                    on
                      ? { color: "color-mix(in srgb, var(--hd-accent-ink) 75%, transparent)" }
                      : undefined
                  }
                >
                  {t.sub}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id={`${base}-panel`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${current}`}
          className="flex min-h-0 flex-col gap-3.5 overflow-x-hidden overflow-y-auto px-[26px] pt-5 pb-[30px]"
        >
          {current === "profil" && <ProfilTab shell={shell} />}
          {current === "dorf" && (
            <DorfTab shell={shell} world={world} timeMode={timeMode} onTimeMode={onTimeMode} />
          )}
          {current === "claude" && <ClaudeTab tokens={shell.tokens} />}
          {current === "konto" && <KontoTab username={shell.me.username} />}
        </div>
      </div>
    </div>
  );
}

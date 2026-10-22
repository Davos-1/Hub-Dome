"use client";

import { useActionState } from "react";
import { createMcpToken, revokeMcpToken } from "@/app/einstellungen/claude-actions";
import { ActionForm } from "@/components/ui/action-form";
import { CopyField } from "@/components/ui/copy-field";
import type { ShellToken } from "@/lib/shell-data";
import type { ActionState } from "@/lib/types";

const fmt = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#5e3c22] text-[12px] font-bold text-[#fbf3e4]">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-[14px]">{children}</div>
    </li>
  );
}

/** Tab «Claude»: Connector-Token erzeugen, Anleitung und Skill-Download. */
export function ClaudeTab({ tokens }: { tokens: ShellToken[] }) {
  const [state, action, pending] = useActionState(createMcpToken, {} as ActionState);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[14px]">
        Mit dem Connector platziert Claude deine Artifacts direkt in Hub Dome. Du brauchst dafür ein
        persönliches Token, einen Connector in claude.ai und den Skill.
      </p>

      <section className="hd-card flex flex-col gap-3">
        <h3 className="hd-label">1. Token erzeugen</h3>
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1">
            <label htmlFor="token-label" className="hd-note">
              Name (optional)
            </label>
            <input
              id="token-label"
              name="label"
              maxLength={40}
              placeholder="z.B. Laptop"
              className="hd-input"
            />
          </div>
          <button type="submit" disabled={pending} className="hd-btn hd-btn-primary">
            {pending ? "Erstelle…" : "Token erzeugen"}
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
            <p className="hd-note">
              Das ist deine Connector-URL. Kopiere sie jetzt; sie wird nur einmal angezeigt und
              gehört nur dir (wer sie kennt, kann in deinem Dorf Objekte platzieren).
            </p>
          </div>
        )}
        {tokens.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-[#e4d9c0] pt-2.5">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span>
                  <strong>{t.label}</strong> · erstellt {fmt.format(new Date(t.createdAt))} ·{" "}
                  {t.lastUsedAt
                    ? `zuletzt benutzt ${fmt.format(new Date(t.lastUsedAt))}`
                    : "noch nie benutzt"}
                </span>
                <ActionForm
                  action={revokeMcpToken}
                  submitLabel="Widerrufen"
                  confirm={`Token «${t.label}» widerrufen? Der Connector funktioniert danach nicht mehr.`}
                  buttonClassName="hd-btn hd-btn-danger hd-btn-sm"
                  className=""
                >
                  <input type="hidden" name="id" value={t.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hd-card flex flex-col gap-3">
        <h3 className="hd-label">Anleitung</h3>
        <ol className="flex flex-col gap-3">
          <Step n={1}>Erzeuge oben ein Token und kopiere die Connector-URL.</Step>
          <Step n={2}>
            In claude.ai: Einstellungen → Connectors → <strong>Eigenen Connector hinzufügen</strong>
            . Gib einen Namen (z.B. «Hub Dome») ein und füge die URL ein.
          </Step>
          <Step n={3}>
            Lade den Skill herunter und lade ihn in claude.ai unter Einstellungen → Fähigkeiten
            (Skills) hoch. Er sorgt dafür, dass Claude nach jedem Artifact fragt, ob es in Hub Dome
            soll (für Freunde oder nur für dich).
            <a href="/api/skill" download className="hd-btn hd-btn-primary mt-2 w-full">
              ⬇ Skill herunterladen (hub-dome-platzieren.zip)
            </a>
          </Step>
          <Step n={4}>
            Erstelle ein Artifact. Claude fragt, in welches Haus es soll, und platziert es. Teile
            das Artifact in claude.ai mit «Jeder mit dem Link», damit deine Freunde es öffnen
            können.
          </Step>
        </ol>
        <p className="hd-note">
          Hinweis: Gratis-Konten können in claude.ai nur <strong>einen</strong> eigenen Connector
          nutzen. Wer schon einen hat, fügt Objekte über «Objekt hinzufügen» in Hub Dome ein.
        </p>
      </section>
    </div>
  );
}

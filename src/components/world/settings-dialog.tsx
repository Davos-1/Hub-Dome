"use client";

import { signOut } from "@/app/doerfer/actions";
import { setTopdorfAll } from "@/app/dorf/actions";
import { requestAccountDeletion, updateDisplayName } from "@/app/einstellungen/actions";
import { StyleSettings } from "@/components/settings/style-settings";
import { ActionForm } from "@/components/ui/action-form";
import type { ShellData } from "@/lib/shell-data";
import { ClaudeTab } from "./claude-tab";
import { DialogShell, DialogTabs, resolveTab } from "./dialog-shell";

const SETTINGS_TABS = [
  ["profil", "Profil"],
  ["dorf", "Dorf"],
  ["claude", "Claude"],
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number][0];

function ProfileTab({ shell }: { shell: ShellData }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="hd-card flex flex-col gap-3">
        <ActionForm
          action={updateDisplayName}
          submitLabel="Speichern"
          successText="Gespeichert."
          buttonClassName="hd-btn hd-btn-primary self-start"
        >
          <label htmlFor="displayName" className="hd-label">
            Anzeigename
          </label>
          <input
            id="displayName"
            name="displayName"
            defaultValue={shell.me.displayName}
            required
            maxLength={60}
            className="hd-input"
          />
        </ActionForm>
        <p className="hd-note">Benutzername: @{shell.me.username} (so finden dich Freunde)</p>
      </section>
      <form action={signOut}>
        <button type="submit" className="hd-btn hd-btn-ghost">
          Abmelden
        </button>
      </form>
      <section className="hd-card flex flex-col gap-2">
        <h3 className="text-[15px] font-bold">Konto löschen</h3>
        <p className="hd-note">
          Löscht nach einem Tag dein Konto mit Dorf, Häusern, Objekten, Freundschaften,
          Connector-Tokens und Nutzungszahlen. Meldest du dich vorher wieder an, wird die Löschung
          abgebrochen. Übernahmen deiner Objekte bei anderen bleiben als «Original entfernt».{" "}
          <a href="/datenschutz" target="_blank" className="underline">
            Datenschutz
          </a>
        </p>
        <ActionForm
          action={requestAccountDeletion}
          submitLabel="Konto löschen"
          pendingLabel="Wird beantragt…"
          confirm="Konto wirklich löschen? Du wirst abgemeldet."
          buttonClassName="hd-btn hd-btn-sm self-start bg-[#9b2c1f] text-white"
        >
          <label htmlFor="confirmUsername" className="hd-label">
            Zur Bestätigung Benutzernamen eingeben ({shell.me.username})
          </label>
          <input
            id="confirmUsername"
            name="confirmUsername"
            required
            autoComplete="off"
            className="hd-input"
          />
        </ActionForm>
      </section>
    </div>
  );
}

function VillageTab({ shell }: { shell: ShellData }) {
  const own = shell.own;
  if (!own) return <p className="hd-note">Dein Dorf wurde noch nicht angelegt.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-[#3a3732]">
        Die Häuser ergeben sich aus dem Fachbereich des Moduls (Werkstatt, Blockhaus, Solarhaus,
        Atelier, Stadthaus, Turmhaus, Giebelhaus, Digital-Haus). Je mehr Objekte ein Haus enthält,
        desto grösser wird es; ein leeres Haus ist eine Baustelle. Hier wählst du den Stil deiner
        Zentrale.
      </p>
      <StyleSettings zentraleStyle={own.zentraleStyle} />
      <section className="hd-card flex flex-col gap-2">
        <h3 className="text-[15px] font-bold">Topdorf</h3>
        <p className="hd-note">
          Im Topdorf erscheinen die meistgenutzten Objekte. Freigegebene Objekte sind für alle
          angemeldeten Hub-Dome-Nutzer sichtbar, mit deinem Namen. Einzelne Objekte stellst du im
          Objektformular ein; Übernahmen und private Objekte sind nie dabei.
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionForm
            action={setTopdorfAll}
            submitLabel="Alle geteilten Objekte freigeben"
            successText="Freigegeben."
            confirm="Alle deine geteilten Objekte fürs Topdorf freigeben?"
            buttonClassName="hd-btn hd-btn-ghost hd-btn-sm"
          >
            <input type="hidden" name="topdorf" value="an" />
          </ActionForm>
          <ActionForm
            action={setTopdorfAll}
            submitLabel="Alle zurückziehen"
            successText="Zurückgezogen."
            buttonClassName="hd-btn hd-btn-ghost hd-btn-sm"
          >
            <input type="hidden" name="topdorf" value="aus" />
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

/** Einstellungen als Dialog mit den Tabs Profil, Dorf (Zentrale) und Claude (Connector). Anzeige-Optionen sind ein eigenes kleines Fenster. */
export function SettingsDialog({
  shell,
  tab,
  onTab,
  lowDetail,
  onClose,
}: {
  shell: ShellData;
  tab: string | null;
  onTab: (t: SettingsTab) => void;
  lowDetail: boolean;
  onClose: () => void;
}) {
  const current = resolveTab(SETTINGS_TABS, tab);
  return (
    <DialogShell
      title="Einstellungen"
      kicker="Hub Dome · Einstellungen"
      icon="einstellungen"
      subtitle="Änderungen gelten sofort."
      onClose={onClose}
      size="lg"
      lowDetail={lowDetail}
    >
      <DialogTabs label="Einstellungen" tabs={SETTINGS_TABS} current={current} onTab={onTab}>
        {current === "profil" && <ProfileTab shell={shell} />}
        {current === "dorf" && <VillageTab shell={shell} />}
        {current === "claude" && <ClaudeTab tokens={shell.tokens} />}
      </DialogTabs>
    </DialogShell>
  );
}

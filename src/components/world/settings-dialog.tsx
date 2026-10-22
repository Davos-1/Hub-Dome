"use client";

import { signOut } from "@/app/doerfer/actions";
import { updateDisplayName } from "@/app/einstellungen/actions";
import { StyleSettings } from "@/components/settings/style-settings";
import { ActionForm } from "@/components/ui/action-form";
import type { ShellData } from "@/lib/shell-data";
import { ClaudeTab } from "./claude-tab";
import { DialogShell } from "./dialog-shell";

export const SETTINGS_TABS = [
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
  const current: SettingsTab = SETTINGS_TABS.some(([id]) => id === tab)
    ? (tab as SettingsTab)
    : "profil";
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
      <div className="flex flex-col gap-5">
        <div
          role="tablist"
          aria-label="Einstellungen"
          className="flex gap-0.5 rounded-xl bg-[#efe6d0] p-[3px]"
        >
          {SETTINGS_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={current === id}
              onClick={() => onTab(id)}
              className={`flex-1 cursor-pointer rounded-[9px] px-2 py-2 text-[13px] font-bold ${
                current === id ? "bg-[#5e3c22] text-[#fbf3e4]" : "text-[#4a3a26] hover:bg-[#e6dbc0]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {current === "profil" && <ProfileTab shell={shell} />}
          {current === "dorf" && <VillageTab shell={shell} />}
          {current === "claude" && <ClaudeTab tokens={shell.tokens} />}
        </div>
      </div>
    </DialogShell>
  );
}

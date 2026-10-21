"use client";

import { revokeAccess, deleteInvite, updateDisplayName } from "@/app/einstellungen/actions";
import { signOut } from "@/app/doerfer/actions";
import { InviteForm } from "@/components/list/invite-form";
import { ModelUpload } from "@/components/settings/model-upload";
import { StyleSettings } from "@/components/settings/style-settings";
import { ActionForm, dangerButton, inputClass } from "@/components/ui/action-form";
import { TIME_LABELS, type TimeSetting } from "@/lib/daytime";
import type { ShellData } from "@/lib/shell-data";
import { ARTIFACT_KIND_LABELS, type ArtifactKind } from "@/lib/types";
import { FILTER_KINDS, KEY_HINTS, Segments, TIME_ORDER } from "../village/hud/side-window";
import type { SceneActions } from "../village/scene-actions";
import { useScene, type SceneStore } from "../village/scene-store";
import { DialogShell, dlgLink } from "./dialog-shell";

const fmt = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

export const SETTINGS_TABS = [
  ["profil", "Profil"],
  ["dorf", "Dorf"],
  ["teilen", "Teilen"],
  ["anzeige", "Anzeige"],
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number][0];

function ProfileTab({ shell }: { shell: ShellData }) {
  return (
    <div className="flex flex-col gap-5">
      <ActionForm
        action={updateDisplayName}
        submitLabel="Speichern"
        successText="Gespeichert."
        buttonClassName="cursor-pointer self-start rounded-lg bg-[#2f5d4a] px-4 py-2 text-[14px] font-semibold text-[#fffdf8] disabled:opacity-60"
      >
        <label htmlFor="displayName" className="text-sm font-medium">
          Anzeigename
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={shell.me.displayName}
          required
          maxLength={60}
          className={inputClass}
        />
      </ActionForm>
      <p className="text-sm text-[#6d6a63]">Benutzername: @{shell.me.username}</p>
      <form action={signOut}>
        <button type="submit" className={dlgLink}>
          Abmelden
        </button>
      </form>
    </div>
  );
}

function VillageTab({ shell }: { shell: ShellData }) {
  const own = shell.own;
  if (!own) return <p className="text-sm text-[#6d6a63]">Dein Dorf wurde noch nicht angelegt.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[#3a3732]">
        Die Häuser ergeben sich aus dem Fachbereich des Moduls (Werkstatt, Blockhaus, Solarhaus,
        Atelier, Stadthaus, Turmhaus, Giebelhaus, Digital-Haus). Je mehr Objekte ein Haus enthält,
        desto grösser wird es; ein leeres Haus ist eine Baustelle. Hier wählst du den Stil deiner
        Zentrale.
      </p>
      <StyleSettings zentraleStyle={own.zentraleStyle} hasModel={Boolean(own.modelMeta)} />
      <h3 className="mt-2 text-lg font-semibold">Eigenes Modell für die Zentrale</h3>
      <ModelUpload villageId={own.villageId} meta={own.modelMeta} />
    </div>
  );
}

function ShareTab({ shell }: { shell: ShellData }) {
  const own = shell.own;
  if (!own) return null;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Dorf teilen</h3>
        <InviteForm />
        {own.invites.length > 0 && (
          <div>
            <h4 className="mb-1 text-sm font-medium">Offene Einladungen</h4>
            <ul className="flex flex-col gap-2">
              {own.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {i.uses}/{i.maxUses} genutzt · gültig bis {fmt.format(new Date(i.expiresAt))}
                  </span>
                  <ActionForm
                    action={deleteInvite}
                    submitLabel="Widerrufen"
                    buttonClassName={dangerButton}
                    className=""
                  >
                    <input type="hidden" name="id" value={i.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Wer sieht mein Dorf?</h3>
        {own.viewers.length === 0 ? (
          <p className="text-sm text-[#6d6a63]">Noch niemand.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {own.viewers.map((v) => (
              <li key={v.viewerId} className="flex items-center justify-between gap-3">
                <span>
                  {v.displayName}{" "}
                  <span className="text-sm text-[#6d6a63]">
                    @{v.username} · seit {fmt.format(new Date(v.grantedAt))}
                  </span>
                </span>
                <ActionForm
                  action={revokeAccess}
                  submitLabel="Zugriff entziehen"
                  confirm={`Zugriff für ${v.displayName} entziehen?`}
                  buttonClassName={dangerButton}
                  className=""
                >
                  <input type="hidden" name="viewerId" value={v.viewerId} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DisplayTab({ store, actions }: { store: SceneStore; actions: SceneActions }) {
  const time = useScene(store, (s) => s.time);
  const view = useScene(store, (s) => s.view);
  const filter = useScene(store, (s) => s.filter);
  return (
    <div className="flex flex-col gap-5">
      <Segments
        label="Tageszeit"
        value={time}
        options={TIME_ORDER.map((t) => [t, TIME_LABELS[t]] as [TimeSetting, string])}
        onPick={(t) => store.set({ time: t })}
      />
      <Segments
        label="Ansicht"
        value={view}
        options={[
          ["3d", "3D"],
          ["karte", "Karte"],
        ]}
        onPick={(v) => actions.setView(v)}
      />
      <Segments
        label="Nach Kategorie filtern"
        value={filter}
        options={[
          ["", "Alle"],
          ...FILTER_KINDS.map((k) => [k, ARTIFACT_KIND_LABELS[k]] as [ArtifactKind, string]),
        ]}
        onPick={(k) => store.set({ filter: k })}
      />
      <div className="flex flex-col gap-1.5 border-t border-[#ebe6dc] pt-4">
        <div className="text-[13px] font-semibold">Bedienung</div>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-[12.5px] text-[#3a3732]">
          {KEY_HINTS.map(([k, text]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[11.5px] font-medium text-[#6d6a63]">{k}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Einstellungen als Dialog mit Tabs: Profil, Dorf (Zentrale), Teilen, Anzeige. */
export function SettingsDialog({
  shell,
  store,
  actions,
  tab,
  onTab,
  lowDetail,
  onClose,
}: {
  shell: ShellData;
  store: SceneStore;
  actions: SceneActions;
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
      subtitle="Änderungen gelten sofort."
      onClose={onClose}
      size="lg"
      lowDetail={lowDetail}
    >
      <div className="flex flex-col gap-5">
        <div
          role="tablist"
          aria-label="Einstellungen"
          className="flex gap-0.5 rounded-[10px] bg-[#efeae0] p-[3px]"
        >
          {SETTINGS_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={current === id}
              onClick={() => onTab(id)}
              className={`flex-1 cursor-pointer rounded-lg px-2 py-2 text-[13px] font-semibold ${
                current === id ? "bg-[#1c1b19] text-[#fffdf8]" : "text-[#3a3732]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {current === "profil" && <ProfileTab shell={shell} />}
          {current === "dorf" && <VillageTab shell={shell} />}
          {current === "teilen" && <ShareTab shell={shell} />}
          {current === "anzeige" && <DisplayTab store={store} actions={actions} />}
        </div>
      </div>
    </DialogShell>
  );
}

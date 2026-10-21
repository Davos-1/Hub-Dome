import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/ui/app-header";
import { ActionForm, dangerButton, inputClass } from "@/components/ui/action-form";
import { ModelUpload } from "@/components/settings/model-upload";
import { StyleSettings } from "@/components/settings/style-settings";
import { InviteForm } from "@/components/list/invite-form";
import { deleteInvite, revokeAccess, updateDisplayName } from "./actions";

export const metadata = { title: "Einstellungen – Hub Dome" };

const fmt = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

type Viewer = {
  viewer_id: string;
  granted_at: string;
  viewer: { username: string; display_name: string } | null;
};

async function EinstellungenContent() {
  const { supabase, profile } = await requireProfile();

  const { data: village } = await supabase
    .from("villages")
    .select("id, zentrale_style, zentrale_model_meta")
    .eq("owner_id", profile.id)
    .single();

  const { data: viewerRows } = await supabase
    .from("village_access")
    .select("viewer_id, granted_at, viewer:profiles(username, display_name)")
    .eq("village_id", village?.id ?? "")
    .order("granted_at");
  const viewers = (viewerRows ?? []) as unknown as Viewer[];

  const { data: invites } = await supabase
    .from("invites")
    .select("id, expires_at, max_uses, uses")
    .eq("village_id", village?.id ?? "")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 p-6">
      <AppHeader displayName={profile.display_name} />
      <h1 className="text-3xl font-bold">Einstellungen</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Profil</h2>
        <ActionForm action={updateDisplayName} submitLabel="Speichern" successText="Gespeichert.">
          <label htmlFor="displayName" className="text-sm font-medium">
            Anzeigename
          </label>
          <input
            id="displayName"
            name="displayName"
            defaultValue={profile.display_name}
            required
            maxLength={60}
            className={inputClass}
          />
        </ActionForm>
        <p className="text-sm text-zinc-500">Benutzername: @{profile.username}</p>
      </section>

      {village && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Dorf gestalten</h2>
          <p className="text-sm text-zinc-600">
            Die Häuser ergeben sich aus dem Fachbereich des Moduls (Werkstatt, Blockhaus, Solarhaus,
            Atelier, Stadthaus, Turmhaus, Giebelhaus, Digital-Haus). Je mehr Objekte ein Haus
            enthält, desto grösser wird es; ein leeres Haus ist eine Baustelle. Hier wählst du den
            Stil deiner Zentrale.
          </p>
          <StyleSettings
            zentraleStyle={village.zentrale_style}
            hasModel={Boolean(village.zentrale_model_meta)}
          />
          <h3 className="mt-4 text-lg font-semibold">Eigenes Modell für die Zentrale</h3>
          <ModelUpload villageId={village.id} meta={village.zentrale_model_meta} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Dorf teilen</h2>
        <InviteForm />
        {invites && invites.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-medium">Offene Einladungen</h3>
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {i.uses}/{i.max_uses} genutzt · gültig bis {fmt.format(new Date(i.expires_at))}
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
        <h2 className="text-xl font-semibold">Wer sieht mein Dorf?</h2>
        {viewers.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch niemand.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {viewers.map((v) => (
              <li key={v.viewer_id} className="flex items-center justify-between gap-3">
                <span>
                  {v.viewer?.display_name}{" "}
                  <span className="text-sm text-zinc-500">
                    @{v.viewer?.username} · seit {fmt.format(new Date(v.granted_at))}
                  </span>
                </span>
                <ActionForm
                  action={revokeAccess}
                  submitLabel="Zugriff entziehen"
                  confirm={`Zugriff für ${v.viewer?.display_name} entziehen?`}
                  buttonClassName={dangerButton}
                  className=""
                >
                  <input type="hidden" name="viewerId" value={v.viewer_id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function EinstellungenPage() {
  return (
    <Suspense>
      <EinstellungenContent />
    </Suspense>
  );
}

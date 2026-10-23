"use client";

import { ActionForm } from "@/components/ui/action-form";
import { completeOnboarding } from "./actions";

export function OnboardingForm({ suggestedName, next }: { suggestedName: string; next?: string }) {
  return (
    <ActionForm
      action={completeOnboarding}
      submitLabel="Dorf gründen"
      buttonClassName="hd-btn hd-btn-primary"
    >
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="displayName" className="hd-label">
        Anzeigename
      </label>
      <input
        id="displayName"
        name="displayName"
        defaultValue={suggestedName}
        required
        maxLength={60}
        className="hd-input"
      />
      <label htmlFor="username" className="hd-label">
        Benutzername
      </label>
      <input
        id="username"
        name="username"
        required
        minLength={3}
        maxLength={24}
        pattern="[a-z0-9_\-]{3,24}"
        autoCapitalize="none"
        className="hd-input"
      />
      <p className="hd-note">
        3–24 Zeichen: Kleinbuchstaben, Zahlen, _ und -. Er bildet die Adresse deines Dorfs.
      </p>
    </ActionForm>
  );
}

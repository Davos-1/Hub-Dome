"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

export function OnboardingForm({ suggestedName, next }: { suggestedName: string; next?: string }) {
  const [state, action, pending] = useActionState(completeOnboarding, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
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
      <button type="submit" disabled={pending} className="hd-btn hd-btn-primary">
        {pending ? "Speichere…" : "Dorf gründen"}
      </button>
      {state.error && (
        <p role="alert" className="hd-error">
          {state.error}
        </p>
      )}
    </form>
  );
}

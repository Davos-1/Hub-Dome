"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(completeOnboarding, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="displayName" className="text-sm font-medium">
        Anzeigename
      </label>
      <input
        id="displayName"
        name="displayName"
        defaultValue={suggestedName}
        required
        maxLength={60}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-black"
      />
      <label htmlFor="username" className="text-sm font-medium">
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
        className="rounded-lg border border-zinc-300 px-3 py-2 text-black"
      />
      <p className="text-xs text-zinc-500">
        3–24 Zeichen: Kleinbuchstaben, Zahlen, _ und -. Er bildet die Adresse deines Dorfs.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Speichere…" : "Dorf gründen"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

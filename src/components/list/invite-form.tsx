"use client";

import { useActionState } from "react";
import { createInvite } from "@/app/einstellungen/actions";
import { CopyField } from "@/components/ui/copy-field";
import { inputClass } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, initial);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="maxUses" className="text-sm font-medium">
            Wie viele Personen dürfen den Link nutzen?
          </label>
          <input
            id="maxUses"
            name="maxUses"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
            className={`${inputClass} w-28`}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Erstelle…" : "Einladungslink erstellen"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.inviteUrl && (
        <div className="flex flex-col gap-2 rounded-lg bg-green-50 p-3 text-green-900">
          <p className="text-sm">
            Link (7 Tage gültig). Er wird nur jetzt angezeigt – kopiere ihn gleich.
          </p>
          <CopyField value={state.inviteUrl} />
        </div>
      )}
    </div>
  );
}

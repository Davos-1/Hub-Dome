"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Wenn gesetzt, wird vor dem Absenden nachgefragt. */
  confirm?: string;
  className?: string;
  buttonClassName?: string;
  /** Bei Erfolg angezeigter Text. */
  successText?: string;
};

const initial: ActionState = {};

/** Formular mit Server Action, Fehleranzeige und optionaler Rückfrage. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Speichere…",
  confirm,
  className = "flex flex-col gap-3",
  buttonClassName = "rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60",
  successText,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.ok && successText && (
        <p role="status" className="text-sm text-green-700">
          {successText}
        </p>
      )}
    </form>
  );
}

export const inputClass = "rounded-lg border border-zinc-300 px-3 py-2 text-black w-full";
export const dangerButton =
  "rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-60";
export const subtleButton =
  "rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-60";

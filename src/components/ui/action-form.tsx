"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
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
  /** Wird einmal pro erfolgreichem Absenden aufgerufen (z.B. Dialog schliessen). */
  onSuccess?: () => void;
  /** Zusätzliche Anzeige unter den Meldungen, z.B. ein erzeugter Link. */
  renderResult?: (state: ActionState) => ReactNode;
  /** Wenn gesetzt, stehen Felder und Knopf zusammen in einer Zeile mit dieser Klasse; Meldungen folgen darunter. */
  rowClassName?: string;
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
  buttonClassName = "hd-btn hd-btn-primary self-start",
  successText,
  onSuccess,
  renderResult,
  rowClassName,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const seen = useRef(state);
  useEffect(() => {
    if (state.ok && seen.current !== state) onSuccess?.();
    seen.current = state;
  }, [state, onSuccess]);

  const controls = (
    <>
      {children}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </>
  );

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {rowClassName ? <div className={rowClassName}>{controls}</div> : controls}
      {state.error && (
        <p role="alert" className="hd-error">
          {state.error}
        </p>
      )}
      {state.ok && successText && (
        <p role="status" className="hd-ok">
          {successText}
        </p>
      )}
      {renderResult?.(state)}
    </form>
  );
}

export const inputClass = "hd-input";
export const dangerButton = "hd-btn hd-btn-danger hd-btn-sm";

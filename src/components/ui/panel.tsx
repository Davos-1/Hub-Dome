"use client";

import { useId, type CSSProperties, type ReactNode, type Ref } from "react";

/**
 * Box mit «Verlauf» (Phase 4h): oben dunkles Petrol, nach unten ins Neutrale, ohne Farbstrich links.
 * Kopf mit Kicker (Mono, Petrol-Text), Titel, Untertitel und rundem Schliessen-Knopf. Masse wie im Prototyp
 * (`docs/design_handoff_4h/prototyp.dc.html`, Tafel): Kopf 16/18/12/20 px, Titel 19 px, Untertitel 12.5 px.
 */
export function Panel({
  kicker,
  title,
  sub,
  onClose,
  closeLabel = "Schliessen",
  icon,
  children,
  className = "",
  style,
  as = "section",
  role,
  modal,
  panelRef,
  titleSize = 19,
  scroll = true,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** Kleines Symbol links im Kopf (z.B. Dialoge ohne Ort). */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "section" | "aside" | "div";
  role?: string;
  modal?: boolean;
  panelRef?: Ref<HTMLElement>;
  titleSize?: number;
  /** Inhalt scrollt in der Box (Standard) oder die Box wächst mit. */
  scroll?: boolean;
}) {
  const titleId = useId();
  const Tag = as;
  return (
    <Tag
      ref={panelRef as Ref<HTMLDivElement>}
      role={role}
      aria-modal={modal || undefined}
      aria-labelledby={titleId}
      tabIndex={role === "dialog" ? -1 : undefined}
      className={`hd-box flex flex-col outline-none ${scroll ? "overflow-x-hidden overflow-y-auto" : ""} ${className}`}
      style={style}
    >
      <div className="flex items-start gap-3 pt-4 pr-[18px] pb-3 pl-5">
        {icon && (
          <span
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-hd-accent text-[17px] text-hd-accent-ink"
          >
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
          {kicker && <span className="hd-kicker max-w-full truncate">{kicker}</span>}
          <h2
            id={titleId}
            className="max-w-full leading-[1.2] font-bold break-words text-hd-ink"
            style={{ fontSize: titleSize }}
          >
            {title}
          </h2>
          {sub && <span className="text-[12.5px] text-hd-muted">{sub}</span>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="hd-close flex h-7 w-7 flex-none items-center justify-center self-start text-[12px]"
          >
            ✕
          </button>
        )}
      </div>
      {children}
    </Tag>
  );
}

/** Inhalt einer Box (Abstände wie im Prototyp). */
export function PanelBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3.5 pt-3.5 pr-[18px] pb-1.5 pl-5 ${className}`}>
      {children}
    </div>
  );
}

/** Fusszeile einer Box: Knöpfe rechts, gefährliche Aktion links. */
export function PanelFooter({
  children,
  line = true,
  className = "",
}: {
  children: ReactNode;
  /** Trennlinie oben (Formulare). */
  line?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`mt-auto flex flex-wrap items-center gap-2 pt-3 pr-[18px] pb-3.5 pl-5 ${line ? "border-t border-hd-line" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

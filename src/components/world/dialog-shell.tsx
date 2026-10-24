"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogIcon = "start" | "reise" | "einstellungen" | "haus" | "objekt" | "bearbeiten";

/** Kleine Symbole für den Kopf (helle Linien auf Petrol). */
function Icon({ name }: { name: DialogIcon }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "reise":
      return (
        <svg {...common}>
          <path d="M12 3v18M12 6h7l2 2.5-2 2.5h-7M12 13H5l-2 2.5L5 18h7" />
        </svg>
      );
    case "einstellungen":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      );
    case "haus":
    case "start":
      return (
        <svg {...common}>
          <path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5" />
        </svg>
      );
    case "objekt":
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />
        </svg>
      );
    case "bearbeiten":
      return (
        <svg {...common}>
          <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19zM14 7l3 3" />
        </svg>
      );
  }
}

/**
 * Dialog über der Welt als Box «Verlauf» (Phase 4h): Kopf mit Petrol-Symbol, Kicker und Titel.
 * Hintergrund abgedunkelt (leicht unscharf, auf Touch-Geräten nur abgedunkelt), Fokusfalle, Esc und Klick
 * daneben schliessen, Fokus kehrt zum Auslöser zurück. Auf kleinen Bildschirmen ein Vollbild-Blatt.
 */
export function DialogShell({
  title,
  subtitle,
  kicker = "Hub Dome",
  icon = "start",
  onClose,
  children,
  size = "md",
  lowDetail = false,
  hideClose = false,
}: {
  title: string;
  subtitle?: string;
  /** Kleine Zeile über dem Titel (z.B. «Hub Dome · Einstellungen»). */
  kicker?: string;
  icon?: DialogIcon;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
  /** Touch-Geräte: kein Blur (spart Grafikleistung), nur Abdunkeln. */
  lowDetail?: boolean;
  hideClose?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    // Fokus in den Dialog: erstes Eingabeelement oder der Dialog selbst
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el;
    first?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (n) => n.offsetParent !== null,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === firstNode) {
      e.preventDefault();
      lastNode.focus();
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault();
      firstNode.focus();
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center sm:p-6"
      onKeyDown={onKeyDown}
    >
      <div
        className={`hd-fade-in absolute inset-0 bg-hd-scrim ${lowDetail ? "" : "backdrop-blur-[3px]"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-hd-dialog
        className={`hd-pop-in hd-box relative flex max-h-full w-full flex-col overflow-hidden outline-none max-sm:h-full max-sm:rounded-none max-sm:border-0 ${
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-hd-accent text-hd-accent-ink">
            <Icon name={icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="hd-kicker">{kicker}</div>
            <h2 id={titleId} className="truncate text-[20px] leading-tight font-bold">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-hd-muted">{subtitle}</p>}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Schliessen"
              className="hd-close flex h-7 w-7 flex-none items-center justify-center text-[12px]"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-5 pt-2 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** Knöpfe und Links der Dialoge (Klassen aus globals.css). */
export const dlgPrimary = "hd-btn hd-btn-primary";
export const dlgSecondary = "hd-btn hd-btn-ghost";
export const dlgLink = "text-[13px] font-medium text-hd-accent-text underline underline-offset-2";

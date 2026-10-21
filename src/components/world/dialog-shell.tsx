"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Grosser Dialog über der Welt: unscharfer Hintergrund (auf Touch-Geräten nur abgedunkelt), Fokusfalle,
 * Esc und Klick daneben schliessen, Fokus kehrt zum Auslöser zurück. Auf kleinen Bildschirmen ein Vollbild-Blatt.
 */
export function DialogShell({
  title,
  subtitle,
  onClose,
  children,
  size = "md",
  lowDetail = false,
  hideClose = false,
}: {
  title: string;
  subtitle?: string;
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
        className={`hd-fade-in absolute inset-0 ${
          lowDetail ? "bg-[#1c1b19]/55" : "bg-[#1c1b19]/25 backdrop-blur-md"
        }`}
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
        className={`hd-pop-in relative flex max-h-full w-full flex-col overflow-hidden bg-[#fffdf8] text-[#1c1b19] shadow-[0_24px_80px_rgba(28,27,25,.35)] outline-none max-sm:h-full sm:rounded-2xl ${
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#ebe6dc] px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-[#6d6a63]">{subtitle}</p>}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Schliessen"
              className="h-9 w-9 flex-none cursor-pointer rounded-lg bg-[#efeae0] text-[16px] text-[#3a3732] hover:bg-[#e6dfd0]"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Einheitliche Knöpfe und Felder für die Dialoge (gleiche Tokens wie die 3D-Oberfläche). */
export const dlgPrimary =
  "cursor-pointer rounded-lg bg-[#2f5d4a] px-4 py-2.5 text-[14px] font-semibold text-[#fffdf8] hover:bg-[#274d3e] disabled:opacity-60";
export const dlgSecondary =
  "cursor-pointer rounded-lg border border-[#d9d4c9] bg-[#fffdf8] px-4 py-2.5 text-[14px] font-medium text-[#1c1b19] hover:bg-[#efeae0] disabled:opacity-60";
export const dlgLink = "text-[13px] font-medium text-[#2f5d4a] underline underline-offset-2";

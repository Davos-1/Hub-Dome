"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogIcon = "start" | "reise" | "einstellungen" | "haus" | "objekt" | "bearbeiten";

/** Kleine Symbole für den Schildkopf (cremefarbene Linien, passend zum Holzschild). */
function Icon({ name }: { name: DialogIcon }) {
  const common = {
    width: 26,
    height: 26,
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
 * Grosser Dialog über der Welt im Stil der Holzschilder: Kopf aus Brettern mit Symbol, Pergament-Körper.
 * Hintergrund unscharf (auf Touch-Geräten nur abgedunkelt), Fokusfalle, Esc und Klick daneben schliessen,
 * Fokus kehrt zum Auslöser zurück. Auf kleinen Bildschirmen ein Vollbild-Blatt.
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
        className={`hd-pop-in hd-frame relative flex max-h-full w-full flex-col overflow-hidden bg-[var(--hd-paper)] text-[var(--hd-ink)] shadow-[0_24px_80px_rgba(28,27,25,.4)] outline-none max-sm:h-full max-sm:border-0 sm:rounded-[20px] ${
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <div className="hd-plank flex items-center gap-3.5 px-5 py-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#5e3c22]/55 text-[#fbf3e4]">
            <Icon name={icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="hd-kicker">{kicker}</div>
            <h2 id={titleId} className="truncate text-[21px] leading-tight font-bold">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-[#f0d9b5]">{subtitle}</p>}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Schliessen"
              className="h-9 w-9 flex-none cursor-pointer rounded-full bg-[#fbf3e4] text-[15px] font-bold text-[#5e3c22] shadow-[0_2px_0_#3e2814] hover:bg-white"
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

/** Link-Stil in Dialogen. */
export const dlgLink = "text-[13px] font-medium text-[#2f5d4a] underline underline-offset-2";

type TabList<T extends string> = readonly (readonly [id: T, label: string])[];

/** Der Tab aus der URL, sonst der erste. */
export function resolveTab<T extends string>(tabs: TabList<T>, value: string | null): T {
  return tabs.find(([id]) => id === value)?.[0] ?? tabs[0][0];
}

/** Tab-Leiste mit Fenster darunter (WAI-ARIA Tabs); `badges` zeigt eine Zahl neben dem Tab-Namen. */
export function DialogTabs<T extends string>({
  label,
  tabs,
  current,
  onTab,
  badges = {},
  busy,
  children,
}: {
  label: string;
  tabs: TabList<T>;
  current: T;
  onTab: (id: T) => void;
  badges?: Partial<Record<T, number>>;
  busy?: boolean;
  children: ReactNode;
}) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabId = (id: T) => `${baseId}-tab-${id}`;

  return (
    <div className="flex flex-col gap-5" aria-busy={busy}>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-0.5 rounded-xl bg-[#efe6d0] p-[3px]"
      >
        {tabs.map(([id, tabLabel]) => {
          const badge = badges[id] ?? 0;
          return (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={current === id}
              aria-controls={panelId}
              onClick={() => onTab(id)}
              className={`flex-1 cursor-pointer rounded-[9px] px-2 py-2 text-[13px] font-bold ${
                current === id ? "bg-[#5e3c22] text-[#fbf3e4]" : "text-[#4a3a26] hover:bg-[#e6dbc0]"
              }`}
            >
              {tabLabel}
              {badge > 0 && (
                <span className="ml-1.5 rounded-full bg-[#facc15] px-1.5 py-0.5 text-[11px] text-[#1c1b19]">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(current)}
        className="flex flex-col gap-5"
      >
        {children}
      </div>
    </div>
  );
}

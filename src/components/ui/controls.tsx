"use client";

import type { ReactNode } from "react";

/**
 * Kleine Bedienelemente der Oberfläche «Werkbank» (Phase 4h), Masse wie im Prototyp
 * (`docs/design_handoff_4h/prototyp.dc.html`). Alle Farben über Tokens; Datenfarben (Kategorie, Haus) als Prop.
 */

/** Pille, z.B. Quartier oder Kategorie; `dot` ist eine Datenfarbe. */
export function Chip({
  on = false,
  onClick,
  dot,
  dotShape = "round",
  children,
  disabled,
  title,
}: {
  on?: boolean;
  onClick?: () => void;
  dot?: string;
  dotShape?: "round" | "square";
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-[11px] py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-45 ${
        on
          ? "border-hd-accent-line bg-hd-accent-soft text-hd-ink"
          : "border-hd-line bg-transparent text-hd-ink-2 hover:bg-hd-raised"
      }`}
    >
      {dot && (
        <span
          aria-hidden
          className={`h-[7px] w-[7px] flex-none ${dotShape === "round" ? "rounded-full" : "rounded-[2px]"}`}
          style={{ background: dot }}
        />
      )}
      {children}
    </button>
  );
}

/** Auswahl aus wenigen Möglichkeiten (Feld-Hintergrund, gewählte Option hell bzw. Petrol). */
export function Segment<T extends string | number | null>({
  label,
  value,
  options,
  onPick,
  tone = "ink",
  stretch = false,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onPick: (v: T) => void;
  /** Farbe der gewählten Option: hell (Standard) oder Petrol. */
  tone?: "ink" | "accent";
  stretch?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-0.5 rounded-hd-ctl bg-hd-field p-[3px] ${stretch ? "w-full" : "w-fit"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onPick(o.value)}
            className={`cursor-pointer rounded-hd-ctl font-semibold whitespace-nowrap transition-colors ${
              stretch ? "flex-1" : ""
            } ${size === "sm" ? "px-2.5 py-[5px] text-[12.5px]" : "px-3 py-1.5 text-[12.5px]"} ${
              on
                ? tone === "accent"
                  ? "bg-hd-accent text-hd-accent-ink"
                  : "bg-hd-ink text-hd-surface"
                : "text-hd-ink-2 hover:text-hd-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Schalter (Kippschalter 30 × 17) mit Beschriftung links. */
export function Toggle({
  label,
  hint,
  on,
  onChange,
  disabled,
  name,
}: {
  label: ReactNode;
  hint?: ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** Für Formulare: verstecktes Feld mit «on». */
  name?: string;
}) {
  const active = on && !disabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full cursor-pointer items-center justify-between gap-3.5 py-0.5 text-left text-[13.5px] disabled:cursor-default disabled:opacity-45"
    >
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-[12.5px] text-hd-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-[17px] w-[30px] flex-none rounded-[9px] transition-colors ${active ? "bg-hd-accent" : "bg-hd-chip"}`}
      >
        <span
          className={`absolute top-[2px] h-[13px] w-[13px] rounded-full transition-[left] duration-150 ${active ? "left-[15px] bg-hd-accent-ink" : "left-[2px] bg-hd-muted"}`}
        />
      </span>
      {name && active && <input type="hidden" name={name} value="on" />}
    </button>
  );
}

/** Zahl mit − und + (z.B. Anzahl Personen für den Freundschaftslink). */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-hd-ctl border border-hd-line bg-hd-field"
    >
      <button
        type="button"
        aria-label={`${label}: weniger`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="cursor-pointer px-2.5 py-1.5 text-hd-muted disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[1.5em] text-center text-[13px] font-bold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label}: mehr`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="cursor-pointer px-2.5 py-1.5 text-hd-muted disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

/** Feste Farbauswahl (Hausfarben, Datenfarben) als Raster mit 4 Spalten. */
export function ColorSwatches({
  label,
  colors,
  value,
  onPick,
  names,
}: {
  label: string;
  colors: readonly string[];
  value: string | null;
  onPick: (c: string) => void;
  names?: readonly string[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5">
      {colors.map((c, i) => {
        const on = value?.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={names?.[i] ?? c}
            title={names?.[i]}
            onClick={() => onPick(c)}
            className={`h-8 cursor-pointer rounded-hd-ctl transition-shadow ${on ? "shadow-[0_0_0_2px_var(--hd-surface),0_0_0_4px_var(--hd-accent-line)]" : ""}`}
            style={{ background: c }}
          />
        );
      })}
    </div>
  );
}

/** Symbol-Knopf (34 × 32), z.B. Reise und Einstellungen in der Leiste; `badge` als Zähler oben rechts. */
export function IconButton({
  label,
  onClick,
  children,
  badge,
  pressed,
  shortcut,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  badge?: number;
  pressed?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={badge ? `${label} (${badge} neu)` : label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      className={`relative flex h-8 w-[34px] cursor-pointer items-center justify-center rounded-hd-ctl transition-colors hover:bg-hd-chip hover:text-hd-ink ${pressed ? "bg-hd-chip text-hd-ink" : "text-hd-ink-2"}`}
    >
      {children}
      {badge ? (
        <span
          aria-hidden
          className="absolute top-px right-px flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-hd-accent px-1 text-[9.5px] font-bold text-hd-accent-ink"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

const svg = {
  width: 19,
  height: 19,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Linien-Symbole der Bedienung (eine Familie, 1.7 px). */
export const Icons = {
  compass: (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  ),
  sliders: (
    <svg {...svg}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  ),
  plusHouse: (
    <svg {...svg}>
      <path d="M3 11 12 4l9 7M5.5 9.5V20h7M15 17h6M18 14v6" />
    </svg>
  ),
  filter: (
    <svg {...svg}>
      <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
    </svg>
  ),
  search: (
    <svg {...svg}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  ),
} as const;

/** Beschriftetes Feld (Label 12.5 px gedämpft, darunter das Eingabeelement). */
export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] text-hd-muted">
        {label}
      </label>
      {children}
      {hint && <span className="text-[11.5px] text-hd-faint">{hint}</span>}
    </div>
  );
}

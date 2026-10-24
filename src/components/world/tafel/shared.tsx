"use client";

import type { ReactNode } from "react";
import { ITEM_TYPE_ICONS, type ItemType } from "@/lib/item-types";
import type { ArtifactKind } from "@/lib/types";
import { KIND_COLORS } from "../../village/colors";

/** «Baustelle», «1 Objekt», «3 Objekte». */
export const countText = (n: number) =>
  n === 0 ? "Baustelle" : n === 1 ? "1 Objekt" : `${n} Objekte`;

/** Datum kurz: «23.10.» (wie im Prototyp). */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

/** Punkt in der Kategoriefarbe (Datenfarbe). */
export function KindDot({
  kind,
  size = 9,
  square,
}: {
  kind: ArtifactKind;
  size?: number;
  square?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`flex-none ${square ? "rounded-[3px]" : "rounded-full"}`}
      style={{ width: size, height: size, background: KIND_COLORS[kind] }}
    />
  );
}

/**
 * Vorschau-Fläche: Muster mit Symbol der Objektart und Kategoriestreifen unten. Bilder von fremden Servern lädt
 * Hub Dome bewusst nicht (Datenschutz); README und Code zeigt die Objekt-Tafel separat.
 */
export function PreviewTile({
  kind,
  itemType,
  height = 70,
  label = "Vorschau",
}: {
  kind: ArtifactKind;
  itemType: ItemType;
  height?: number;
  label?: string;
}) {
  return (
    <span className="flex flex-col" aria-hidden>
      <span className="hd-hatch flex flex-col items-center justify-center gap-1" style={{ height }}>
        <span className="text-[20px] leading-none">{ITEM_TYPE_ICONS[itemType]}</span>
        <span className="hd-mono text-[9.5px] tracking-[0.08em] text-hd-faint uppercase">
          {label}
        </span>
      </span>
      <span className="h-[3px]" style={{ background: KIND_COLORS[kind] }} />
    </span>
  );
}

/** Kennzahlen-Leiste (Objekte, neu, geöffnet, Semester). */
export function Stats({ items }: { items: { v: ReactNode; l: string }[] }) {
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-hd-ctl border border-hd-line">
      {items.map((s, i) => (
        <div
          key={s.l}
          className={`px-2.5 py-2 ${i < items.length - 1 ? "border-r border-hd-line" : ""}`}
        >
          <div className="text-[16px] font-bold">{s.v}</div>
          <div className="text-[11px] text-hd-muted">{s.l}</div>
        </div>
      ))}
    </div>
  );
}

/** Zweispaltige Angaben (Schlüssel gedämpft links). */
export function Rows({ rows }: { rows: { k: string; v: ReactNode; dot?: string }[] }) {
  return (
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-1.5 text-[13px]">
      {rows.map((r) => (
        <div key={r.k} className="contents">
          <dt className="text-hd-muted">{r.k}</dt>
          <dd className="flex min-w-0 items-center gap-[7px] break-words">
            {r.dot && (
              <span
                aria-hidden
                className="h-[9px] w-[9px] flex-none rounded-full"
                style={{ background: r.dot }}
              />
            )}
            {r.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Fehlermeldung in Tafeln (Plan Abschnitt 3: Fehler gehören in die Tafel, nicht in ein Popup). */
export function TafelError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-hd-ctl bg-hd-danger-soft px-3 py-2 text-[13px] text-hd-danger"
    >
      {children}
    </p>
  );
}

export const primaryBtn = "hd-btn hd-btn-primary";
export const chipBtn = "hd-btn hd-btn-ghost";
export const dangerBtn = "hd-btn hd-btn-danger !px-1";

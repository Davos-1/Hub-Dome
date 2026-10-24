"use client";

import { useEffect, useRef, useState } from "react";

const btn =
  "flex cursor-pointer items-center gap-2 rounded-hd-ctl border bg-hd-surface px-[11px] py-[7px] font-semibold whitespace-nowrap text-hd-ink hover:bg-hd-raised";
const key = "hd-mono text-[10.5px] text-hd-faint";

/**
 * Oben rechts (Phase 4h): Bauen (B), Liste (L), Inventar (I), Suche (⌘K) und Profil «G» mit Menü.
 * Besucher sehen Liste und Suche.
 */
export function TopRight({
  isOwner,
  listOpen,
  invOpen,
  initial,
  username,
  onBuild,
  onList,
  onInv,
  onSearch,
  onSettings,
  logout,
}: {
  isOwner: boolean;
  listOpen: boolean;
  invOpen: boolean;
  initial: string;
  username: string;
  onBuild?: () => void;
  onList: () => void;
  onInv: () => void;
  onSearch: () => void;
  onSettings: () => void;
  /** Server Action «Abmelden». */
  logout: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenu(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menu]);

  return (
    <div className="pointer-events-auto absolute top-3.5 right-3.5 flex gap-1.5 text-[12.5px]">
      {isOwner && onBuild && (
        <button
          type="button"
          onClick={onBuild}
          className={`${btn} border-hd-line max-md:hidden`}
          aria-keyshortcuts="B"
        >
          Bauen <span className={key}>B</span>
        </button>
      )}
      <button
        type="button"
        onClick={onList}
        aria-pressed={listOpen}
        aria-keyshortcuts="L"
        className={`${btn} ${listOpen ? "border-hd-accent" : "border-hd-line"}`}
      >
        Liste <span className={key}>L</span>
      </button>
      {isOwner && (
        <button
          type="button"
          onClick={onInv}
          aria-pressed={invOpen}
          aria-keyshortcuts="I"
          className={`${btn} ${invOpen ? "border-hd-accent" : "border-hd-line"} max-md:hidden`}
        >
          Inventar <span className={key}>I</span>
        </button>
      )}
      <button
        type="button"
        onClick={onSearch}
        aria-label="Suchen (Strg+K)"
        title="Suchen (Strg+K)"
        aria-keyshortcuts="Control+K Meta+K"
        className={`${btn} border-hd-line`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
        <span className={`${key} max-md:hidden`}>⌘K</span>
      </button>
      <div ref={box} className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-haspopup="menu"
          aria-label="Profil"
          className="h-[34px] w-[34px] cursor-pointer rounded-full border border-hd-line bg-hd-surface font-bold text-hd-ink hover:bg-hd-raised"
        >
          {initial}
        </button>
        {menu && (
          <div
            role="menu"
            className="hd-rise absolute top-[42px] right-0 flex w-[230px] flex-col rounded-hd-panel border border-hd-line bg-hd-surface p-1.5 shadow-hd-panel"
          >
            <span className="px-2.5 py-2 text-[12px] text-hd-muted">
              Angemeldet als @{username}
            </span>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onSettings();
              }}
              className="cursor-pointer rounded-hd-ctl px-2.5 py-2 text-left hover:bg-hd-raised"
            >
              Einstellungen
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="cursor-pointer rounded-hd-ctl px-2.5 py-2 text-left hover:bg-hd-raised"
            >
              Abmelden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

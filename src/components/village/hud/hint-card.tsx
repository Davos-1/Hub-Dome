"use client";

import { useSyncExternalStore } from "react";

const KEY = "hubdome-hinweis-4h";
const listeners = new Set<() => void>();

function seen() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

/** Hinweis-Karte beim ersten Besuch (drei Sätze, «Verstanden»); gemerkt im Browser. */
export function HintCard({ left, hidden }: { left: number; hidden: boolean }) {
  const done = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    seen,
    () => true,
  );
  if (done || hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* Speicher nicht verfügbar: gilt nur für diese Sitzung */
    }
    listeners.forEach((fn) => fn());
  };
  return (
    <aside
      aria-label="So funktioniert es"
      className="hd-rise pointer-events-auto absolute bottom-4 flex w-[300px] flex-col gap-2 rounded-hd-panel border border-hd-line bg-hd-surface px-4 py-3.5 text-[13px] text-hd-ink shadow-hd-panel max-md:hidden max-[1180px]:bottom-[76px]"
      style={{ left: left + 26 }}
    >
      <span className="hd-kicker">So funktioniert es</span>
      <span>
        <b>Haus anklicken</b> · Aktionen erscheinen am Haus
      </span>
      <span>
        <b>Griff am linken Rand</b> ziehen · alle Objekte als Liste
      </span>
      <span>
        <b>Weit herauszoomen</b> · Inventar zum Aufräumen
      </span>
      <button
        type="button"
        onClick={close}
        className="mt-0.5 cursor-pointer self-start rounded-hd-ctl bg-hd-chip px-3 py-1.5 text-[12.5px] font-semibold"
      >
        Verstanden
      </button>
    </aside>
  );
}

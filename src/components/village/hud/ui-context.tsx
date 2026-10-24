"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Gemeinsame Hilfen der Oberfläche (Phase 4h): Hinweis unten («Gespeichert», «Objekt gelöscht · Rückgängig»)
 * und verzögertes Löschen. Gelöschtes verschwindet sofort aus der Welt (lokal ausgeblendet) und wird erst nach
 * Ablauf des Hinweises an den Server geschickt; «Rückgängig» holt es zurück, ohne dass etwas verloren ging.
 * Beim Verlassen der Seite wird Ausstehendes sofort geschickt.
 */

type Toast = { id: number; text: string; undo?: () => void; error?: boolean };
type Pending = { commit: () => void; ids: string[] };

type Ui = {
  /** Kurzer Hinweis; mit `undo` erscheint «Rückgängig». */
  say: (text: string, opts?: { undo?: () => void; error?: boolean }) => void;
  /**
   * Erst ausblenden, nach `ms` ausführen (Server). «Rückgängig» blendet wieder ein und führt nichts aus.
   * `ids`: Häuser bzw. Objekte, die bis dahin in der Welt fehlen.
   */
  deferred: (text: string, ids: string[], commit: () => void, ms?: number) => void;
  hidden: ReadonlySet<string>;
  toast: Toast | null;
  dismiss: () => void;
};

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const flush = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    if (p) p.commit();
  }, []);

  const show = useCallback((t: Omit<Toast, "id">, ms: number, onEnd?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ ...t, id });
    timer.current = setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
      onEnd?.();
    }, ms);
  }, []);

  const say = useCallback<Ui["say"]>(
    (text, opts) => {
      flush();
      show({ text, undo: opts?.undo, error: opts?.error }, opts?.error ? 6000 : 3800);
    },
    [flush, show],
  );

  const deferred = useCallback<Ui["deferred"]>(
    (text, ids, commit, ms = 5000) => {
      flush();
      setHidden((h) => new Set([...h, ...ids]));
      pending.current = { commit, ids };
      const undo = () => {
        if (pending.current?.ids === ids) pending.current = null;
        setHidden((h) => new Set([...h].filter((x) => !ids.includes(x))));
        if (timer.current) clearTimeout(timer.current);
        setToast(null);
      };
      show({ text, undo }, ms, flush);
    },
    [flush, show],
  );

  // Seite verlassen bzw. Ansicht weg: Ausstehendes sofort ausführen
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const dismiss = useCallback(() => setToast(null), []);
  const value = useMemo(
    () => ({ say, deferred, hidden, toast, dismiss }),
    [say, deferred, hidden, toast, dismiss],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useUi ausserhalb von UiProvider");
  return ui;
}

/** Hinweis unten in der Mitte (dunkle Schrift auf heller Fläche wie im Prototyp). */
export function ToastView() {
  const { toast, dismiss } = useUi();
  if (!toast) return null;
  return (
    <div
      role={toast.error ? "alert" : "status"}
      className="hd-rise pointer-events-auto absolute bottom-[78px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-3.5 rounded-hd-panel bg-hd-ink py-2.5 pr-3.5 pl-4 text-[13px] font-semibold whitespace-nowrap text-hd-surface shadow-hd-panel"
    >
      <span className={toast.error ? "text-hd-danger-ink" : undefined}>{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            dismiss();
          }}
          className="cursor-pointer font-bold text-hd-accent"
        >
          Rückgängig
        </button>
      )}
    </div>
  );
}

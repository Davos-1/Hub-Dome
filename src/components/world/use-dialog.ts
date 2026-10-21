"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { DIALOG_IDS, type DialogId } from "./dialog-ids";

export type { DialogId };

export type DialogState = {
  id: DialogId | null;
  /** Unterseite (Tab) des Dialogs, z.B. `dorf` bei den Einstellungen. */
  tab: string | null;
  /** Haus, auf das sich «Objekt hinzufügen» bezieht. */
  houseId: string | null;
};

/**
 * Welcher Dialog offen ist, steht in der URL (`?d=reise&t=teilen`): Zurück-Taste, Neuladen und Links
 * funktionieren. Öffnen und Schliessen ändern nur die Adresszeile (`history`), laden die Seite nicht neu.
 */
export function useDialog() {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get("d");
  const id = (DIALOG_IDS as readonly string[]).includes(raw ?? "") ? (raw as DialogId) : null;
  const tab = params.get("t");
  const houseId = params.get("h");

  const state: DialogState = useMemo(() => ({ id, tab, houseId }), [id, tab, houseId]);

  const open = useCallback(
    (next: DialogId, extra: { tab?: string; houseId?: string } = {}) => {
      const q = new URLSearchParams({ d: next });
      if (extra.tab) q.set("t", extra.tab);
      if (extra.houseId) q.set("h", extra.houseId);
      window.history.pushState(null, "", `${pathname}?${q.toString()}`);
    },
    [pathname],
  );

  const close = useCallback(() => {
    window.history.replaceState(null, "", pathname);
  }, [pathname]);

  /** Wechselt den Tab, ohne einen neuen Verlaufseintrag anzulegen. */
  const setTab = useCallback(
    (next: string) => {
      const q = new URLSearchParams(window.location.search);
      q.set("t", next);
      window.history.replaceState(null, "", `${pathname}?${q.toString()}`);
    },
    [pathname],
  );

  return { ...state, open, close, setTab };
}

export type DialogApi = ReturnType<typeof useDialog>;

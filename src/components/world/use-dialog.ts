"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DIALOG_IDS, type DialogId } from "./dialog-ids";

export type { DialogId };

export type DialogState = {
  id: DialogId | null;
  /** Unterseite (Tab) des Dialogs, z.B. `dorf` bei den Einstellungen. */
  tab: string | null;
  /** Haus, auf das sich «Objekt hinzufügen» bzw. «Haus bearbeiten» bezieht. */
  houseId: string | null;
  /** Objekt, das bearbeitet wird. */
  objectId: string | null;
};

function fromParams(params: URLSearchParams): DialogState {
  const raw = params.get("d");
  const id = (DIALOG_IDS as readonly string[]).includes(raw ?? "") ? (raw as DialogId) : null;
  return { id, tab: params.get("t"), houseId: params.get("h"), objectId: params.get("o") };
}

/**
 * Welcher Dialog offen ist, steht in der URL (`?d=reise&t=freunde`): Zurück-Taste, Neuladen und Links
 * funktionieren. Öffnen und Schliessen ändern die Adresszeile (`history`) und merken den Zustand zusätzlich
 * in React, damit eine nachträglich neu gelieferte Seite (nach einer Server Action) den Dialog nicht wieder öffnet.
 */
export function useDialog() {
  const params = useSearchParams();
  const pathname = usePathname();
  // Lokaler Zustand gilt pro Seite (Pfad); beim Wechsel in ein anderes Dorf zählt wieder die URL
  const [local, setLocal] = useState<{ path: string; state: DialogState } | null>(null);

  const fromUrl = useMemo(() => fromParams(new URLSearchParams(params.toString())), [params]);
  const state = local && local.path === pathname ? local.state : fromUrl;

  // Zurück-/Vorwärts-Taste: Zustand aus der Adresszeile lesen
  useEffect(() => {
    const onPop = () =>
      setLocal({
        path: window.location.pathname,
        state: fromParams(new URLSearchParams(window.location.search)),
      });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback(
    (next: DialogId, extra: { tab?: string; houseId?: string; objectId?: string } = {}) => {
      const q = new URLSearchParams({ d: next });
      if (extra.tab) q.set("t", extra.tab);
      if (extra.houseId) q.set("h", extra.houseId);
      if (extra.objectId) q.set("o", extra.objectId);
      window.history.pushState(null, "", `${pathname}?${q.toString()}`);
      setLocal({ path: pathname, state: fromParams(q) });
    },
    [pathname],
  );

  const close = useCallback(() => {
    window.history.replaceState(null, "", pathname);
    setLocal({ path: pathname, state: fromParams(new URLSearchParams()) });
  }, [pathname]);

  /** Wechselt den Tab, ohne einen neuen Verlaufseintrag anzulegen. */
  const setTab = useCallback(
    (next: string) => {
      const q = new URLSearchParams(window.location.search);
      q.set("t", next);
      window.history.replaceState(null, "", `${pathname}?${q.toString()}`);
      setLocal({ path: pathname, state: fromParams(q) });
    },
    [pathname],
  );

  return { ...state, open, close, setTab };
}

export type DialogApi = ReturnType<typeof useDialog>;

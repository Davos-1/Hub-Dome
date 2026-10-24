"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { copyArtifact, type CopyState } from "@/app/dorf/actions";
import { FACHBEREICHE, FACH_ORDER, fachbereichOf } from "@/lib/fachbereiche";
import { EMPTY_EXTRAS, type ItemExtras } from "@/lib/item-extras";
import type { Artifact, House } from "@/lib/types";

type Ctx = ItemExtras & { isOwner: boolean; houses: Record<string, House> };

const ExtrasContext = createContext<Ctx>({ ...EMPTY_EXTRAS, isOwner: false, houses: {} });

export function ItemExtrasProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>;
}

/** Zusatzangaben (Nutzungszahlen, eigene Häuser, Besitz) für Tafeln, Liste und Inventar. */
export const useItemExtras = () => useContext(ExtrasContext);

/** Öffnen-Link, der das Öffnen zählt. Bewusst kein `next/link` (Prefetch würde mitzählen). */
export const openHref = (a: Pick<Artifact, "id">) => `/o/${a.id}`;

/** Herkunft («übernommen von», «basiert auf») und für den Besitzer die Nutzungszahlen. */
export function ItemMeta({ artifact }: { artifact: Artifact }) {
  const x = useContext(ExtrasContext);
  const stats = x.stats[artifact.id];
  const src = artifact.source_owner_id ? x.sources[artifact.source_owner_id] : undefined;
  const who = src ? (
    src.canVisit ? (
      <a href={`/dorf/${src.username}`} className="underline">
        @{src.username}
      </a>
    ) : (
      <>@{src.username}</>
    )
  ) : null;

  let origin: ReactNode = null;
  if (artifact.is_copy) {
    origin =
      artifact.source_artifact_id && who ? <>übernommen von {who}</> : <>Original entfernt</>;
  } else if (who) {
    origin = <>basiert auf {who}</>;
  }
  if (!origin && !(x.isOwner && stats)) return null;
  return (
    <p className="hd-note flex flex-wrap gap-x-2 gap-y-1">
      {origin && (
        <span className="rounded-full bg-hd-info-soft px-2 py-0.5 text-[11px] font-semibold text-hd-info-ink">
          {origin}
        </span>
      )}
      {x.isOwner && stats && !artifact.is_copy && (
        <span>
          Von {stats.geoeffnet} {stats.geoeffnet === 1 ? "Person" : "Personen"} geöffnet ·{" "}
          {stats.uebernommen}× übernommen
        </span>
      )}
    </p>
  );
}

/**
 * «In mein Dorf» für fremde Objekte: Popover mit Hausauswahl. Mit `hotkey` öffnet auch die Taste K
 * das Popover (nur wenn kein Eingabefeld und kein Dialog den Fokus hat).
 */
export function CopyControl({
  artifact,
  hotkey = false,
}: {
  artifact: Artifact;
  hotkey?: boolean;
}) {
  const x = useContext(ExtrasContext);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CopyState, FormData>(copyArtifact, {});

  const blocked = x.isOwner || artifact.is_copy || artifact.allow_copy === false;
  const copiedId = x.copiedByUrl[artifact.url];

  useEffect(() => {
    if (!hotkey || blocked || copiedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector("[data-hd-dialog]")) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, blocked, copiedId]);

  if (x.isOwner || artifact.is_copy) return null;
  if (state.ok || copiedId) {
    return (
      <p className="hd-note" role="status">
        {state.ok ? `In «${state.houseTitle}» übernommen` : "Schon in deinem Dorf"} ·{" "}
        <a href={`/dorf/${x.myUsername}`} className="underline">
          Ansehen
        </a>
      </p>
    );
  }
  if (artifact.allow_copy === false) {
    return <p className="hd-note">Besitzer hat Übernehmen deaktiviert</p>;
  }

  // Vorschlag: eigenes Haus mit gleichem Modul, sonst «Haus anlegen und übernehmen»
  const srcHouse = x.houses[artifact.house_id];
  const code = srcHouse?.module_code ?? null;
  const match = code ? x.myHouses.find((h) => h.module_code === code) : undefined;
  const others = x.myHouses.filter((h) => h !== match);
  const groups = FACH_ORDER.map((f) => ({
    f,
    list: others.filter((h) => fachbereichOf(h) === f),
  })).filter((g) => g.list.length);

  const option = (value: string, label: ReactNode, primary = false) => (
    <button
      key={value}
      type="submit"
      name="house"
      value={value}
      disabled={pending}
      className={`w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13.5px] ${
        primary ? "bg-hd-accent font-semibold text-hd-accent-ink" : "hover:bg-hd-hover"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-keyshortcuts={hotkey ? "K" : undefined}
        onClick={() => setOpen((o) => !o)}
        className="hd-btn hd-btn-ghost w-full"
      >
        In mein Dorf{hotkey && <span className="hd-note ml-1">(K)</span>}
      </button>
      {open && (
        <form
          action={action}
          aria-label="Haus wählen"
          className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-xl border-[1.5px] border-hd-line bg-hd-raised p-2"
        >
          <input type="hidden" name="source" value={artifact.id} />
          {match && option(match.id, <>Vorschlag: {match.title}</>, true)}
          {!match &&
            code &&
            srcHouse &&
            option(`neu:${code}`, <>Haus «{srcHouse.title}» anlegen und übernehmen</>, true)}
          {groups.map((g) => (
            <div key={g.f} className="mt-1">
              <div className="hd-label px-2.5">{FACHBEREICHE[g.f].name}</div>
              {g.list.map((h) => option(h.id, h.title))}
            </div>
          ))}
          {!match && !code && others.length === 0 && (
            <p className="hd-note p-2">Lege zuerst ein Haus in deinem Dorf an.</p>
          )}
          {state.error && (
            <p role="alert" className="p-2 text-[13px] text-hd-danger">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

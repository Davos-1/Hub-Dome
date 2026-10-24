"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FACHBEREICHE } from "@/lib/fachbereiche";
import { ARTIFACT_KIND_LABELS } from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { KIND_COLORS } from "../colors";

export type Command = { id: string; label: string; hint?: string; run: () => void };

type Hit =
  | { kind: "haus"; id: string; label: string; sub: string; color: string; run: () => void }
  | { kind: "objekt"; id: string; label: string; sub: string; color: string; run: () => void }
  | { kind: "befehl"; id: string; label: string; sub: string; run: () => void };

const norm = (s: string) => s.toLocaleLowerCase("de-CH").normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Befehlspalette (Plan Abschnitt 3 Nr. 2; Strg+K bzw. ⌘K, auch «/»): Häuser, Objekte und Befehle in einem Feld.
 * Pfeiltasten wählen, Enter führt aus, Esc schliesst; der Fokus kehrt zum Auslöser zurück.
 */
export function CommandPalette({
  model,
  commands,
  onHouse,
  onObject,
  onClose,
}: {
  model: VillageModel;
  commands: Command[];
  onHouse: (id: string) => void;
  onObject: (houseId: string, id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const n = norm(q.trim());
    const match = (...s: string[]) => !n || s.some((x) => norm(x).includes(n));
    const houses: Hit[] = model.houses
      .filter((h) => match(h.title, h.code, h.kind === "zentrale" ? "Zentrale" : ""))
      .slice(0, n ? 6 : 4)
      .map((h) => ({
        kind: "haus",
        id: h.id,
        label: h.kind === "zentrale" ? "Zentrale" : h.title,
        sub: h.kind === "zentrale" ? "Mitte des Dorfs" : FACHBEREICHE[h.fach].name,
        color: h.color,
        run: () => onHouse(h.id),
      }));
    const objects: Hit[] = n
      ? model.houses
          .flatMap((h) => h.items.map((o) => ({ o, h })))
          .filter(({ o, h }) => match(o.title, h.title, ARTIFACT_KIND_LABELS[o.kind]))
          .slice(0, 8)
          .map(({ o, h }) => ({
            kind: "objekt",
            id: o.id,
            label: o.title,
            sub: `${ARTIFACT_KIND_LABELS[o.kind]} · ${h.kind === "zentrale" ? "Zentrale" : h.title}`,
            color: KIND_COLORS[o.kind],
            run: () => onObject(h.id, o.id),
          }))
      : [];
    const cmds: Hit[] = commands
      .filter((c) => match(c.label))
      .map((c) => ({ kind: "befehl", id: c.id, label: c.label, sub: c.hint ?? "", run: c.run }));
    return [...houses, ...objects, ...cmds];
  }, [q, model, commands, onHouse, onObject]);

  const run = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    h.run();
  };
  const sel = Math.min(active, Math.max(0, hits.length - 1));
  const groups: [Hit["kind"], string][] = [
    ["haus", "Häuser"],
    ["objekt", "Objekte"],
    ["befehl", "Befehle"],
  ];

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-start justify-center px-4 pt-[12vh]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const d = e.key === "ArrowDown" ? 1 : -1;
          setActive((a) =>
            hits.length ? (Math.min(a, hits.length - 1) + d + hits.length) % hits.length : 0,
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          run(hits[sel]);
        }
      }}
    >
      <div className="hd-fade-in absolute inset-0 bg-hd-scrim" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Suchen"
        data-hd-dialog
        className="hd-box hd-pop-in relative flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-hd-line px-4 py-3">
          <span aria-hidden className="text-hd-faint">
            ⌕
          </span>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Haus, Objekt oder Befehl …"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              hits[sel] ? `${listId}-${hits[sel].kind}-${hits[sel].id}` : undefined
            }
            className="min-w-0 flex-1 bg-transparent text-[15px] text-hd-ink outline-none placeholder:text-hd-faint"
          />
          <span className="hd-mono text-[10.5px] text-hd-faint">Esc</span>
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label="Treffer"
          className="flex-1 overflow-y-auto p-1.5"
        >
          {groups.map(([kind, label]) => {
            const list = hits.filter((h) => h.kind === kind);
            if (!list.length) return null;
            return (
              <li key={kind} role="presentation">
                <span className="hd-kicker block px-2.5 pt-2 pb-1 !text-hd-faint">{label}</span>
                <ul role="presentation">
                  {list.map((h) => {
                    const idx = hits.indexOf(h);
                    const on = idx === sel;
                    return (
                      <li
                        key={h.id}
                        id={`${listId}-${h.kind}-${h.id}`}
                        role="option"
                        aria-selected={on}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => run(h)}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-hd-ctl px-2.5 py-2 ${on ? "bg-hd-accent-soft" : ""}`}
                      >
                        {"color" in h ? (
                          <span
                            aria-hidden
                            className={`h-[9px] w-[9px] flex-none ${h.kind === "haus" ? "rounded-[2px]" : "rounded-full"}`}
                            style={{ background: h.color }}
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="w-[9px] flex-none text-center text-[11px] text-hd-faint"
                          >
                            ›
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                          {h.label}
                        </span>
                        <span className="flex-none truncate text-[12px] text-hd-muted">
                          {h.sub}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {hits.length === 0 && (
            <li className="p-4 text-[13px] text-hd-muted" role="presentation">
              Nichts gefunden. Versuche einen anderen Begriff.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

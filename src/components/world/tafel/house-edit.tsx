"use client";

import { useState, useTransition } from "react";
import { updateHouse } from "@/app/dorf/actions";
import { Chip, ColorSwatches } from "@/components/ui/controls";
import { PanelBody, PanelFooter } from "@/components/ui/panel";
import { FACHBEREICHE, FACH_ORDER, fachbereichOf, type FachbereichId } from "@/lib/fachbereiche";
import { HOUSE_COLORS, HOUSE_COLOR_NAMES, isHouseColor } from "@/lib/house-colors";
import type { House } from "@/lib/types";
import { dangerBtn, primaryBtn, TafelError } from "./shared";

/** Kleines Haus wie im Prototyp: Kasten mit Farbstreifen oben, Name darunter, Quartier und Semester. */
export function HousePreview({
  name,
  color,
  quarter,
  semester,
}: {
  name: string;
  color: string;
  quarter: string;
  semester: number | null;
}) {
  return (
    <div
      className="hd-hatch-world relative flex h-[118px] items-center justify-center rounded-[12px]"
      aria-hidden
    >
      <span className="hd-mono absolute top-[9px] left-2.5 text-[10px] tracking-[0.1em] text-hd-faint uppercase">
        {quarter}
      </span>
      <div className="relative h-14 w-[110px] rounded-[3px] border border-hd-line-strong bg-hd-chip transition-all">
        <span
          className="absolute inset-x-0 top-0 h-1.5 transition-colors"
          style={{ background: color }}
        />
        <span className="hd-mono absolute top-full left-1/2 mt-1.5 max-w-[220px] -translate-x-1/2 truncate text-[10.5px] whitespace-nowrap text-hd-ink-2">
          {name}
        </span>
      </div>
      {semester && (
        <span className="hd-mono absolute top-[9px] right-2.5 text-[10px] text-hd-faint">
          {semester}. SEMESTER
        </span>
      )}
    </div>
  );
}

/**
 * Tafel «Haus bearbeiten» (9b): Miniatur-Vorschau (Titel, Farbe, Quartier, Semester live), acht feste Farben,
 * Quartierwahl, Semester 1–8; Löschen von Haus und Objekten mit Rückgängig. Zieht das Haus in ein anderes
 * Quartier, sucht es sich dort einen freien Platz (die Kamera fliegt mit).
 */
export function HouseEdit({
  house,
  objectCount,
  onSaved,
  onDelete,
}: {
  house: House;
  objectCount: number;
  onSaved: (moved: FachbereichId | null) => void;
  onDelete: () => void;
}) {
  const current = fachbereichOf(house);
  const [title, setTitle] = useState(house.title);
  const [color, setColor] = useState<string | null>(
    isHouseColor(house.color) ? house.color.toLowerCase() : null,
  );
  const [quarter, setQuarter] = useState<FachbereichId>(current);
  const [semester, setSemester] = useState<number | null>(house.semester);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const sems = [
    null,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    ...(house.semester && house.semester > 8 ? [house.semester] : []),
  ];

  const save = () => {
    if (!title.trim()) return setErr("Der Titel fehlt.");
    if (!color) return setErr("Bitte eine Farbe wählen.");
    const fd = new FormData();
    fd.set("id", house.id);
    fd.set("title", title.trim());
    fd.set("color", color);
    fd.set("semester", semester ? String(semester) : "");
    if (quarter !== current) fd.set("quarter", quarter);
    start(async () => {
      const res = await updateHouse({}, fd);
      if (res.error) return setErr(res.error);
      onSaved(quarter !== current ? quarter : null);
    });
  };

  return (
    <>
      <div className="pt-4 pr-[18px] pl-5">
        <HousePreview
          name={title.trim() || "Ohne Titel"}
          color={color ?? house.color}
          quarter={FACHBEREICHE[quarter].name}
          semester={semester}
        />
      </div>
      <PanelBody>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-hd-muted">Titel</span>
          <input
            value={title}
            onChange={(e) => {
              setErr("");
              setTitle(e.target.value);
            }}
            maxLength={80}
            data-autofocus
            className="hd-input"
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] text-hd-muted">Farbe</span>
          <ColorSwatches
            label="Farbe"
            colors={HOUSE_COLORS}
            names={HOUSE_COLORS.map((c) => HOUSE_COLOR_NAMES[c])}
            value={color}
            onPick={(c) => {
              setErr("");
              setColor(c);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] text-hd-muted" id="quarter-label">
            Quartier
          </span>
          <div role="group" aria-labelledby="quarter-label" className="flex flex-wrap gap-[5px]">
            {FACH_ORDER.map((q) => (
              <Chip key={q} on={quarter === q} onClick={() => setQuarter(q)}>
                {FACHBEREICHE[q].name}
              </Chip>
            ))}
          </div>
          <span className="text-[11.5px] text-hd-faint">
            Das Haus zieht beim Speichern ins gewählte Quartier.
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] text-hd-muted" id="sem-label">
            Semester
          </span>
          <div
            role="radiogroup"
            aria-labelledby="sem-label"
            className="flex gap-1 rounded-hd-ctl bg-hd-field p-[3px]"
          >
            {sems.map((v) => {
              const on = semester === v;
              return (
                <button
                  key={v ?? 0}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={v ? `${v}. Semester` : "Kein Semester"}
                  onClick={() => setSemester(v)}
                  className={`flex-1 cursor-pointer rounded-hd-ctl py-1.5 text-[12.5px] font-semibold ${
                    on ? "bg-hd-ink text-hd-surface" : "text-hd-ink-2 hover:text-hd-ink"
                  }`}
                >
                  {v ?? "–"}
                </button>
              );
            })}
          </div>
        </div>
        <TafelError>{err}</TafelError>
      </PanelBody>
      <PanelFooter>
        <button type="button" onClick={onDelete} className={dangerBtn}>
          {objectCount ? `Haus und ${objectCount} Objekte löschen` : "Haus löschen"}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={pending} className={primaryBtn}>
          {pending ? "Speichere …" : "Speichern"}
        </button>
      </PanelFooter>
    </>
  );
}

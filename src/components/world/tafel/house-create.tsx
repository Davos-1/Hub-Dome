"use client";

import { useMemo, useState, useTransition } from "react";
import { createHouse } from "@/app/dorf/actions";
import { Chip, ColorSwatches, Segment } from "@/components/ui/controls";
import { PanelBody, PanelFooter } from "@/components/ui/panel";
import { FACHBEREICHE, FACH_ORDER, fachbereichOf, type FachbereichId } from "@/lib/fachbereiche";
import { defaultHouseColor, HOUSE_COLORS, HOUSE_COLOR_NAMES } from "@/lib/house-colors";
import type { ModuleOption } from "@/lib/types";
import { HousePreview } from "./house-edit";
import { primaryBtn, TafelError } from "./shared";

/**
 * Tafel «Haus anlegen» (Plan Abschnitt 3 Nr. 1): Modul aus dem Katalog (Suche, nach Fachbereich gruppiert) oder
 * eigenes Thema; Vorschau wie «Haus bearbeiten». Das neue Haus steht als Baustelle im gewählten Quartier.
 */
export function HouseCreate({
  modules,
  usedCodes,
  presetQuarter,
  onCreated,
}: {
  modules: ModuleOption[];
  /** Module, für die es schon ein Haus gibt. */
  usedCodes: ReadonlySet<string>;
  presetQuarter?: FachbereichId;
  onCreated: (id: string | null, title: string, quarter: FachbereichId) => void;
}) {
  const [kind, setKind] = useState<"modul" | "thema">("modul");
  const [query, setQuery] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [quarter, setQuarter] = useState<FachbereichId | null>(presetQuarter ?? null);
  const [color, setColor] = useState<string | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = modules.filter(
      (m) => !q || m.title.toLowerCase().includes(q) || m.code.toLowerCase().includes(q),
    );
    return FACH_ORDER.map((f) => ({
      f,
      list: list.filter((m) => fachbereichOf({ kind: "modul", module_code: m.code }) === f),
    })).filter((g) => g.list.length);
  }, [modules, query]);

  const mod = modules.find((m) => m.code === code);
  const naturalQuarter: FachbereichId = mod
    ? fachbereichOf({ kind: "modul", module_code: mod.code })
    : "weitere";
  const q = quarter ?? naturalQuarter;
  const shownColor = color ?? defaultHouseColor(q);
  const name =
    kind === "modul"
      ? ((title.trim() || mod?.title) ?? "Modul wählen")
      : title.trim() || "Neues Thema";

  const create = () => {
    if (kind === "modul" && !mod) return setErr("Bitte ein Modul wählen.");
    if (kind === "thema" && !title.trim())
      return setErr("Bitte einen Titel für das Themenhaus angeben.");
    const fd = new FormData();
    fd.set("kind", kind);
    if (mod) fd.set("moduleCode", mod.code);
    if (title.trim()) fd.set("title", title.trim());
    fd.set("color", shownColor);
    fd.set("semester", semester ? String(semester) : "");
    if (q !== naturalQuarter) fd.set("quarter", q);
    start(async () => {
      const res = await createHouse({}, fd);
      if (res.error) return setErr(res.error);
      onCreated(res.id ?? null, name, q);
    });
  };

  return (
    <>
      <div className="pt-4 pr-[18px] pl-5">
        <HousePreview
          name={name}
          color={shownColor}
          quarter={FACHBEREICHE[q].name}
          semester={semester}
        />
      </div>
      <PanelBody>
        <Segment
          label="Art des Hauses"
          value={kind}
          stretch
          onPick={(v) => {
            setErr("");
            setKind(v);
          }}
          options={[
            { value: "modul", label: "Modul aus dem Katalog" },
            { value: "thema", label: "Eigenes Thema" },
          ]}
        />
        {kind === "modul" ? (
          <div className="flex flex-col gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Modul suchen …"
              aria-label="Modul suchen"
              data-autofocus
              className="hd-input"
            />
            <div className="flex max-h-60 flex-col gap-2 overflow-y-auto rounded-hd-ctl border border-hd-line p-1.5">
              {groups.map((g) => (
                <div key={g.f} className="flex flex-col">
                  <span className="hd-kicker px-2 pt-1.5 pb-1 !text-hd-faint">
                    {FACHBEREICHE[g.f].name}
                  </span>
                  {g.list.map((m) => {
                    const used = usedCodes.has(m.code);
                    const on = m.code === code;
                    return (
                      <button
                        key={m.code}
                        type="button"
                        disabled={used}
                        aria-pressed={on}
                        onClick={() => {
                          setErr("");
                          setCode(m.code);
                          setQuarter(presetQuarter ?? null);
                        }}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-hd-ctl px-2.5 py-1.5 text-left text-[13px] disabled:cursor-default disabled:opacity-45 ${
                          on ? "bg-hd-accent text-hd-accent-ink" : "hover:bg-hd-raised"
                        }`}
                      >
                        <span className="min-w-0 truncate">{m.title}</span>
                        <span
                          className={`hd-mono flex-none text-[10.5px] ${on ? "" : "text-hd-faint"}`}
                        >
                          {used ? "schon im Dorf" : m.code.replace(/^TA\.(BA|MAA)_/, "")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {groups.length === 0 && (
                <p className="p-2 text-[13px] text-hd-muted">Kein Modul gefunden.</p>
              )}
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-hd-muted">Titel</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="z.B. Bachelorarbeit"
              className="hd-input"
            />
          </label>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] text-hd-muted">Farbe</span>
          <ColorSwatches
            label="Farbe"
            colors={HOUSE_COLORS}
            names={HOUSE_COLORS.map((c) => HOUSE_COLOR_NAMES[c])}
            value={shownColor}
            onPick={setColor}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] text-hd-muted">Quartier</span>
          <div className="flex flex-wrap gap-[5px]">
            {FACH_ORDER.map((f) => (
              <Chip key={f} on={q === f} onClick={() => setQuarter(f)}>
                {FACHBEREICHE[f].name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] text-hd-muted">Semester</span>
          <Segment
            label="Semester"
            value={semester}
            stretch
            size="sm"
            onPick={setSemester}
            options={[null, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({
              value: v,
              label: v ?? "–",
              title: v ? `${v}. Semester` : "Kein Semester",
            }))}
          />
        </div>
        <TafelError>{err}</TafelError>
      </PanelBody>
      <PanelFooter>
        <span className="flex-1 text-[12px] text-hd-muted">Landet als Baustelle im Quartier.</span>
        <button type="button" onClick={create} disabled={pending} className={primaryBtn}>
          {pending ? "Lege an …" : "Haus anlegen"}
        </button>
      </PanelFooter>
    </>
  );
}

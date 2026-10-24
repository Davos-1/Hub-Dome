"use client";

/**
 * Besuchsband (Phase 4h): oben in der Mitte, solange man ein fremdes Dorf ansieht. Ersetzt das frühere
 * Willkommens-Banner; bleibt stehen (nicht nach Sekunden weg), damit der Weg zurück immer sichtbar ist.
 */
export function VisitBand({
  villageName,
  ownerName,
  onHome,
}: {
  villageName: string;
  ownerName: string;
  onHome: () => void;
}) {
  return (
    <div
      role="status"
      className="hd-rise pointer-events-auto absolute top-3.5 left-1/2 z-[4] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 rounded-hd-panel border border-hd-line bg-hd-box-top py-2 pr-2 pl-4 whitespace-nowrap shadow-hd-panel max-md:top-16"
    >
      <span className="hd-kicker max-lg:hidden">Du besuchst</span>
      <span
        className="min-w-0 truncate text-[14px] font-bold text-hd-ink"
        title={`Dorf von ${ownerName}`}
      >
        {villageName}
      </span>
      <span className="text-[12px] text-hd-muted max-lg:hidden">nur ansehen</span>
      <button
        type="button"
        onClick={onHome}
        className="cursor-pointer rounded-hd-ctl bg-hd-surface px-3 py-[7px] text-[12.5px] font-bold text-hd-ink hover:bg-hd-raised"
      >
        Zurück in mein Dorf
      </button>
    </div>
  );
}

/** Ladeanzeige während der Reise in ein anderes Dorf (Plan Abschnitt 3 Nr. 4). */
export function TravelLoader({ to }: { to: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-hd-scrim"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-hd-chip">
        <span className="hd-travel-bar block h-full w-1/3 bg-hd-accent-line" />
      </div>
      <div className="hd-box hd-rise flex flex-col items-center gap-1 px-6 py-4">
        <span className="hd-kicker">Reise</span>
        <span className="text-[15px] font-bold">Unterwegs zu @{to} …</span>
        <span className="text-[12.5px] text-hd-muted">Das Dorf wird aufgebaut.</span>
      </div>
    </div>
  );
}

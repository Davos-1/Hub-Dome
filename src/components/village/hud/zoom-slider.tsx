"use client";

import { useOverlay, type OverlayStore } from "../overlay-store";

/** Ab dieser Zoomstufe (ganz weit weg) führt weiteres Herauszoomen ins Inventar. */
export const ZOOM_END = 0.985;

/**
 * Zoomregler rechts (Phase 4h): halb durchsichtig, beim Darüberfahren voll. Plus, Spur mit Knopf (oben = nah),
 * Minus und am Ende «INV»: Herauszoomen bis zum Anschlag öffnet das Inventar. `over` (0–100) füllt den
 * Hinweis, solange am Anschlag weiter herausgezoomt wird.
 */
export function ZoomSlider({
  overlay,
  over,
  onInventory,
}: {
  overlay: OverlayStore;
  over: number;
  onInventory: () => void;
}) {
  const zoom = useOverlay(overlay, (s) => s.zoom);
  const atEnd = zoom >= ZOOM_END;
  const btn =
    "h-[34px] w-[34px] cursor-pointer rounded-hd-ctl border border-hd-line bg-hd-surface text-[16px] text-hd-ink hover:bg-hd-raised";
  return (
    <div className="pointer-events-auto absolute top-1/2 right-4 flex -translate-y-1/2 flex-col items-center gap-1.5 opacity-50 transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100 max-md:hidden">
      <button
        type="button"
        aria-label="Näher heran"
        className={btn}
        onClick={() => overlay.zoomBy(1 / 1.25)}
      >
        +
      </button>
      <div
        role="meter"
        aria-label="Zoom"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((1 - zoom) * 100)}
        className="relative flex h-[150px] w-[34px] justify-center rounded-full border border-hd-line bg-hd-surface"
      >
        <span className="absolute top-3 bottom-3 w-[3px] rounded-sm bg-hd-chip" />
        <span
          className="absolute h-3.5 w-3.5 rounded-full bg-hd-ink transition-[top] duration-300"
          style={{ top: 12 + zoom * 112 }}
        />
      </div>
      <button
        type="button"
        aria-label={atEnd ? "Inventar öffnen" : "Weiter weg"}
        className={btn}
        onClick={() => (atEnd ? onInventory() : overlay.zoomBy(1.25))}
      >
        −
      </button>
      <button
        type="button"
        onClick={onInventory}
        aria-label="Inventar"
        className={`hd-mono cursor-pointer rounded-hd-ctl border px-1.5 py-[5px] text-[9.5px] font-semibold tracking-[0.06em] ${
          atEnd
            ? "border-hd-accent bg-hd-accent text-hd-accent-ink"
            : "border-hd-line bg-hd-surface text-hd-muted"
        }`}
      >
        INV
      </button>
      {atEnd && over > 0 && (
        <div
          role="status"
          className="absolute right-[46px] bottom-0 flex w-[190px] flex-col gap-1.5 rounded-hd-ctl bg-hd-accent px-2.5 py-2 text-[12.5px] font-bold text-hd-accent-ink"
        >
          <span>Weiter zoomen → Inventar</span>
          <span className="h-[3px] overflow-hidden rounded-sm bg-hd-accent-strong">
            <span className="block h-full bg-hd-accent-ink" style={{ width: `${over}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}

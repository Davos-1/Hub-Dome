"use client";

import { useEffect, useState } from "react";

/**
 * Begrüssung beim Besuch eines fremden Dorfs: «Dorf von …» gross, mit Weg zurück ins eigene Dorf.
 * Blendet nach einigen Sekunden aus (nur der kleine Hinweis bleibt über die Brotkrumen erreichbar).
 */
export function WelcomeBanner({
  villageName,
  ownerName,
  ownerUsername,
  onHome,
}: {
  villageName: string;
  ownerName: string;
  ownerUsername: string;
  onHome: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(id);
  }, []);
  if (!visible) return null;
  return (
    <div
      role="status"
      className="hd-pop-in pointer-events-auto absolute top-16 left-1/2 z-10 flex w-[min(520px,calc(100vw-32px))] -translate-x-1/2 flex-col items-center gap-1 hd-float rounded-hd-panel px-6 py-4 text-center shadow-hd-panel"
    >
      <div className="font-mono text-[11.5px] tracking-[.08em] text-hd-muted uppercase">
        Du besuchst
      </div>
      <div className="text-2xl font-semibold text-hd-ink">Dorf von {ownerName}</div>
      <div className="text-[13px] text-hd-muted">
        «{villageName}» · @{ownerUsername} · nur zum Ansehen
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onHome}
          className="cursor-pointer rounded-lg bg-hd-accent px-3.5 py-2 text-[13px] font-semibold text-hd-accent-ink"
        >
          Zurück in mein Dorf
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="cursor-pointer rounded-lg bg-hd-sunken px-3.5 py-2 text-[13px] font-medium text-hd-ink-2"
        >
          Schliessen
        </button>
      </div>
    </div>
  );
}

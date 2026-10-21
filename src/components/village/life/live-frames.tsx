"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Hält die Szene lebendig, obwohl `frameloop="demand"` gilt: erzeugt mit begrenzter Bildrate neue Frames,
 * solange der Tab sichtbar ist. Ohne diese Komponente (z.B. bei «reduzierte Bewegung») rendert die Szene
 * nur bei Änderungen.
 */
export function LiveFrames({ enabled, fps }: { enabled: boolean; fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [enabled, fps, invalidate]);
  return null;
}

import type { Frame } from "@/lib/camera-poses";

/**
 * Flächen, die Suche, Brotkrumen, Leiste und Fenster über der Szene belegen (Pixel). Die Kamera passt Häuser
 * und Zentrale in den Rest ein. Muss zu den Klassen in `side-window.tsx` und `bottom-bar.tsx` passen.
 */
export const HUD = {
  /** Brotkrumen und Suche oben. */
  top: 64,
  /** Leiste unten samt Abstand. */
  bottom: 84,
  /** Fenster rechts (Desktop): Breite plus Abstände. */
  windowWidth: 380,
  windowGap: 12,
  /** Ab dieser Breite steht das Fenster rechts, darunter ist es ein Blatt unten. */
  sheetBelow: 768,
  /** Höhe des Blatts unten (Anteil der Bildhöhe). */
  sheetShare: 0.52,
} as const;

export const isSheet = (width: number) => width < HUD.sheetBelow;

/** Freier Ausschnitt in Normalkoordinaten (−1…1) für die Kamera. */
export function freeFrame(width: number, height: number, windowOpen: boolean): Frame {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let right = 0;
  let bottom: number = HUD.bottom;
  if (windowOpen) {
    if (isSheet(w)) bottom = Math.round(h * HUD.sheetShare) + HUD.windowGap;
    else right = Math.min(HUD.windowWidth, w - 2 * HUD.windowGap) + 2 * HUD.windowGap;
  }
  // Nie weniger als ein Drittel des Bildes (sehr kleine Fenster)
  right = Math.min(right, w * 0.6);
  bottom = Math.min(bottom, h * 0.66);
  return {
    left: -1,
    right: 1 - (2 * right) / w,
    top: 1 - (2 * HUD.top) / h,
    bottom: -1 + (2 * bottom) / h,
  };
}

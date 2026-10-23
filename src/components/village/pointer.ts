/** Grösste Mausbewegung (Pixel) zwischen Drücken und Loslassen, die noch als Klick zählt. */
const CLICK_MAX_DRAG = 5;

/** Klick statt Ziehen: wer die Kamera dreht, soll nichts anklicken. */
export function isClick(e: { delta: number }): boolean {
  return e.delta <= CLICK_MAX_DRAG;
}

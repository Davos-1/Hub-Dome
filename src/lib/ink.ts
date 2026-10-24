/**
 * Schrift auf einer Datenfarbe (Hausfarbe, Kategorie): hell oder dunkel nach relativer Leuchtdichte (WCAG),
 * wie im Prototyp (`inkFor`). Unbekannte Werte gelten als hell (dunkle Schrift).
 */
export function inkOn(hex: string): "dark" | "light" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "dark";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.22 ? "dark" : "light";
}

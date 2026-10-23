/** Weicher Übergang 0…1 (Smoothstep), z.B. für Gelände und Farbverläufe. */
export const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

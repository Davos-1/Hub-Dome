/**
 * Gelände: das Dorf liegt flach, ausserhalb steigen sanfte Hügel an (Waldrand).
 * Reine Funktionen, deterministisch.
 */

export const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Geländehöhe an (x, z) für ein Dorf mit Radius `extent`. Bis `extent + 9` flach. */
export function terrainHeight(x: number, z: number, extent: number): number {
  const r = Math.hypot(x, z);
  const s = smooth((r - (extent + 9)) / 18);
  if (s <= 0) return 0;
  return (
    s *
    (2.4 +
      1.4 * Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.11 - 0.7) +
      0.6 * Math.sin(x * 0.21 + z * 0.17))
  );
}

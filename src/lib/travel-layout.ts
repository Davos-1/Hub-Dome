import { HOUSE_COLORS } from "@/lib/house-colors";

/** Reine Funktionen der Reise-Inselkarte (Phase 4h): Aktivität, Inselfarbe, kollisionsfreie Lage. */

/** Aktivität 0–3 aus der letzten Änderung: unter 3 Tagen 3, unter 14 Tagen 2, unter 60 Tagen 1, sonst 0. */
export type Activity = 0 | 1 | 2 | 3;
export function activityOf(last: string | null, now: number): Activity {
  if (!last) return 0;
  const days = (now - Date.parse(last)) / 864e5;
  if (Number.isNaN(days)) return 0;
  return days < 3 ? 3 : days < 14 ? 2 : days < 60 ? 1 : 0;
}

/** Stabile Datenfarbe einer Insel aus der Dorf-ID (eine der acht Hausfarben). */
export function islandColor(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return HOUSE_COLORS[(h >>> 0) % HOUSE_COLORS.length];
}

export type PlacedIsland = { id: string; x: number; y: number; w: number };

const ANGLES = [-20, 200, -60, -120, 20, 160];

/**
 * Verteilt die Inseln der Freunde um das eigene Dorf wie im Prototyp: Abstand nach Aktivität, Winkel aus einer
 * festen Liste, bei Überlappung bis zu 24 Versuche mit anderem Winkel und Abstand, alles im Fenster gehalten.
 * Unten bleiben 300 px für die Karten frei.
 */
export function layoutIslands(
  friends: { id: string; houses: number; act: Activity }[],
  size: { width: number; height: number },
): { own: PlacedIsland; islands: PlacedIsland[] } {
  const { width: W, height: H } = size;
  const sc = Math.min(1, W / 1200, (H - 200) / 520);
  const k = Math.max(0.75, sc);
  const own: PlacedIsland = {
    id: "own",
    x: W * 0.5,
    y: Math.max(160, Math.min(H - 300, (H - 200) * 0.6)),
    w: 150 * k,
  };
  const placed: PlacedIsland[] = [own];
  const islands = friends.map((f, i) => {
    const dist = (140 + (3 - Math.min(3, f.act)) * 50) * sc;
    const an0 = (ANGLES[i % ANGLES.length] * Math.PI) / 180;
    const w = (70 + Math.min(f.houses, 14) * 5) * k;
    const at = (an: number, d: number) => ({
      x: Math.max(60, Math.min(W - 60, own.x + Math.cos(an) * d * 1.5)),
      y: Math.max(80, Math.min(H - 300, own.y + Math.sin(an) * d * 0.8)),
    });
    let p = at(an0, dist);
    for (let t = 0; t < 24; t++) {
      const clash = placed.some(
        (o) =>
          Math.abs(o.x - p.x) < (o.w + w) / 2 + 30 && Math.abs(o.y - p.y) < (o.w + w) * 0.36 + 34,
      );
      if (!clash) break;
      const an = an0 + (t % 2 ? 1 : -1) * Math.ceil((t + 1) / 2) * 0.35;
      p = at(an, dist * (1 + 0.08 * t));
    }
    const island = { id: f.id, ...p, w };
    placed.push(island);
    return island;
  });
  return { own, islands };
}

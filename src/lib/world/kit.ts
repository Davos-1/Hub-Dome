import { FACHBEREICHE, type FachbereichId, type FachStyle, type FachType } from "../fachbereiche";
import { HOUSE_EXTENTS } from "../house-size";
import type { Variante } from "./doc";
import { PLOT } from "./settlement";

/**
 * Baukasten pro Haus: Farbe und Dach als kuratierte Sets (alles passt zusammen, nichts ist frei wählbar),
 * Anbau und Gartenstil mit festen Plätzen neben dem Haus (siehe `kitLayout`).
 */

type Farben = Pick<FachStyle, "wall" | "roof" | "accent">;

/** Farbsets: 0 = Grundton des Fachbereichs, dann drei Alternativen (Wand, Akzent; Dach separat). */
export const FARB_SETS: readonly { label: string; wall?: string; accent?: string }[] = [
  { label: "Grundton" },
  { label: "Sandstein", wall: "#e6d5b3", accent: "#3f6f5a" },
  { label: "Holz", wall: "#b98b62", accent: "#2f5d7a" },
  { label: "Kalk", wall: "#f3f0e8", accent: "#b4533a" },
];

/** Dach: 0 = wie der Fachbereich, dann Schiefer und Ziegel. */
export const DACH_SETS: readonly { label: string; roof?: string }[] = [
  { label: "Wie Fachbereich" },
  { label: "Schiefer", roof: "#4c5663" },
  { label: "Ziegel", roof: "#a4513a" },
];

export const ANBAU_LABELS = {
  keiner: "Keiner",
  laube: "Laube",
  schuppen: "Schuppen",
  wintergarten: "Wintergarten",
} as const;

export const GARTEN_LABELS = {
  blumen: "Blumen",
  gemuese: "Gemüse",
  stein: "Steingarten",
  obst: "Obst",
} as const;

/** Farben eines Hauses mit seiner Variante (ohne Variante unverändert). */
export function withVariante<T extends Farben>(base: T, v: Variante | undefined): T {
  if (!v) return base;
  const f = FARB_SETS[v.farbe ?? 0] ?? FARB_SETS[0];
  const d = DACH_SETS[v.dach ?? 0] ?? DACH_SETS[0];
  return {
    ...base,
    wall: f.wall ?? base.wall,
    accent: f.accent ?? base.accent,
    roof: d.roof ?? base.roof,
  };
}

/** Grundflächen (halbe Masse, lokal) der Baukasten-Teile, passend zu `kit-models.ts`. */
export const ANBAU_FORM = { hw: 0.6, hd: 0.8 };
export const GARTEN_FORM = { hw: 0.55, hd: 0.9 };
/** Bank der Stufe 2 (quer, Sitzfläche zum Haus) und Baum der Stufe 3 (Kronenradius). */
export const BANK_FORM = { hw: 0.3, hd: 0.6 };
export const BAUM_R = 0.75;

/** Innenmass des Grundstücks neben dem Haus: Hecke innen, vorne beginnen die Beete. */
const INNER_X = PLOT.hw - 0.25;
const Z_BACK = -PLOT.back + 0.25;
const Z_FRONT = 1.95;
/** Abstand zum Haus. */
const GAP = 0.15;

export type KitSpot = { x: number; z: number };
export type KitLayout = {
  anbau: KitSpot | null;
  garten: KitSpot | null;
  bank: KitSpot | null;
  baum: KitSpot | null;
};

/** Freie Breite links und rechts vom Haus (über alle Stufen, damit Wachsen nichts verdrängt). */
function strips(type: FachType) {
  const e = HOUSE_EXTENTS[type];
  return [
    { s: 1 as const, edge: e.maxX + GAP, w: INNER_X - (e.maxX + GAP) },
    { s: -1 as const, edge: -(e.minX - GAP), w: INNER_X + (e.minX - GAP) },
  ].sort((a, b) => b.w - a.w);
}

/** Passt ein Anbau bzw. ein Gartenfeld neben diesen Haustyp? (Auswahl wird sonst nicht angeboten.) */
export function kitFits(type: FachType): { anbau: boolean; garten: boolean } {
  const [wide] = strips(type);
  return { anbau: wide.w >= ANBAU_FORM.hw * 2, garten: wide.w >= GARTEN_FORM.hw * 2 };
}

/**
 * Plätze für Anbau, Gartenfeld, Bank (ab Stufe 2) und Baum (Stufe 3) neben dem Haus, lokal im Grundstück.
 * Der Anbau steht auf der breiteren Seite hinten am Haus, das Gartenfeld auf der anderen Seite oder davor;
 * Bank und Baum nehmen, was frei bleibt (sonst entfallen sie). Nichts überlappt, nichts ragt in Haus,
 * Hecke oder Beete.
 */
export function kitLayout(type: FachType, tier: 1 | 2 | 3, v: Variante | undefined): KitLayout {
  const out: KitLayout = { anbau: null, garten: null, bank: null, baum: null };
  const fits = kitFits(type);
  // Belegte z-Bereiche je Seite
  const used = new Map<number, [number, number][]>();
  const take = (s: number, z0: number, z1: number) =>
    used.set(s, [...(used.get(s) ?? []), [z0, z1]]);
  const free = (s: number, z0: number, z1: number) =>
    (used.get(s) ?? []).every(([a, b]) => z1 <= a - 0.2 || z0 >= b + 0.2);
  const ss = strips(type);
  if (v?.anbau && fits.anbau) {
    const st = ss[0];
    const z = Z_BACK + ANBAU_FORM.hd;
    out.anbau = { x: st.s * (st.edge + ANBAU_FORM.hw), z };
    take(st.s, z - ANBAU_FORM.hd, z + ANBAU_FORM.hd);
  }
  if (v?.garten && fits.garten) {
    const z = Z_FRONT - GARTEN_FORM.hd;
    const st =
      ss.find(
        (x) => x.w >= GARTEN_FORM.hw * 2 && free(x.s, z - GARTEN_FORM.hd, z + GARTEN_FORM.hd),
      ) ?? null;
    if (st) {
      out.garten = { x: st.s * (st.edge + st.w / 2), z };
      take(st.s, z - GARTEN_FORM.hd, z + GARTEN_FORM.hd);
    }
  }
  if (tier >= 2) {
    const z = 0.2;
    const st = ss.find(
      (x) => x.w >= BANK_FORM.hw * 2 + 0.1 && free(x.s, z - BANK_FORM.hd, z + BANK_FORM.hd),
    );
    if (st) {
      out.bank = { x: st.s * (st.edge + st.w / 2), z };
      take(st.s, z - BANK_FORM.hd, z + BANK_FORM.hd);
    }
  }
  if (tier === 3) {
    const z = Z_BACK + BAUM_R;
    // Stamm innen an der Hecke, die Krone darf darüber hinausragen (sie liegt höher), nie ins Haus
    const st = ss.find((x) => x.w >= BAUM_R + 0.1 && free(x.s, z - BAUM_R, z + BAUM_R));
    if (st) {
      out.baum = { x: st.s * (INNER_X - 0.1), z };
      take(st.s, z - BAUM_R, z + BAUM_R);
    }
  }
  return out;
}

/** Varianten, die nicht passen (Anbau oder Garten ohne Platz neben dem Haustyp); leer = alles gültig. */
export function checkVarianten(
  houses: readonly { id: string; fach: FachbereichId }[],
  varianten: Record<string, Variante> | undefined,
): { id: string; grund: string }[] {
  const out: { id: string; grund: string }[] = [];
  for (const h of houses) {
    const v = varianten?.[h.id];
    if (!v) continue;
    const fits = kitFits(FACHBEREICHE[h.fach].style.type);
    if (v.anbau && v.anbau !== "keiner" && !fits.anbau)
      out.push({ id: h.id, grund: "Neben diesem Haus ist kein Platz für einen Anbau." });
    if (v.garten && !fits.garten)
      out.push({ id: h.id, grund: "Neben diesem Haus ist kein Platz für ein Gartenfeld." });
  }
  return out;
}

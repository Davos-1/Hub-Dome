import type { Frame } from "@/lib/camera-poses";

/**
 * Anordnung der Oberfläche um die Welt (Phase 4h, «Tafel am Ort»): Wo steht die Tafel, wo das gewählte Haus
 * samt Sucher und Kacheln, welchen Ausschnitt bekommt die Kamera? Reine Funktion (Pixel), getestet auf
 * Überlappungen. Werte aus dem Prototyp (`docs/design_handoff_4h/prototyp.dc.html`, `layout`/`flyPatch`).
 */

export const HUD = {
  /** Brotkrumen und Knöpfe oben. */
  top: 64,
  /** Leiste unten samt Abstand (nur sichtbar, solange keine Tafel offen ist). */
  bottom: 76,
  /** Rand zu den Bildschirmkanten. */
  edge: 16,
  /** Zoomregler rechts (Breite samt Abstand). */
  zoom: 60,
  /** Kacheln 86 × 72 px; Abstand ihrer Mitte zum Rand des Suchers. */
  tileW: 86,
  tileH: 72,
  tileGapX: 55,
  tileGapY: 48,
  /** Sucher-Ecken liegen so weit ausserhalb der Hülle des Hauses. */
  sucherPad: 18,
  /** Tafel: Breite und Abstand zum Kachelring. */
  tafelW: 420,
  tafelMinW: 300,
  tafelGap: 18,
  tafelMaxH: 560,
  /** Grösse des Hauses (Hülle) im Bild, wenn genug Platz ist. */
  houseMaxW: 340,
  houseMaxH: 260,
  houseMinW: 150,
  /** Darunter (Handy) ist die Tafel ein Blatt unten. */
  sheetBelow: 768,
  sheetShare: 0.5,
} as const;

/** Platz, den Sucher und Kacheln rund um die Hülle brauchen (je Seite). */
export const RING_X = HUD.sucherPad + HUD.tileGapX + HUD.tileW / 2;
export const RING_Y = HUD.sucherPad + HUD.tileGapY + HUD.tileH / 2;

export type Rect = { x: number; y: number; w: number; h: number };

export type HudInput = {
  width: number;
  height: number;
  /** Breite der Liste links (0 = zu). */
  listW: number;
  level: "dorf" | "quartier" | "haus";
  /** Eine Tafel ist offen (Haus- oder Quartier-Tafel). */
  tafel: boolean;
  /** Inventar oder Einstellungen offen: Die Welt ist nur ein Streifen oben. */
  strip?: number;
};

export type HudLayout = {
  /** Freier Ausschnitt für die Kamera (Normalkoordinaten). */
  frame: Frame;
  /** Tafel in Pixeln; `dock`: am rechten Rand statt neben dem Haus; `sheet`: Blatt unten (Handy). */
  tafel: (Rect & { dock: boolean; sheet: boolean }) | null;
  /** Rechteck, in das die Kamera die Hülle des Hauses einpasst (nur Ebene «haus»). */
  house: Rect | null;
  /**
   * Sucher und Kacheln haben Platz. Sonst (schmale Fläche, z.B. Liste und Tafel zugleich) bleiben sie weg; die
   * Tafel bietet dieselben Aktionen.
   */
  ring: boolean;
};

const toFrame = (r: Rect, W: number, H: number): Frame => ({
  left: (2 * r.x) / W - 1,
  right: (2 * (r.x + r.w)) / W - 1,
  top: 1 - (2 * r.y) / H,
  bottom: 1 - (2 * (r.y + r.h)) / H,
});

/** Mittiges Rechteck mit Höchstmassen in einem Bereich. */
function centered(area: Rect, maxW: number, maxH: number): Rect {
  const w = Math.max(1, Math.min(maxW, area.w));
  const h = Math.max(1, Math.min(maxH, area.h));
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

export const isSheet = (width: number) => width < HUD.sheetBelow;

export function hudLayout(input: HudInput): HudLayout {
  const W = Math.max(1, input.width);
  const H = Math.max(1, input.height);
  const L = Math.min(input.listW, W * 0.6);
  const sheet = isSheet(W);

  // Inventar/Einstellungen: nur der Streifen oben zeigt die Welt
  if (input.strip) {
    const r = { x: 0, y: 0, w: W, h: Math.min(input.strip, H) };
    return { frame: toFrame(r, W, H), tafel: null, house: null, ring: false };
  }

  const bottom = input.tafel ? HUD.edge : HUD.bottom;
  // Fläche der Welt ohne Liste, Kopfzeile, Leiste und Zoomregler
  const free: Rect = {
    x: L + HUD.edge,
    y: HUD.top,
    w: Math.max(1, W - L - HUD.edge - HUD.zoom),
    h: Math.max(1, H - HUD.top - bottom),
  };

  if (!input.tafel) {
    if (input.level !== "haus")
      return { frame: toFrame(free, W, H), tafel: null, house: null, ring: false };
    return { ...houseIn(free, W, H), tafel: null };
  }

  // Handy: Tafel als Blatt in der unteren Hälfte, die Welt oben
  if (sheet) {
    const th = Math.round(H * HUD.sheetShare);
    const tafel = { x: 12, y: H - th - 12, w: W - 24, h: th, dock: true, sheet: true };
    const area: Rect = { x: 12, y: HUD.top, w: W - 24, h: Math.max(1, tafel.y - 12 - HUD.top) };
    if (input.level !== "haus")
      return { frame: toFrame(area, W, H), tafel, house: null, ring: false };
    return { ...houseIn(area, W, H), tafel };
  }

  const tafelH = (y: number) => Math.max(1, Math.min(HUD.tafelMaxH, H - y - HUD.edge));
  const avail = W - L - 2 * HUD.edge - HUD.zoom;

  // Quartier (und Tafeln ohne Haus wie «Haus anlegen»): Tafel rechts angedockt, die Welt links davon
  if (input.level !== "haus") {
    const tw = Math.max(HUD.tafelMinW, Math.min(HUD.tafelW, avail - 260));
    const tx = W - HUD.zoom - tw;
    const tafel = { x: tx, y: HUD.top, w: tw, h: tafelH(HUD.top), dock: true, sheet: false };
    const area: Rect = { x: free.x, y: free.y, w: Math.max(1, tx - HUD.edge - free.x), h: free.h };
    return { frame: toFrame(area, W, H), tafel, house: null, ring: false };
  }

  // Haus: Gruppe «Haus mit Kacheln + Tafel» nebeneinander, sonst Tafel rechts angedockt
  const need = HUD.houseMinW + 2 * RING_X + HUD.tafelGap + HUD.tafelMinW;
  if (avail >= need) {
    const tw = Math.min(HUD.tafelW, avail - HUD.houseMinW - 2 * RING_X - HUD.tafelGap);
    const hw = Math.min(HUD.houseMaxW, avail - 2 * RING_X - HUD.tafelGap - tw);
    const group = hw + 2 * RING_X + HUD.tafelGap + tw;
    const left = L + HUD.edge + (avail - group) / 2;
    const hh = Math.max(1, Math.min(HUD.houseMaxH, H - HUD.top - HUD.edge - 2 * RING_Y));
    const house: Rect = {
      x: left + RING_X,
      y: HUD.top + RING_Y + (H - HUD.top - HUD.edge - 2 * RING_Y - hh) / 2,
      w: hw,
      h: hh,
    };
    const cy = house.y + house.h / 2;
    const ty = Math.max(HUD.top, Math.min(cy - 170, H - HUD.edge - tafelH(HUD.top)));
    const tafel = {
      x: house.x + house.w + RING_X + HUD.tafelGap,
      y: ty,
      w: tw,
      h: tafelH(ty),
      dock: false,
      sheet: false,
    };
    return { frame: toFrame(house, W, H), tafel, house, ring: true };
  }

  // Angedockt: Tafel am rechten Rand (links vom Zoomregler), Haus in der Mitte der Restfläche
  const tw = Math.max(Math.min(260, avail), Math.min(400, avail - 170));
  const tafel = {
    x: W - HUD.zoom - tw,
    y: HUD.top,
    w: tw,
    h: tafelH(HUD.top),
    dock: true,
    sheet: false,
  };
  const area: Rect = {
    x: L + HUD.edge,
    y: HUD.top,
    w: Math.max(1, tafel.x - HUD.edge - (L + HUD.edge)),
    h: Math.max(1, H - HUD.top - HUD.edge),
  };
  return { ...houseIn(area, W, H), tafel };
}

/** Haus in einer Fläche: mit Rand für Sucher und Kacheln, falls Platz ist, sonst ohne. */
function houseIn(area: Rect, W: number, H: number) {
  const rx = RING_X;
  const ry = RING_Y;
  const inner = { x: area.x + rx, y: area.y + ry, w: area.w - 2 * rx, h: area.h - 2 * ry };
  const ring = inner.w >= HUD.houseMinW && inner.h >= HUD.houseMinW * 0.6;
  const house = centered(ring ? inner : area, HUD.houseMaxW, HUD.houseMaxH);
  return { frame: toFrame(house, W, H), house, ring };
}

/** Sucher (Rahmen um die Hülle) und Mittelpunkte der vier Kacheln oben/rechts/unten/links. */
export function sucherAround(hull: Rect): { sucher: Rect; tiles: { x: number; y: number }[] } {
  const p = HUD.sucherPad;
  const sucher = { x: hull.x - p, y: hull.y - p, w: hull.w + 2 * p, h: hull.h + 2 * p };
  const cx = sucher.x + sucher.w / 2;
  const cy = sucher.y + sucher.h / 2;
  const dx = sucher.w / 2 + HUD.tileGapX;
  const dy = sucher.h / 2 + HUD.tileGapY;
  return {
    sucher,
    tiles: [
      { x: cx, y: cy - dy },
      { x: cx + dx, y: cy },
      { x: cx, y: cy + dy },
      { x: cx - dx, y: cy },
    ],
  };
}

/** Bau-Modus (Prototyp 12a): Leiste oben, Werkzeuge links, Panel rechts, Meldung unten (Pixel). */
export const BUILD_HUD = {
  bar: 52,
  railLeft: 16,
  railW: 58,
  panelRight: 16,
  panelW: 268,
  top: 70,
  bottom: 64,
} as const;

/**
 * Freier Ausschnitt des Plans im Bau-Modus (NDC): zwischen Werkzeugleiste und Panel, unter der Leiste und
 * über der Meldung. Auf schmalen Fenstern (unter 768 px) liegt das Panel unten; dann bleibt der obere Teil.
 */
export function buildFrame(width: number, height: number): Frame {
  const sheet = width < HUD.sheetBelow;
  const left = BUILD_HUD.railLeft + BUILD_HUD.railW + 12;
  const right = sheet ? width - 12 : width - BUILD_HUD.panelRight - BUILD_HUD.panelW - 12;
  const top = BUILD_HUD.bar + 12;
  const bottom = sheet ? height * 0.55 : height - BUILD_HUD.bottom;
  return {
    left: (2 * left) / width - 1,
    right: (2 * right) / width - 1,
    top: 1 - (2 * top) / height,
    bottom: 1 - (2 * bottom) / height,
  };
}

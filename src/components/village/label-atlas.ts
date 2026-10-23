import * as THREE from "three";
import type { QuarterLayout } from "@/lib/layout";
import { QUARTER_COLORS } from "@/lib/layout";
import { ARTIFACT_KIND_LABELS, type ArtifactKind } from "@/lib/types";
import type { HouseInfo, ObjInfo } from "@/lib/village-model";
import { KIND_COLORS } from "./colors";

/**
 * Beschriftungen als Canvas-Zeichnungen in einem gemeinsamen Textur-Atlas: Chip und Karte pro Haus,
 * Quartier-Pille, Holzschilder, Anschlagbrett, Baustellenschild, Kartenbeschriftung. Eine GPU-Textur
 * für alle Schilder; jede Beschriftung nutzt einen Ausschnitt (offset/repeat).
 */

let FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Liest die geladene UI-Schrift (CSS-Variable) und wartet, bis die gebrauchten Schnitte da sind. */
export async function loadLabelFont(): Promise<void> {
  const css = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-plex-sans")
    .trim();
  if (css) FONT = `${css}, system-ui, sans-serif`;
  const family = css || "system-ui";
  try {
    await Promise.all(
      ["500 27px", "600 38px", "700 30px", "600 22px", "700 112px"].map((f) =>
        document.fonts.load(`${f} ${family}`),
      ),
    );
  } catch {
    /* Schrift nicht verfügbar: Ersatzschrift */
  }
}

export type AtlasEntry = {
  canvas: HTMLCanvasElement;
  /** Ankerpunkt im Bild (0…1): [0.5, 0] = unten Mitte, [0.5, 0.5] = Mitte. */
  center: [number, number];
  ax: number;
  ay: number;
  tex: THREE.Texture | null;
  aspect: number;
};

const cv = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const entry = (canvas: HTMLCanvasElement, center: [number, number] = [0.5, 0.5]): AtlasEntry => ({
  canvas,
  center,
  ax: 0,
  ay: 0,
  tex: null,
  aspect: canvas.width / canvas.height,
});

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(font: string, text: string) {
  measureCtx ??= cv(1, 1).getContext("2d")!;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

const countText = (n: number) => (n === 0 ? "Baustelle" : n === 1 ? "1 Objekt" : `${n} Objekte`);
const KIND_ABBR: Record<ArtifactKind, string> = {
  rechner: "R",
  quiz: "Q",
  zusammenfassung: "Z",
  cheatsheet: "C",
  tool: "T",
  visualisierung: "V",
  sonstiges: "S",
};

function codeTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  label: string,
  fill: string,
  empty: boolean,
  fontPx: number,
) {
  ctx.fillStyle = fill;
  rr(ctx, x, y, s, s, s * 0.2);
  ctx.fill();
  if (empty) {
    ctx.save();
    rr(ctx, x, y, s, s, s * 0.2);
    ctx.clip();
    ctx.strokeStyle = "rgba(194,106,24,0.35)";
    ctx.lineWidth = s * 0.1;
    for (let k = -s; k < s * 2; k += s * 0.28) {
      ctx.beginPath();
      ctx.moveTo(x + k, y + s);
      ctx.lineTo(x + k + s, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(28,27,25,0.16)";
  ctx.lineWidth = 3;
  rr(ctx, x + 1.5, y + 1.5, s - 3, s - 3, s * 0.2);
  ctx.stroke();
  ctx.fillStyle = "#1c1b19";
  ctx.font = `700 ${fontPx}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // lange Kürzel verkleinern, damit sie in die Kachel passen
  ctx.fillText(label, x + s / 2, y + s / 2 + 2, s - 10);
  ctx.textAlign = "left";
}

function cardShell(
  title: string,
  sub: string,
  tagLabel: string,
  tagFill: string,
  empty: boolean,
  bar: Partial<Record<ArtifactKind, number>> | null,
  badge: string | null,
): AtlasEntry {
  const pad = 20;
  const tag = 88;
  const bodyH = 128;
  const tail = 18;
  const tf = `600 38px ${FONT}`;
  const sf = `500 27px ${FONT}`;
  const bf = `600 22px ${FONT}`;
  const bw = badge ? measure(bf, badge) + 22 : 0;
  const tw = Math.min(measure(tf, title), 560);
  const sw = measure(sf, sub) + (badge ? bw + 12 : 0);
  const textW = Math.max(tw, sw, 170);
  const W = Math.ceil(pad + tag + 22 + textW + 28);
  const H = bodyH + tail;
  const c = cv(W, H);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fffdf8";
  rr(ctx, 0, 0, W, bodyH, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 16, bodyH - 1);
  ctx.lineTo(W / 2, H);
  ctx.lineTo(W / 2 + 16, bodyH - 1);
  ctx.closePath();
  ctx.fill();
  codeTag(ctx, pad, pad, tag, tagLabel, tagFill, empty, tagLabel.length > 6 ? 20 : 30);
  const tx = pad + tag + 22;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1c1b19";
  ctx.font = tf;
  ctx.fillText(title, tx, 58, 560);
  ctx.fillStyle = "#6d6a63";
  ctx.font = sf;
  ctx.fillText(sub, tx, 92);
  if (badge) {
    const bx = tx + measure(sf, sub) + 12;
    ctx.fillStyle = "#fde68a";
    rr(ctx, bx, 68, bw, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.font = bf;
    ctx.fillText(badge, bx + 11, 92);
  }
  if (bar) {
    let x = tx;
    const gap = 4;
    const keys = (Object.keys(bar) as ArtifactKind[]).filter((k) => bar[k]);
    const total = keys.reduce((s, k) => s + (bar[k] ?? 0), 0);
    const unit = (textW - gap * (keys.length - 1)) / total;
    for (const k of keys) {
      const w = unit * (bar[k] ?? 0);
      ctx.fillStyle = KIND_COLORS[k];
      rr(ctx, x, 106, w, 8, 4);
      ctx.fill();
      x += w + gap;
    }
  }
  return entry(c, [0.5, 0]);
}

export function drawCard(h: HouseInfo): AtlasEntry {
  const n = h.items.length;
  const bar: Partial<Record<ArtifactKind, number>> = {};
  for (const i of h.items) bar[i.kind] = (bar[i.kind] ?? 0) + 1;
  return cardShell(
    h.title,
    n ? countText(n) : "Baustelle · noch leer",
    h.code,
    n ? h.color : "#f3d9a6",
    !n,
    n ? bar : null,
    h.newCount ? `${h.newCount} neu` : null,
  );
}

export function drawObjCard(o: ObjInfo, h: HouseInfo): AtlasEntry {
  return cardShell(
    o.title,
    `${ARTIFACT_KIND_LABELS[o.kind]} · ${h.code}`,
    KIND_ABBR[o.kind],
    KIND_COLORS[o.kind],
    false,
    null,
    o.isNew ? "neu" : null,
  );
}

export function drawChip(h: HouseInfo): AtlasEntry {
  const H = 64;
  const tf = `700 26px ${FONT}`;
  const nf = `600 28px ${FONT}`;
  const bf = `600 20px ${FONT}`;
  const nn = h.newCount;
  const code = h.code.length > 12 ? `${h.code.slice(0, 11)}…` : h.code;
  const cw = measure(tf, code) + 28;
  const num = String(h.items.length);
  const nw = measure(nf, num);
  const bw = nn ? measure(bf, `+${nn}`) + 18 : 0;
  const W = Math.ceil(6 + cw + 14 + 20 + 8 + nw + (nn ? 10 + bw : 0) + 20);
  const c = cv(W, H + 12);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(255,253,248,0.96)";
  rr(ctx, 0, 0, W, H, H / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 9, H - 1);
  ctx.lineTo(W / 2, H + 12);
  ctx.lineTo(W / 2 + 9, H - 1);
  ctx.fill();
  ctx.fillStyle = h.items.length ? h.color : "#f3d9a6";
  rr(ctx, 6, 6, cw, H - 12, (H - 12) / 2);
  ctx.fill();
  ctx.fillStyle = "#26241f";
  ctx.font = tf;
  ctx.textBaseline = "middle";
  ctx.fillText(code, 6 + 14, H / 2 + 1);
  // Dokument-Symbol
  const ix = 6 + cw + 14;
  ctx.strokeStyle = "#6d6a63";
  ctx.lineWidth = 3;
  rr(ctx, ix, 18, 18, 26, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ix + 5, 27);
  ctx.lineTo(ix + 13, 27);
  ctx.moveTo(ix + 5, 34);
  ctx.lineTo(ix + 13, 34);
  ctx.stroke();
  ctx.fillStyle = "#1c1b19";
  ctx.font = nf;
  ctx.fillText(num, ix + 28, H / 2 + 1);
  if (nn) {
    const bx = ix + 28 + nw + 10;
    ctx.fillStyle = "#fde68a";
    rr(ctx, bx, 16, bw, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.font = bf;
    ctx.fillText(`+${nn}`, bx + 9, H / 2 + 1);
  }
  return entry(c, [0.5, 0]);
}

/** Holzschild am Gartentor: gesperrtes Kürzel, Titel, Anzahl. */
export function drawBoard(h: HouseInfo): AtlasEntry {
  const W = 512;
  const H = 256;
  const c = cv(W, H);
  const ctx = c.getContext("2d")!;
  const n = h.items.length;
  ctx.fillStyle = "#8b5e3c";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(60,35,18,0.35)";
  ctx.lineWidth = 3;
  for (const y of [64, 128, 192]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#5e3c22";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f3dcb4";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(h.code.split("").join(" "), W / 2, 70, W - 60);
  ctx.fillStyle = "#fbf3e4";
  ctx.font = `700 62px ${FONT}`;
  ctx.fillText(h.title, W / 2, 150, W - 60);
  ctx.fillStyle = "#f0d9b5";
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(
    (n ? countText(n) : "Baustelle · noch leer") + (h.newCount ? ` · ${h.newCount} neu` : ""),
    W / 2,
    210,
    W - 50,
  );
  return entry(c);
}

/** Anschlagbrett am Hauptplatz mit den neuesten Objekten. */
export function drawNotice(items: { o: ObjInfo; h: HouseInfo }[]): AtlasEntry {
  const W = 1024;
  const H = 640;
  const c = cv(W, H);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f3ecdc";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#5e3c22";
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = "#fbf3e4";
  ctx.font = `700 54px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Neu im Dorf", 40, 58);
  ctx.fillStyle = "#e8cfa7";
  ctx.font = `500 28px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("Antippen zum Hingehen", W - 40, 60);
  ctx.textAlign = "left";
  if (items.length === 0) {
    ctx.fillStyle = "#6d6a63";
    ctx.font = `500 34px ${FONT}`;
    ctx.fillText("Gerade nichts Neues.", 40, 190);
  }
  items.slice(0, 5).forEach(({ o, h }, i) => {
    const y = 130 + i * 100;
    if (i) {
      ctx.fillStyle = "rgba(94,60,34,0.15)";
      ctx.fillRect(40, y - 6, W - 80, 2);
    }
    ctx.fillStyle = KIND_COLORS[o.kind];
    rr(ctx, 40, y + 14, 64, 64, 12);
    ctx.fill();
    ctx.fillStyle = "#1c1b19";
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(KIND_ABBR[o.kind], 72, y + 48);
    ctx.textAlign = "left";
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText(o.title, 128, y + 34, 640);
    ctx.fillStyle = "#6d6a63";
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText(`${ARTIFACT_KIND_LABELS[o.kind]} · ${h.title}`, 128, y + 72, 640);
    ctx.fillStyle = "#fde68a";
    rr(ctx, W - 150, y + 28, 110, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.font = `600 24px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("neu", W - 95, y + 49);
    ctx.textAlign = "left";
  });
  ctx.strokeStyle = "#5e3c22";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  return entry(c);
}

/** Gelb-schwarzes Baustellenschild bei leeren Häusern. */
export function drawConstruction(): AtlasEntry {
  const W = 512;
  const H = 320;
  const c = cv(W, H);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#facc15";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, 44);
  ctx.clip();
  ctx.fillStyle = "#1c1b19";
  for (let x = -60; x < W + 60; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x + 28, 0);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 28, 44);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#1c1b19";
  ctx.font = `700 46px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Baustelle", 32, 112);
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText("Erstes Objekt", 32, 188);
  ctx.fillText("hinzufügen", 32, 234);
  ctx.beginPath();
  ctx.arc(W - 96, 200, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.fillRect(W - 96 - 34, 192, 68, 16);
  ctx.fillRect(W - 96 - 8, 166, 16, 68);
  return entry(c);
}

/** Quartiertafel am Nebenplatz: Name, Modulkürzel, Kopfband in Quartierfarbe. */
export function drawQuarterBoard(q: QuarterLayout, codes: string[]): AtlasEntry {
  const W = 512;
  const H = 256;
  const c = cv(W * 2, H * 2);
  const ctx = c.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = "#fbf6ea";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = QUARTER_COLORS[q.index % QUARTER_COLORS.length].edge;
  ctx.fillRect(0, 0, W, 26);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1c1b19";
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText(q.name, W / 2, 128, W - 50);
  ctx.fillStyle = "#6d6a63";
  ctx.font = `500 34px ${FONT}`;
  // Gleiche Kürzel nur einmal (zwei Häuser zum selben Modul)
  ctx.fillText([...new Set(codes)].join(" · "), W / 2, 196, W - 50);
  ctx.strokeStyle = "#5e3c22";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  return entry(c);
}

/** Dunkle Pille mit Spitze (Quartiername, Zentrale). */
export function drawPill(text: string): AtlasEntry {
  const H = 60;
  const f = `600 30px ${FONT}`;
  const W = Math.ceil(measure(f, text) + 44);
  const c = cv(W, H + 10);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(40,38,34,0.88)";
  rr(ctx, 0, 0, W, H, H / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 8, H - 1);
  ctx.lineTo(W / 2, H + 10);
  ctx.lineTo(W / 2 + 8, H - 1);
  ctx.fill();
  ctx.fillStyle = "#fbf6ea";
  ctx.font = f;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 22, H / 2 + 1);
  return entry(c, [0.5, 0]);
}

/** Grosse Beschriftung für die Kartenansicht. */
export function drawMapLabel(big: string, small: string | null): AtlasEntry {
  const bf = `700 112px ${FONT}`;
  const sf = `600 54px ${FONT}`;
  const W = Math.ceil(Math.max(measure(bf, big), small ? measure(sf, small) : 0) + 40);
  const H = small ? 190 : 140;
  const c = cv(W, H);
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.font = bf;
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(255,253,248,0.95)";
  ctx.strokeText(big, W / 2, 112);
  ctx.fillStyle = "#1c1b19";
  ctx.fillText(big, W / 2, 112);
  if (small) {
    ctx.font = sf;
    ctx.lineWidth = 8;
    ctx.strokeText(small, W / 2, 182);
    ctx.fillStyle = "#3a3732";
    ctx.fillText(small, W / 2, 182);
  }
  return entry(c);
}

/** Ordnet alle Zeichnungen in Reihen an, legt eine Textur an und gibt jeder Beschriftung ihren Ausschnitt. */
export function buildAtlas(entries: AtlasEntry[]): {
  base: THREE.CanvasTexture;
  dispose: () => void;
} {
  const AW = entries.length > 60 ? 4096 : 2048;
  const pad = 8;
  let x = pad;
  let y = pad;
  let rowH = 0;
  for (const e of entries) {
    const w = e.canvas.width;
    const h = e.canvas.height;
    if (x + w + pad > AW) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    e.ax = x;
    e.ay = y;
    x += w + pad;
    rowH = Math.max(rowH, h);
  }
  let AH = 256;
  while (AH < y + rowH + pad) AH *= 2;
  const atlas = cv(AW, AH);
  const ctx = atlas.getContext("2d")!;
  for (const e of entries) ctx.drawImage(e.canvas, e.ax, e.ay);
  const base = new THREE.CanvasTexture(atlas);
  base.colorSpace = THREE.SRGBColorSpace;
  base.anisotropy = 4;
  for (const e of entries) {
    const t = base.clone();
    t.repeat.set(e.canvas.width / AW, e.canvas.height / AH);
    t.offset.set(e.ax / AW, 1 - (e.ay + e.canvas.height) / AH);
    e.tex = t;
  }
  return {
    base,
    dispose: () => {
      for (const e of entries) e.tex?.dispose();
      base.dispose();
    },
  };
}

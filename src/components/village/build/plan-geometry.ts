import * as THREE from "three";
import type { Pt } from "@/lib/world/geom";

/**
 * Flache Formen für die Planansicht des Bau-Modus (von oben gesehen): Bänder mit Breite statt 1-px-Linien,
 * gestrichelt oder durchgezogen, und ein Raster als Textur. Alles in Weltmetern auf Höhe `y`.
 */

/** Band entlang eines Linienzugs (`closed`: zurück zum Anfang). */
export function ribbon(pts: Pt[], width: number, y = 0.06, closed = false): THREE.BufferGeometry {
  const list = closed && pts.length > 2 ? [...pts, pts[0]] : pts;
  const pos: number[] = [];
  const idx: number[] = [];
  const hw = width / 2;
  for (let i = 0; i < list.length; i++) {
    const a = list[Math.max(0, i - 1)];
    const b = list[Math.min(list.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l;
    const nz = dx / l;
    const p = list[i];
    pos.push(p.x + nx * hw, y, p.z + nz * hw, p.x - nx * hw, y, p.z - nz * hw);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Gestricheltes Band (Striche `dash`, Lücken `gap`, Meter) entlang eines Linienzugs. */
export function dashedRibbon(
  pts: Pt[],
  width: number,
  dash = 1.2,
  gap = 0.8,
  y = 0.06,
  closed = true,
): THREE.BufferGeometry {
  const list = closed && pts.length > 2 ? [...pts, pts[0]] : pts;
  // Bogenlänge je Punkt; Striche über die Bogenlänge (keine Rundungsfehler-Schleifen)
  const acc = [0];
  for (let i = 1; i < list.length; i++)
    acc.push(acc[i - 1] + Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z));
  const total = acc[acc.length - 1];
  const at = (d: number): Pt => {
    let i = 1;
    while (i < acc.length - 1 && acc[i] < d) i++;
    const a = list[i - 1];
    const b = list[i];
    const l = acc[i] - acc[i - 1] || 1;
    const t = Math.max(0, Math.min(1, (d - acc[i - 1]) / l));
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  };
  const geos: THREE.BufferGeometry[] = [];
  const period = Math.max(0.05, dash + gap);
  for (let s0 = 0; s0 < total; s0 += period) {
    const s1 = Math.min(total, s0 + dash);
    if (s1 - s0 < 0.05) continue;
    const part = [at(s0)];
    for (let i = 1; i < acc.length - 1; i++) if (acc[i] > s0 && acc[i] < s1) part.push(list[i]);
    part.push(at(s1));
    geos.push(ribbon(part, width, y));
  }
  return merge(geos);
}

/** Kreis als Linienzug (für Umrisse). */
export function circlePts(x: number, z: number, r: number, n = 64): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
  });
}

/** Mehrere Geometrien (nur Positionen und Indizes) zu einer zusammenfügen. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const g of geos) {
    const base = pos.length / 3;
    pos.push(...(g.getAttribute("position").array as Float32Array));
    for (const i of Array.from(g.getIndex()!.array)) idx.push(i + base);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}

/** Rasterkachel (10 m mit Linien alle 2 m, stärker am Rand) als Textur; Farbe der Linien weiss. */
export function gridTexture(): THREE.CanvasTexture {
  const n = 256;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, n, n);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    const p = (i * n) / 5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, n);
    ctx.moveTo(0, p);
    ctx.lineTo(n, p);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

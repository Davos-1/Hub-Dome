/**
 * Belegungsregister der Welt: alles, was schon steht (Grundflächen und Wege), in der Reihenfolge, in der
 * es gesetzt wurde. Jedes neue Element prüft sich nur gegen das Register. Weil spätere Elemente frühere
 * nie verdrängen, verschiebt ein neues Haus kein bestehendes.
 */

import {
  boundR,
  corners,
  distPointPolyline,
  overlaps,
  polylineLength,
  shapePolylineDist,
  type Pt,
  type Shape,
} from "./geom";
import { featureShapes, inWater, riverCrossings, TRAIL_WIDTH, type WorldMap } from "./map";

export type ClaimKind =
  | "platz"
  | "knoten"
  | "grundstueck"
  | "sichtzone"
  | "deko"
  /** Hohe Deko (Bäume): darf nicht vor einer Hausfront stehen. */
  | "deko-hoch"
  | "merkmal"
  | "terrasse"
  /** Bereich vor einer Hausfront: dort keine hohen Elemente (Bäume), damit nichts verdeckt wird. */
  | "frontzone";

export type Claim = { id: string; kind: ClaimKind; shape: Shape; label: string };
export type PathClaim = {
  id: string;
  pts: Pt[];
  hw: number;
  label: string;
  /** Nur für diese Art prüfen (reservierte Gassen-Korridore gelten nur für Grundstücke). */
  onlyFor?: ClaimKind;
};

/** Achsparalleler Rahmen [x0, z0, x1, z1] für schnelle Vorprüfungen. */
type Rect = [number, number, number, number];
const rectOfShape = (s: Shape): Rect => {
  const R = boundR(s);
  return [s.x - R, s.z - R, s.x + R, s.z + R];
};
function rectOfPts(pts: Pt[], pad: number): Rect {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.z < z0) z0 = p.z;
    if (p.x > x1) x1 = p.x;
    if (p.z > z1) z1 = p.z;
  }
  return [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
}
const hit = (a: Rect, b: Rect, m: number) =>
  a[0] - m <= b[2] && b[0] - m <= a[2] && a[1] - m <= b[3] && b[1] - m <= a[3];

/** Grund, warum etwas nicht hierhin passt (kurz, für das rote Geisterbild). */
export type Conflict = { grund: string; mit?: string };

export const REASONS = {
  karte: "ausserhalb der Karte",
  wasser: "im Wasser",
  weg: "auf dem Weg",
  gelaende: "steht schief im Hang",
} as const;

export type CheckOpts = {
  /** Mindestabstand zu anderen Grundflächen. */
  margin: number;
  /** Zusätzlicher Abstand zu Wegrändern. */
  pathClearance: number;
  /** Diese Einträge (z.B. eigenes Grundstück) nicht prüfen. */
  ignore?: ReadonlySet<string>;
  /** Nur diese Arten prüfen (Standard: alle). */
  kinds?: ReadonlySet<ClaimKind>;
  /** Wasser nicht prüfen (Steg prüft selbst). */
  skipWater?: boolean;
  /** Art des geprüften Elements (für Wege mit `onlyFor`). */
  asKind?: ClaimKind;
  /** Kartenrand nicht prüfen (Wald auf den Hügeln). */
  skipBounds?: boolean;
  /** Wege nicht prüfen (z.B. Bereich vor einer Hausfront, durch den die Gasse führt). */
  skipPaths?: boolean;
};

export class Space {
  readonly claims: Claim[] = [];
  readonly paths: PathClaim[] = [];
  private claimRects: Rect[] = [];
  private pathRects: Rect[] = [];

  constructor(
    readonly map: WorldMap,
    init = true,
  ) {
    if (!init) return;
    featureShapes(map).forEach((f, i) => {
      this.addClaim({ id: `merkmal-${i}`, kind: "merkmal", shape: f.shape, label: f.label });
    });
    if (map.trail) {
      this.addPath({
        id: "pfad-wanderweg",
        pts: map.trail,
        hw: TRAIL_WIDTH / 2,
        label: "auf dem Wanderweg",
      });
    }
  }

  addClaim(c: Claim) {
    this.claims.push(c);
    this.claimRects.push(rectOfShape(c.shape));
  }

  addPath(p: PathClaim) {
    this.paths.push(p);
    this.pathRects.push(rectOfPts(p.pts, p.hw));
  }

  /** Unabhängige Kopie (z.B. Stand nach Häusern und Deko für den Bau-Modus). */
  clone(): Space {
    const c = new Space(this.map, false);
    this.claims.forEach((x) => c.addClaim(x));
    this.paths.forEach((x) => c.addPath(x));
    return c;
  }

  /** Stand merken, um Probe-Einträge wieder zu entfernen. */
  mark() {
    return { claims: this.claims.length, paths: this.paths.length };
  }

  rollback(m: { claims: number; paths: number }) {
    this.claims.length = m.claims;
    this.claimRects.length = m.claims;
    this.paths.length = m.paths;
    this.pathRects.length = m.paths;
  }

  /** Liegt die Grundfläche ganz innerhalb des bebaubaren Kreises? */
  inBounds(s: Shape, limit = this.map.rBuild): boolean {
    if (s.kind === "circle") return Math.hypot(s.x, s.z) + s.r <= limit;
    return corners(s).every((p) => Math.hypot(p.x, p.z) <= limit);
  }

  /** Erste Kollision einer Grundfläche mit dem Register (oder `null`, wenn frei). */
  conflict(s: Shape, o: CheckOpts): Conflict | null {
    if (!o.skipBounds && !this.inBounds(s)) return { grund: REASONS.karte };
    if (!o.skipWater && inWater(this.map, s, 0.2)) return { grund: REASONS.wasser };
    const rect = rectOfShape(s);
    for (let i = 0; i < this.claims.length; i++) {
      const c = this.claims[i];
      if (!hit(rect, this.claimRects[i], o.margin)) continue;
      if (o.ignore?.has(c.id)) continue;
      if (o.kinds && !o.kinds.has(c.kind)) continue;
      if (overlaps(s, c.shape, o.margin)) return { grund: c.label, mit: c.id };
    }
    if (o.skipPaths) return null;
    const R = boundR(s);
    for (let i = 0; i < this.paths.length; i++) {
      const p = this.paths[i];
      if (!hit(rect, this.pathRects[i], o.pathClearance)) continue;
      if (o.ignore?.has(p.id)) continue;
      if (p.onlyFor && p.onlyFor !== o.asKind) continue;
      // Vorprüfung: Abstand zur Mittellinie über den umschliessenden Kreis
      if (distPointPolyline(s.x, s.z, p.pts) - R > p.hw + o.pathClearance) continue;
      if (shapePolylineDist(s, p.pts) < p.hw + o.pathClearance)
        return { grund: p.label, mit: p.id };
    }
    return null;
  }

  /**
   * Prüft einen neuen Weg: Grundflächen (ausser `ignore`), andere Wege (die ersten und letzten Meter
   * an den Plätzen ausgenommen) und Wasser.
   */
  pathConflict(
    pts: Pt[],
    hw: number,
    ignore: ReadonlySet<string>,
    skipStart = 1.0,
    skipEnd = 1.0,
    /** Gassen dürfen den Fluss auf einer Brücke queren (fast rechtwinklig, kurz). */
    bridges = false,
  ): Conflict | null {
    const total = polylineLength(pts);
    let acc = 0;
    const inner: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (i) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      if (acc >= skipStart && acc <= total - skipEnd) inner.push(pts[i]);
    }
    for (const p of pts) {
      if (Math.hypot(p.x, p.z) > this.map.rBuild) return { grund: REASONS.karte };
    }
    const rect = rectOfPts(pts, hw);
    for (let i = 0; i < this.claims.length; i++) {
      const c = this.claims[i];
      if (!hit(rect, this.claimRects[i], 0.35)) continue;
      // Wege führen durch Bereiche vor Hausfronten hindurch (dort liegt die Gasse)
      if (ignore.has(c.id) || c.kind === "frontzone") continue;
      if (shapePolylineDist(c.shape, pts) < hw + 0.35) return { grund: c.label, mit: c.id };
    }
    if (inner.length > 1) {
      const innerRect = rectOfPts(inner, hw);
      for (let i = 0; i < this.paths.length; i++) {
        const p = this.paths[i];
        if (!hit(innerRect, this.pathRects[i], 0.6)) continue;
        if (ignore.has(p.id)) continue;
        for (const q of inner) {
          if (distPointPolyline(q.x, q.z, p.pts) < hw + p.hw + 0.6)
            return { grund: p.label, mit: p.id };
        }
      }
    }
    // Brücken queren Fluss und (v2) weitere Wasserläufe; Seen und Teiche nie
    const water = bridges ? { ...this.map, river: null, streams: [] } : this.map;
    if (bridges && riverCrossings(this.map, pts, hw).some((c) => !c.ok))
      return { grund: REASONS.wasser };
    for (let i = 0; i < pts.length; i += 2) {
      const q = pts[i];
      if (inWater(water, { kind: "circle", x: q.x, z: q.z, r: hw }, 0.3))
        return { grund: REASONS.wasser };
    }
    return null;
  }
}

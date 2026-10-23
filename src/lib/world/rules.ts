/**
 * Platzierungsregeln für eigene Deko: prüfen (mit kurzem Grund) und einrasten (nächste gültige Stelle).
 * Dieselben Funktionen laufen im Browser (Live-Vorschau) und auf dem Server (Speichern).
 */

import { DEKO, type DekoTyp } from "./catalog";
import type { DekoItem } from "./doc";
import { box, circle, toWorld, type Shape } from "./geom";
import { heightAt, waterEdgeDist, type WorldMap } from "./map";
import { REASONS, type ClaimKind, type Conflict, type Space } from "./space";

const DEG = Math.PI / 180;

/** Grundfläche eines Deko-Elements in Weltkoordinaten. */
export function dekoShape(item: Pick<DekoItem, "typ" | "x" | "z" | "r">): Shape {
  const f = DEKO[item.typ].form;
  return f.kind === "circle"
    ? circle(item.x, item.z, f.r)
    : box(item.x, item.z, f.hw, f.hd, item.r * DEG);
}

/** Steht die Grundfläche flach genug (keine Schräglage im Hang)? */
export function groundOk(map: WorldMap, s: Shape): boolean {
  const pts =
    s.kind === "circle"
      ? [
          [s.x, s.z],
          [s.x + s.r, s.z],
          [s.x - s.r, s.z],
          [s.x, s.z + s.r],
          [s.x, s.z - s.r],
        ]
      : [
          [s.x, s.z],
          ...[-1, 1].flatMap((a) =>
            [-1, 1].map((b) => {
              const p = toWorld(s.x, s.z, s.angle, a * s.hw, b * s.hd);
              return [p.x, p.z];
            }),
          ),
        ];
  const hs = pts.map(([x, z]) => heightAt(map, x, z));
  const span = Math.max(...hs) - Math.min(...hs);
  const size = s.kind === "circle" ? s.r * 2 : 2 * Math.max(s.hw, s.hd);
  return span <= 0.25 && span / Math.max(size, 0.5) <= 0.12;
}

const ALL_BUT_PLAZA: ReadonlySet<ClaimKind> = new Set([
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
  "frontzone",
]);
const ALL_BUT_FRONT: ReadonlySet<ClaimKind> = new Set([
  "platz",
  "knoten",
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
]);
const PLAZA_NO_FRONT: ReadonlySet<ClaimKind> = new Set([
  "grundstueck",
  "sichtzone",
  "deko",
  "deko-hoch",
  "merkmal",
  "terrasse",
]);

/** Prüft ein Deko-Element gegen die Welt. `null` = gültig, sonst kurzer Grund. */
export function checkDeko(
  space: Space,
  item: DekoItem,
  ignore?: ReadonlySet<string>,
): Conflict | null {
  const e = DEKO[item.typ];
  const s = dekoShape(item);
  const map = space.map;
  if (!space.inBounds(s)) return { grund: REASONS.karte };
  if (!groundOk(map, s)) return { grund: REASONS.gelaende };
  if (e.wasser) {
    const steg = stegCheck(map, item);
    if (steg) return steg;
  }
  const kinds = e.aufPlatz
    ? e.hoch
      ? ALL_BUT_PLAZA
      : PLAZA_NO_FRONT
    : e.hoch
      ? undefined
      : ALL_BUT_FRONT;
  const ign = new Set(ignore ?? []);
  ign.add(`deko-${item.id}`);
  return space.conflict(s, {
    margin: 0.3,
    pathClearance: 0.25,
    ignore: ign,
    kinds,
    skipWater: e.wasser,
    asKind: "deko",
  });
}

/** Steg: Landende trocken am Ufer, Spitze über dem Wasser, Achse quer zum Ufer. */
function stegCheck(map: WorldMap, item: DekoItem): Conflict | null {
  const hd = (DEKO.steg.form as { hd: number }).hd;
  const at = (lz: number) => {
    const p = toWorld(item.x, item.z, item.r * DEG, 0, lz);
    return waterEdgeDist(map, p.x, p.z);
  };
  const dl = at(-hd + 0.3);
  const dm = at(0);
  const dt = at(hd - 0.3);
  if (!Number.isFinite(dl)) return { grund: "braucht Wasser in der Nähe" };
  if (dl < 0.1) return { grund: "Landende im Wasser" };
  if (dl > 1.6) return { grund: "nicht am Ufer" };
  if (dt > -0.6) return { grund: "zeigt nicht aufs Wasser" };
  if (!(dm < dl - 0.4 && dt < dm - 0.4)) return { grund: "nicht quer zum Ufer" };
  return null;
}

/** Richtung (Grad, 15er-Schritte) vom Punkt zum nächsten Wasser (für den Steg). */
function towardWater(map: WorldMap, x: number, z: number): number {
  const e = 0.5;
  const gx = waterEdgeDist(map, x + e, z) - waterEdgeDist(map, x - e, z);
  const gz = waterEdgeDist(map, x, z + e) - waterEdgeDist(map, x, z - e);
  // lokale +z-Achse = (sin a, cos a) soll zum Wasser zeigen (gegen den Gradienten)
  const a = Math.atan2(-gx, -gz) / DEG;
  return (((Math.round(a / 15) * 15) % 360) + 360) % 360;
}

const snapGrid = (v: number) => Math.round(v * 4) / 4;

/**
 * Rastet ein Element auf die nächste gültige Stelle ein (Raster 0.25 m, Drehung bleibt; der Steg dreht sich
 * zum Wasser). Sucht spiralförmig bis 3 m. `null` = hier ist nichts möglich.
 */
export function snapDeko(
  space: Space,
  item: DekoItem,
  ignore?: ReadonlySet<string>,
): DekoItem | null {
  const base = { ...item, x: snapGrid(item.x), z: snapGrid(item.z) };
  const orient = (it: DekoItem): DekoItem => {
    if (!DEKO[it.typ].wasser) return it;
    // Steg: Mitte so legen, dass das Landende am Ufer liegt
    const r = towardWater(space.map, it.x, it.z);
    return { ...it, r };
  };
  const first = orient(base);
  if (!checkDeko(space, first, ignore)) return first;
  for (let d = 0.25; d <= 3.0001; d += 0.25) {
    const steps = Math.max(8, Math.round((2 * Math.PI * d) / 0.25));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      const cand = orient({
        ...base,
        x: snapGrid(base.x + Math.cos(a) * d),
        z: snapGrid(base.z + Math.sin(a) * d),
      });
      if (!checkDeko(space, cand, ignore)) return cand;
    }
  }
  return null;
}

/** Trägt gültige Deko ins Register ein; ungültige landet mit Grund in `rejected`. */
export function applyDeko(space: Space, items: DekoItem[]) {
  const placed: DekoItem[] = [];
  const rejected: { id: string; typ: DekoTyp; grund: string }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) {
      rejected.push({ id: it.id, typ: it.typ, grund: "doppelt" });
      continue;
    }
    seen.add(it.id);
    const c = checkDeko(space, it);
    if (c) {
      rejected.push({ id: it.id, typ: it.typ, grund: c.grund });
      continue;
    }
    const kind = DEKO[it.typ].hoch ? "deko-hoch" : "deko";
    space.addClaim({
      id: `deko-${it.id}`,
      kind,
      shape: dekoShape(it),
      label: `zu nah an: ${DEKO[it.typ].label}`,
    });
    placed.push(it);
  }
  return { placed, rejected };
}

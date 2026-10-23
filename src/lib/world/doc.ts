import { z } from "zod";
import { FACH_ORDER, type FachbereichId } from "../fachbereiche";
import { DIRECTIONS } from "./axes";
import { DEKO_TYPEN, MAX_DEKO } from "./catalog";

/**
 * Platzierungen eines Dorfs (Spalte `village_worlds.placements`, Version 1). Alles, was der Besitzer
 * festgelegt hat: fixierte Quartiere und Häuser, eigene Deko und Varianten pro Haus. Was hier fehlt,
 * bestimmt die Automatik aus dem Seed.
 */

const fachSchema = z.enum(FACH_ORDER as [FachbereichId, ...FachbereichId[]]);
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/);

export const dekoItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  typ: z.enum(DEKO_TYPEN),
  x: z.number().finite().min(-150).max(150),
  z: z.number().finite().min(-150).max(150),
  /** Drehung in Grad, in 15°-Schritten. */
  r: z
    .number()
    .int()
    .min(0)
    .max(345)
    .refine((v) => v % 15 === 0, "Drehung in 15°-Schritten."),
});
export type DekoItem = z.infer<typeof dekoItemSchema>;

export const FARBEN = 4;
export const ANBAUTEN = ["keiner", "laube", "schuppen", "wintergarten"] as const;
export const GAERTEN = ["blumen", "gemuese", "stein", "obst"] as const;
export type Anbau = (typeof ANBAUTEN)[number];
export type Garten = (typeof GAERTEN)[number];

export const varianteSchema = z.object({
  /** Farbpalette 0…3 (0 = Grundton des Fachbereichs). */
  farbe: z
    .number()
    .int()
    .min(0)
    .max(FARBEN - 1)
    .optional(),
  /** Dachform 0…2 (je Haustyp kuratiert). */
  dach: z.number().int().min(0).max(2).optional(),
  anbau: z.enum(ANBAUTEN).optional(),
  garten: z.enum(GAERTEN).optional(),
});
export type Variante = z.infer<typeof varianteSchema>;

export const worldDocSchema = z.object({
  v: z.literal(1),
  quartiere: z
    .partialRecord(
      fachSchema,
      z
        .array(
          z
            .number()
            .int()
            .min(0)
            .max(DIRECTIONS - 1),
        )
        .max(DIRECTIONS),
    )
    .optional(),
  haeuser: z
    .record(
      idSchema,
      z.union([
        // Bauplatz an einer Gasse (v1 und v2)
        z.object({
          r: z
            .number()
            .int()
            .min(0)
            .max(DIRECTIONS - 1),
          s: z.string().regex(/^(p[01]|g\d{1,2})$/),
        }),
        // Freie Lage der Hausmitte im Quartier (nur v2; Ausrichtung automatisch)
        z.object({
          r: z
            .number()
            .int()
            .min(0)
            .max(DIRECTIONS - 1),
          x: z.number().finite().min(-150).max(150),
          z: z.number().finite().min(-150).max(150),
        }),
      ]),
    )
    .optional(),
  deko: z.array(dekoItemSchema).max(MAX_DEKO).optional(),
  varianten: z.record(idSchema, varianteSchema).optional(),
});
export type WorldDoc = z.infer<typeof worldDocSchema>;

export const EMPTY_DOC: WorldDoc = { v: 1 };

/** Liest gespeicherte Platzierungen tolerant: Ungültiges wird verworfen, nie übernommen. */
export function parseDoc(raw: unknown): WorldDoc {
  const r = worldDocSchema.safeParse(raw);
  if (r.success) return r.data;
  // Teilweise retten: nur gültige Deko-Elemente und Varianten behalten
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const deko = Array.isArray(obj.deko)
    ? obj.deko.flatMap((d) => {
        const p = dekoItemSchema.safeParse(d);
        return p.success ? [p.data] : [];
      })
    : [];
  return { v: 1, deko: deko.slice(0, MAX_DEKO) };
}

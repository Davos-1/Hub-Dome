"use server";

import { worldDocSchema } from "@/lib/world/doc";
import { seedSchema } from "@/lib/world/seed";
import type { RerollWorldResult, SaveWorldResult } from "@/lib/world/types";
import { z } from "zod";
import { setDevDoc } from "./dev-store";

/**
 * Attrappen der Welt-Aktionen für die Entwickler-Vorschau `/dev/dorf` (ohne Datenbank, nur ausserhalb von
 * Produktion): prüfen die Eingabe wie die echten Actions, speichern aber nichts.
 */

const off = { error: "Nur in der Entwicklung verfügbar." } as const;

/** Speichert im Speicher des Dev-Servers (`seed` kommt in der Vorschau aus der Adresse). */
export async function devSaveWorld(seed: string, input: unknown): Promise<SaveWorldResult> {
  if (process.env.NODE_ENV === "production") return off;
  const doc = worldDocSchema.safeParse(input);
  if (!doc.success || !seedSchema.safeParse(seed).success)
    return { error: "Die Platzierungen sind ungültig." };
  setDevDoc(seed, doc.data);
  return { ok: true };
}

export async function devRerollWorld(input: unknown): Promise<RerollWorldResult> {
  if (process.env.NODE_ENV === "production") return off;
  const ok = z
    .object({ seed: seedSchema, resetPlacements: z.boolean() })
    .passthrough()
    .safeParse(input).success;
  return ok ? { ok: true, entfernt: 0 } : { error: "Ungültige Eingabe." };
}

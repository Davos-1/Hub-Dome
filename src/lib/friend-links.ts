import { z } from "zod";

/** Gültigkeit eines Freundschaftslinks in Tagen. */
export const FRIEND_LINK_DAYS = 7;

export const friendLinkSchema = z.object({
  maxUses: z.coerce
    .number({ message: "Bitte eine Zahl angeben." })
    .int("Bitte eine ganze Zahl angeben.")
    .min(1, "Mindestens 1 Person.")
    .max(100, "Höchstens 100 Personen."),
});

/** Aus einem eingefügten Link (oder nur dem Code) den Token holen. */
export function friendTokenFrom(input: string): string | null {
  const raw = input.trim();
  const path = URL.parse(raw)?.pathname ?? raw.split(/[?#]/)[0];
  const t = path.split("/").filter(Boolean).at(-1) ?? "";
  return /^[A-Za-z0-9_-]{16,}$/.test(t) ? t : null;
}

/** Zustand eines Links laut `friend_link_info`; alles ausser `ok` verhindert das Annehmen. */
export type FriendLinkState =
  "ok" | "ungueltig" | "abgelaufen" | "aufgebraucht" | "selbst" | "befreundet";

export const FRIEND_LINK_MESSAGES: Record<Exclude<FriendLinkState, "ok">, string> = {
  ungueltig: "Dieser Freundschaftslink ist ungültig oder wurde widerrufen.",
  abgelaufen: "Dieser Freundschaftslink ist abgelaufen. Bitte um einen neuen.",
  aufgebraucht: "Dieser Freundschaftslink wurde schon von allen erlaubten Personen genutzt.",
  selbst: "Das ist dein eigener Freundschaftslink. Schicke ihn an andere Personen.",
  befreundet: "Ihr seid schon befreundet.",
};

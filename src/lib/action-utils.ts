import "server-only";
import { revalidatePath } from "next/cache";

/** Nach einer Mutation: alle Seiten unter dem Root-Layout (Welt, Dialoge) neu laden. */
export function refreshAll() {
  revalidatePath("/", "layout");
}

/**
 * Meldung einer Datenbankfunktion anzeigen, aber nur, wenn sie selbst eine deutsche Meldung wirft
 * (`raise exception` = SQLSTATE P0001). Andere Fehler (Constraints, RLS, Netz) bleiben intern.
 */
export function raisedMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "P0001") return error.message;
  console.error(fallback, error.code, error.message);
  return fallback;
}

import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Wartefrist für «Konto löschen» (Entscheid Gian: ein Tag). */
const GRACE_MS = 24 * 3600 * 1000;

const authorized = (header: string | null) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Täglicher Vercel-Cron (vercel.json): löscht Konten, deren Löschantrag älter als die Wartefrist ist.
 * Der Auth-User wird gelöscht; Profil, Dorf, Objekte usw. folgen per on delete cascade.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response("Nicht erlaubt.", { status: 401 });
  }
  // Systemaufgabe über alle Konten: bewusst ohne owner_id-Filter (siehe docs/ENTSCHEIDUNGEN.md)
  const db = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();
  const { data, error } = await db
    .from("account_deletions")
    .select("user_id")
    .lte("requested_at", cutoff)
    .order("requested_at")
    .limit(100);
  if (error) return Response.json({ error: "Abfrage fehlgeschlagen." }, { status: 500 });

  let deleted = 0;
  for (const row of data ?? []) {
    const { error: deleteError } = await db.auth.admin.deleteUser(row.user_id);
    if (deleteError) console.error("Konto löschen fehlgeschlagen", row.user_id, deleteError.message);
    else deleted++;
  }
  return Response.json({ deleted, pending: (data?.length ?? 0) - deleted });
}

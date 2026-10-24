import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Liefert User und Profil. Leitet auf /login bzw. /onboarding um, wenn nötig. */
export async function requireProfile() {
  await connection(); // Auth nutzt die aktuelle Zeit: erst zur Anfragezeit rendern
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    // Alle Spalten: `time_mode` (Phase 4h) gibt es erst nach der Migration
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  return { supabase, user: data.user, profile };
}

/** Für Server Actions: eingeloggter User mit RLS-Client (ohne Onboarding-Prüfung). */
export async function requireUser() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

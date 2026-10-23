import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Für Server Actions: eingeloggter User mit RLS-Client (ohne Onboarding-Prüfung). */
export async function requireUser() {
  await connection(); // Auth nutzt die aktuelle Zeit: erst zur Anfragezeit rendern
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

/** Liefert User und Profil. Leitet auf /login bzw. /onboarding um, wenn nötig. */
export async function requireProfile() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_seed, onboarded")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  return { supabase, user, profile };
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Liefert User und Profil. Leitet auf /login bzw. /onboarding um, wenn nötig. */
export async function requireProfile() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_seed, onboarded")
    .eq("id", data.user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  return { supabase, user: data.user, profile };
}

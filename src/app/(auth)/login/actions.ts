"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { emailSchema, safeNextPath } from "@/lib/validation";

/**
 * Anmelde-Link per Mail anfordern. Bewusst serverseitig und ohne PKCE (`flowType: "implicit"`):
 * Nur so enthält die Mail einen `token_hash`, der auch in einem anderen Browser oder Gerät gilt.
 * Ein PKCE-Token (`pkce_…`) liesse sich nur im Browser einlösen, in dem der Link angefordert wurde.
 */
export async function sendMagicLink(
  email: string,
  next: string | undefined,
): Promise<{ error?: string }> {
  const parsed = emailSchema.safeParse(email.trim());
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callback = new URL("/auth/callback", origin);
  // `next` immer setzen: die Mail-Vorlage hängt `&token_hash=…` an diese Adresse an.
  callback.searchParams.set("next", safeNextPath(next));

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: callback.toString() },
  });
  if (error)
    return { error: "Der Link konnte nicht gesendet werden. Bitte später erneut versuchen." };
  return {};
}

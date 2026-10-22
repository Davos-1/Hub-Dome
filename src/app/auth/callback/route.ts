import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

const otpType = z.enum(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

/**
 * Schliesst die Anmeldung ab: Google liefert einen PKCE-`code`, der Mail-Link einen `token_hash`
 * (Vorlagen in Supabase, siehe docs/DEPLOYMENT.md). Der `token_hash` funktioniert auch in einem
 * anderen Browser als dem, in dem der Link angefordert wurde.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = otpType.safeParse(searchParams.get("type"));

  if (tokenHash && type.success) {
    // Nicht hier per GET einlösen: Mail-Scanner rufen Links vorab auf und verbrauchen den
    // Einmal-Token. Die Bestätigungsseite löst ihn erst nach einem Klick (POST) ein.
    const confirm = new URL("/bestaetigen", origin);
    confirm.searchParams.set("token_hash", tokenHash);
    confirm.searchParams.set("type", type.data);
    confirm.searchParams.set("next", safeNextPath(searchParams.get("next")));
    return NextResponse.redirect(confirm);
  }

  const supabase = await createClient();
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("exchangeCodeForSession fehlgeschlagen:", error.code, error.message);
    ok = !error;
  }

  if (ok) {
    // Anmelden innerhalb der Wartefrist bricht eine beantragte Kontolöschung ab.
    await supabase.rpc("cancel_account_deletion");
    return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
  }
  if (!code && !tokenHash) {
    // Alte Mail-Vorlage: Supabase hängt die Sitzung als `#access_token=…` an (für den Server
    // unsichtbar). Der Browser behält das Fragment bei der Umleitung; die Login-Seite übernimmt es.
    const login = new URL("/login", origin);
    login.searchParams.set("next", safeNextPath(searchParams.get("next")));
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(new URL("/login?fehler=1", origin));
}

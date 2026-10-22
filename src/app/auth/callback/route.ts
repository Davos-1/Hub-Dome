import type { EmailOtpType } from "@supabase/supabase-js";
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

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type.data as EmailOtpType,
    });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    // Anmelden innerhalb der Wartefrist bricht eine beantragte Kontolöschung ab.
    await supabase.rpc("cancel_account_deletion");
    return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
  }
  return NextResponse.redirect(new URL("/login?fehler=1", origin));
}

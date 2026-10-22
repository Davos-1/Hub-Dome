import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/** Tauscht den Code aus Magic Link bzw. Google-Login gegen eine Session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Anmelden innerhalb der Wartefrist bricht eine beantragte Kontolöschung ab.
      await supabase.rpc("cancel_account_deletion");
      return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
    }
  }
  return NextResponse.redirect(new URL("/login?fehler=1", origin));
}

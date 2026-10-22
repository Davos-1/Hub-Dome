import { createClient } from "@/lib/supabase/server";

/** Nach einer Anmeldung im Browser (Sitzung aus dem Fragment): bricht eine beantragte Kontolöschung ab. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.rpc("cancel_account_deletion");
  return new Response(null, { status: 204 });
}

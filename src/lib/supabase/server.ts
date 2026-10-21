import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Supabase-Client für Server Components, Server Actions und Route Handler (läuft als der eingeloggte User, RLS gilt). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // In Server Components nicht schreibbar – der Proxy aktualisiert die Session.
        }
      },
    },
  });
}

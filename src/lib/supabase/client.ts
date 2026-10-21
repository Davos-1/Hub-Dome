import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Supabase-Client für Client Components (Browser). */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

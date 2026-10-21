import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service-Role-Client: umgeht RLS. Nur serverseitig und nur mit explizitem `owner_id`-Filter verwenden
 * (siehe CLAUDE.md).
 */
export function createAdminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

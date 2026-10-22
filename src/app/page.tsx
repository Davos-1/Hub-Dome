import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Startadresse: eingeloggt in die eigene Welt, sonst zur Anmeldung. */
async function Home() {
  await connection(); // Auth nutzt die aktuelle Zeit: erst zur Anfragezeit rendern
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/start" : "/login");
  return null;
}

export default function HomePage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

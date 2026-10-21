import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { signOut } from "./actions";

export const metadata = { title: "Meine Dörfer – Hub Dome" };

async function DoerferContent() {
  const { supabase, profile } = await requireProfile();
  const { data: village } = await supabase
    .from("villages")
    .select("name")
    .eq("owner_id", profile.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Meine Dörfer</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm underline">
            Abmelden
          </button>
        </form>
      </header>
      <section className="rounded-lg border border-zinc-300 p-4">
        <h2 className="text-xl font-semibold">{village?.name}</h2>
        <p className="text-sm text-zinc-500">
          @{profile.username} · Hallo {profile.display_name}! Die Dorfansicht folgt in den nächsten
          Phasen.
        </p>
      </section>
    </main>
  );
}

export default function DoerferPage() {
  return (
    <Suspense>
      <DoerferContent />
    </Suspense>
  );
}

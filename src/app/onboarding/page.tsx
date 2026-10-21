import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Willkommen – Hub Dome" };

async function OnboardingContent() {
  await connection(); // Auth nutzt die aktuelle Zeit: erst zur Anfragezeit rendern
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded")
    .eq("id", data.user.id)
    .single();
  if (profile?.onboarded) redirect("/start");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Willkommen in Hub Dome</h1>
      <p>Wähle deinen Namen. Danach wird dein Dorf mit der Zentrale angelegt.</p>
      <OnboardingForm suggestedName={profile?.display_name ?? ""} />
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

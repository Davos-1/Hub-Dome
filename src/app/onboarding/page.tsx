import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/ui/auth-card";
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
    <AuthCard title="Willkommen in Hub Dome" kicker="Erste Schritte">
      <p className="text-[14px]">
        Wähle deinen Namen. Danach wird dein Dorf mit der Zentrale angelegt.
      </p>
      <OnboardingForm suggestedName={profile?.display_name ?? ""} />
    </AuthCard>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

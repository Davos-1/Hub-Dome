"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, safeNextPath } from "@/lib/validation";

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_username: parsed.data.username,
    p_display_name: parsed.data.displayName,
  });
  if (error) return { error: error.message };

  redirect(safeNextPath(String(formData.get("next") ?? ""), "/start"));
}

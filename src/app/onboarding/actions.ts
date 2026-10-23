"use server";

import { redirect } from "next/navigation";
import { raisedMessage } from "@/lib/action-utils";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, onboardingSchema, safeNextPath } from "@/lib/validation";

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_username: parsed.data.username,
    p_display_name: parsed.data.displayName,
  });
  if (error) return { error: raisedMessage(error, "Das Dorf konnte nicht angelegt werden.") };

  redirect(safeNextPath(String(formData.get("next") ?? ""), "/start"));
}

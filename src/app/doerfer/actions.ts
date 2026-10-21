"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Viewer verlässt ein fremdes Dorf (RLS erlaubt nur das Löschen des eigenen Zugriffs). */
export async function leaveVillage(_: ActionState, formData: FormData): Promise<ActionState> {
  const villageId = String(formData.get("villageId"));
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("village_access")
    .delete()
    .eq("village_id", villageId)
    .eq("viewer_id", user.id);
  if (error) return { error: "Das Dorf konnte nicht verlassen werden." };
  revalidatePath("/", "layout");
  return { ok: true };
}

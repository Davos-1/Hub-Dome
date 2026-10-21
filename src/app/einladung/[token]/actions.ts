"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

export async function acceptInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const { supabase } = await requireUser();

  const { data: villageId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: error.message };

  const { data: village } = await supabase
    .from("villages")
    .select("owner:profiles!villages_owner_id_fkey(username)")
    .eq("id", villageId)
    .single();
  const owner = village?.owner as unknown as { username: string } | null;
  redirect(owner ? `/dorf/${owner.username}` : "/doerfer");
}

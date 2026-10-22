"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

const input = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["email", "magiclink", "signup", "invite", "recovery", "email_change"]),
  next: z.string().optional(),
});

/** Löst den Mail-Link erst nach einem Klick ein (POST), damit Link-Scanner ihn nicht verbrauchen. */
export async function confirmLogin(formData: FormData) {
  const parsed = input.safeParse({
    token_hash: formData.get("token_hash"),
    type: formData.get("type"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) redirect("/login?fehler=1");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.token_hash,
    type: parsed.data.type as EmailOtpType,
  });
  if (error) {
    console.error("verifyOtp fehlgeschlagen:", error.code, error.message);
    redirect("/login?fehler=1");
  }
  // Anmelden innerhalb der Wartefrist bricht eine beantragte Kontolöschung ab.
  await supabase.rpc("cancel_account_deletion");
  redirect(safeNextPath(parsed.data.next));
}

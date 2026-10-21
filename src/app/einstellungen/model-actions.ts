"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { inspectGlb } from "@/lib/glb";
import type { ActionState } from "@/lib/types";

const BUCKET = "village-models";

async function ownVillage() {
  const { supabase, user } = await requireUser();
  const { data: village } = await supabase
    .from("villages")
    .select("id, zentrale_style")
    .eq("owner_id", user.id)
    .single();
  return { supabase, user, village };
}

/**
 * Nach dem Browser-Upload: lädt die Datei aus dem privaten Speicher und prüft sie **auf dem Server**
 * (Aufbau, Grösse, Dreiecke, keine externen Verweise). Ungültige Dateien werden sofort gelöscht.
 */
export async function registerModel(): Promise<ActionState> {
  const { supabase, user, village } = await ownVillage();
  if (!village) return { error: "Dorf nicht gefunden." };
  const path = `${village.id}/zentrale.glb`;

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !blob) return { error: "Die hochgeladene Datei wurde nicht gefunden." };

  const result = inspectGlb(new Uint8Array(await blob.arrayBuffer()));
  if (!result.ok) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: result.error };
  }

  const { error: updateError } = await supabase
    .from("villages")
    .update({
      zentrale_model_meta: {
        bytes: result.bytes,
        triangles: result.triangles,
        textures: result.textures,
        uploaded_at: new Date().toISOString(),
      },
    })
    .eq("id", village.id)
    .eq("owner_id", user.id);
  if (updateError) return { error: "Das Modell konnte nicht gespeichert werden." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Löscht das hochgeladene Modell; war «Eigenes Modell» aktiv, wechselt die Zentrale zurück zum Rathaus. */
export async function deleteModel(): Promise<ActionState> {
  const { supabase, user, village } = await ownVillage();
  if (!village) return { error: "Dorf nicht gefunden." };

  await supabase.storage.from(BUCKET).remove([`${village.id}/zentrale.glb`]);
  const { error } = await supabase
    .from("villages")
    .update({
      zentrale_model_meta: null,
      ...(village.zentrale_style === "custom" ? { zentrale_style: "rathaus" } : {}),
    })
    .eq("id", village.id)
    .eq("owner_id", user.id);
  if (error) return { error: "Das Modell konnte nicht gelöscht werden." };

  revalidatePath("/", "layout");
  return { ok: true };
}

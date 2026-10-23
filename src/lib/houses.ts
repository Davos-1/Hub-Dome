import type { SupabaseClient } from "@supabase/supabase-js";

type NewHouse = {
  kind: "modul" | "thema";
  title: string;
  module_code: string | null;
  color?: string;
  semester?: number | null;
};

/**
 * Legt ein Haus am Ende des Dorfs an (`position_index` = bisherige Anzahl Häuser). Läuft mit dem
 * RLS-Client des Users; RLS lässt nur Häuser im eigenen Dorf zu.
 */
export async function insertHouse(supabase: SupabaseClient, villageId: string, house: NewHouse) {
  const { count } = await supabase
    .from("houses")
    .select("id", { count: "exact", head: true })
    .eq("village_id", villageId);
  const { semester, ...rest } = house;
  return supabase
    .from("houses")
    .insert({
      ...rest,
      village_id: villageId,
      // Spalte `semester` nur schreiben, wenn gesetzt (ältere Datenbanken ohne Migration 5 funktionieren weiter)
      ...(semester == null ? {} : { semester }),
      position_index: count ?? 0,
    })
    .select("id, title")
    .single<{ id: string; title: string }>();
}

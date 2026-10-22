import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Öffnet ein Objekt und zählt das Öffnen (eine Zeile pro Person, siehe `record_item_event`).
 * Links darauf sind normale `<a target="_blank">`, kein `next/link`: Prefetch würde sonst mitzählen.
 */
export async function GET(request: Request, { params }: RouteContext<"/o/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Nicht gefunden.", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/o/${id}`);
    return Response.redirect(login, 302);
  }

  // RLS entscheidet, ob das Objekt sichtbar ist
  const { data: item } = await supabase.from("artifacts").select("url").eq("id", id).maybeSingle();
  if (!item) return new Response("Nicht gefunden.", { status: 404 });

  await supabase.rpc("record_item_event", { p_artifact: id, p_event: "geoeffnet" });
  return new Response(null, {
    status: 302,
    headers: { Location: item.url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}

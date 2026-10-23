import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { LINK_ITEM_TYPES } from "@/lib/item-types";
import { ARTIFACT_KINDS } from "@/lib/types";
import { artifactSchema, firstIssue } from "@/lib/validation";

/**
 * Kernlogik der MCP-Tools. Läuft mit dem Service-Role-Client (umgeht RLS) und filtert deshalb **jede** Abfrage
 * ausdrücklich nach dem Besitzer des Tokens (`owner_id`, bzw. über sein Dorf). Keine Abhängigkeit von Next.js,
 * damit sich alles gegen die echte Datenbank testen lässt.
 */
export type McpContext = {
  db: SupabaseClient;
  userId: string;
  /** Basis-URL der Website für Links in den Antworten. */
  siteUrl: string;
  /** Nach dem Platzieren (z.B. GitHub-Vorschau laden), optional. */
  afterPlace?: (artifactId: string) => void;
};

export type ToolResult = { ok: boolean; text: string; data?: unknown };

const fail = (text: string): ToolResult => ({ ok: false, text });
const invalidInput = (error: { issues: { message: string }[] }) =>
  fail(`Ungültige Eingabe: ${firstIssue(error)}`);
const noVillage = () =>
  fail("Dein Dorf wurde noch nicht angelegt. Schliesse zuerst die Einrichtung auf der Website ab.");

/** Die Eingaben der Tools (deutsche Namen, wie in PLAN.md Abschnitt 8.1). */
export const placeInputShape = {
  url: z
    .string()
    .trim()
    .max(2048, "Der Link ist zu lang.")
    .describe("Link des Objekts, z.B. https://claude.ai/artifact/… oder eine GitHub-URL."),
  titel: z
    .string()
    .trim()
    .max(120, "Maximal 120 Zeichen.")
    .describe("Kurzer Titel (max. 120 Zeichen)."),
  beschreibung: z
    .string()
    .trim()
    .max(500, "Maximal 500 Zeichen.")
    .optional()
    .describe("Beschreibung in einem Satz (max. 500 Zeichen)."),
  typ: z
    .enum(ARTIFACT_KINDS)
    .optional()
    .describe(
      "Inhaltskategorie: rechner, quiz, zusammenfassung, cheatsheet, tool, visualisierung oder sonstiges (Standard).",
    ),
  objekt_typ: z
    .enum([...LINK_ITEM_TYPES, "auto"])
    .optional()
    .describe(
      "Objekttyp: claude_artifact, github_repo, gist, cloud_ordner, link oder auto (Standard: wird aus der URL erkannt).",
    ),
  tags: z
    .array(z.string().trim().max(30, "Ein Tag darf höchstens 30 Zeichen haben."))
    .max(5, "Höchstens 5 Tags.")
    .optional()
    .describe("1–3 kurze Tags, höchstens 5."),
  haus_id: z
    .string()
    .trim()
    .max(64)
    .optional()
    .describe("ID eines Hauses aus dorf_haeuser_auflisten."),
  haus_titel: z
    .string()
    .trim()
    .max(80, "Maximal 80 Zeichen.")
    .optional()
    .describe("Titel des Hauses (genau wie in dorf_haeuser_auflisten), alternativ zu haus_id."),
  sichtbarkeit: z
    .enum(["shared", "private"])
    .optional()
    .describe("shared = für Freunde sichtbar (Standard), private = nur für den Besitzer."),
  im_topdorf_zeigen: z
    .boolean()
    .optional()
    .describe(
      "Für alle angemeldeten Hub-Dome-Nutzer sichtbar machen (nur bei shared). Nur setzen, wenn der User es ausdrücklich sagt.",
    ),
};
const placeInput = z.object(placeInputShape);

export const createHouseInputShape = {
  titel: z
    .string()
    .trim()
    .max(80, "Maximal 80 Zeichen.")
    .describe("Titel des Hauses (max. 80 Zeichen)."),
  modul_code: z
    .string()
    .trim()
    .max(40, "Ungültiger Modulcode.")
    .optional()
    .describe(
      "Optionaler Modulcode aus dem Katalog (z.B. TA.BA_BAUSTATIK1). Ohne Code entsteht ein Themenhaus.",
    ),
};
const createHouseInput = z.object(createHouseInputShape);

export const recentInputShape = {
  anzahl: z.number().int().min(1).max(20).optional().describe("Wie viele (1–20, Standard 5)."),
};
const recentInput = z.object(recentInputShape);

type HouseRow = { id: string; kind: string; title: string; module_code: string | null };

async function loadOwnVillage(ctx: McpContext) {
  const { data: village } = await ctx.db
    .from("villages")
    .select("id")
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!village) return null;
  const { data: profile } = await ctx.db
    .from("profiles")
    .select("username")
    .eq("id", ctx.userId)
    .maybeSingle();
  const { data: houses } = await ctx.db
    .from("houses")
    .select("id, kind, title, module_code")
    .eq("village_id", village.id)
    .order("position_index")
    .order("created_at");
  return {
    id: village.id as string,
    link: `${ctx.siteUrl}/dorf/${profile?.username ?? ""}`,
    houses: (houses ?? []) as HouseRow[],
  };
}

const houseLabel = (h: HouseRow) => (h.kind === "zentrale" ? "Zentrale" : h.title);
const houseList = (houses: HouseRow[]) =>
  houses.map((h) => `«${houseLabel(h)}»`).join(", ") || "(noch keine Häuser)";

/** `dorf_haeuser_auflisten`: Häuser des Users mit Anzahl der Objekte. */
export async function listHouses(ctx: McpContext): Promise<ToolResult> {
  const village = await loadOwnVillage(ctx);
  if (!village) return noVillage();
  const { data: rows } = await ctx.db
    .from("artifacts")
    .select("house_id")
    .eq("owner_id", ctx.userId)
    .in(
      "house_id",
      village.houses.map((h) => h.id),
    );
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.house_id, (counts.get(r.house_id) ?? 0) + 1);
  const houses = village.houses.map((h) => ({
    id: h.id,
    titel: houseLabel(h),
    art: h.kind,
    modul_code: h.module_code,
    anzahl_objekte: counts.get(h.id) ?? 0,
  }));
  return {
    ok: true,
    text: `Dein Dorf: ${village.link}\nHäuser:\n${houses
      .map((h) => `- «${h.titel}» (id ${h.id}, ${h.art}, ${h.anzahl_objekte} Objekte)`)
      .join("\n")}`,
    data: { dorf: village.link, haeuser: houses },
  };
}

/** `artifact_platzieren` und `objekt_platzieren`: legt ein Objekt an oder aktualisiert es (gleiche URL). */
export async function placeArtifact(
  ctx: McpContext,
  rawInput: unknown,
  retried = false,
): Promise<ToolResult> {
  const input = placeInput.safeParse(rawInput);
  if (!input.success) return invalidInput(input.error);
  const i = input.data;

  const village = await loadOwnVillage(ctx);
  if (!village) return noVillage();

  // Haus nur aus den eigenen Häusern wählen (nie fremde IDs akzeptieren)
  let house: HouseRow | undefined;
  if (i.haus_id) {
    house = village.houses.find((h) => h.id === i.haus_id);
    if (!house) {
      return fail(
        `Das Haus mit dieser id gehört nicht zu deinem Dorf. Vorhandene Häuser: ${houseList(village.houses)}.`,
      );
    }
  } else if (i.haus_titel) {
    const wanted = i.haus_titel.trim().toLowerCase();
    house = village.houses.find((h) => houseLabel(h).toLowerCase() === wanted);
    if (!house) {
      return fail(
        `Es gibt kein Haus «${i.haus_titel}». Vorhandene Häuser: ${houseList(village.houses)}. Lege es mit haus_erstellen an oder wähle ein vorhandenes.`,
      );
    }
  } else {
    return fail(
      `Bitte haus_id oder haus_titel angeben. Vorhandene Häuser: ${houseList(village.houses)}.`,
    );
  }

  const parsed = artifactSchema.safeParse({
    houseId: house.id,
    url: i.url.trim(),
    itemType: i.objekt_typ ?? "auto",
    title: i.titel,
    description: i.beschreibung ?? "",
    kind: i.typ ?? "sonstiges",
    tags: (i.tags ?? []).join(","),
    visibility: i.sichtbarkeit ?? "shared",
  });
  if (!parsed.success) return invalidInput(parsed.error);
  const a = parsed.data;

  const { data: existing } = await ctx.db
    .from("artifacts")
    .select("id, url, is_copy")
    .eq("owner_id", ctx.userId)
    .eq("url", a.url)
    .maybeSingle();

  // Übernahmen bleiben privat und ausserhalb des Topdorfs.
  const visibility = existing?.is_copy ? "private" : a.visibility;
  const topdorf =
    i.im_topdorf_zeigen === undefined || existing?.is_copy
      ? {}
      : { topdorf_ok: i.im_topdorf_zeigen && visibility === "shared" };
  const values = {
    house_id: a.houseId,
    title: a.title,
    description: a.description,
    kind: a.kind,
    item_type: a.itemType,
    tags: a.tags,
    visibility,
    ...topdorf,
  };
  let id: string;
  let created = false;
  if (existing) {
    const { error } = await ctx.db
      .from("artifacts")
      .update({ ...values, meta: {}, meta_refreshed_at: null })
      .eq("id", existing.id)
      .eq("owner_id", ctx.userId);
    if (error) return fail("Das Objekt konnte nicht aktualisiert werden.");
    id = existing.id;
  } else {
    const { data, error } = await ctx.db
      .from("artifacts")
      .insert({ ...values, url: a.url, owner_id: ctx.userId })
      .select("id")
      .single();
    // Gleichzeitig dieselbe URL platziert: der andere Aufruf war schneller, also aktualisieren
    if (error?.code === "23505" && !retried) return placeArtifact(ctx, rawInput, true);
    if (error || !data) return fail("Das Objekt konnte nicht gespeichert werden.");
    id = data.id;
    created = true;
  }
  ctx.afterPlace?.(id);

  const shareHint =
    a.itemType === "claude_artifact" && visibility === "shared"
      ? " Hinweis: Damit deine Freunde es öffnen können, muss das Artifact in claude.ai mit «Jeder mit dem Link» geteilt sein."
      : "";
  return {
    ok: true,
    text: `${created ? "Platziert" : "Aktualisiert"}: «${a.title}» im Haus «${houseLabel(house)}» (${a.itemType}, ${visibility === "shared" ? "für Freunde sichtbar" : "nur für dich"}${topdorf.topdorf_ok ? ", im Topdorf" : ""}). Dein Dorf: ${village.link}.${shareHint}`,
    data: { id, neu: created, haus: houseLabel(house), dorf: village.link },
  };
}

/** `haus_erstellen`: Modul- oder Themenhaus. Gibt es den Titel schon, gibt es einen Fehler. */
export async function createHouse(ctx: McpContext, rawInput: unknown): Promise<ToolResult> {
  const input = createHouseInput.safeParse(rawInput);
  if (!input.success) return invalidInput(input.error);
  const village = await loadOwnVillage(ctx);
  if (!village) return noVillage();

  let title = input.data.titel.trim();
  let moduleCode: string | null = null;
  if (input.data.modul_code) {
    const { data: mod } = await ctx.db
      .from("module_catalog")
      .select("code, title")
      .eq("code", input.data.modul_code.trim())
      .maybeSingle();
    if (!mod)
      return fail(
        "Diesen Modulcode gibt es nicht im Katalog. Lege ein Themenhaus ohne modul_code an.",
      );
    moduleCode = mod.code;
    title = title || mod.title;
  }
  if (title.length < 1 || title.length > 80) return fail("Der Titel muss 1–80 Zeichen lang sein.");
  const taken = village.houses.find((h) => houseLabel(h).toLowerCase() === title.toLowerCase());
  if (taken) {
    return fail(
      `Es gibt schon ein Haus «${houseLabel(taken)}» (id ${taken.id}). Nutze dieses Haus.`,
    );
  }
  if (moduleCode && village.houses.some((h) => h.module_code === moduleCode)) {
    return fail("Für dieses Modul gibt es schon ein Haus. Nutze es mit dorf_haeuser_auflisten.");
  }

  const { data, error } = await ctx.db
    .from("houses")
    .insert({
      village_id: village.id,
      kind: moduleCode ? "modul" : "thema",
      title,
      module_code: moduleCode,
      position_index: village.houses.length,
    })
    .select("id")
    .single();
  if (error || !data) return fail("Das Haus konnte nicht angelegt werden.");
  return {
    ok: true,
    text: `Haus «${title}» angelegt (id ${data.id}). Dein Dorf: ${village.link}.`,
    data: { id: data.id, titel: title, dorf: village.link },
  };
}

/** `letzte_artifacts`: die zuletzt platzierten Objekte. */
export async function recentArtifacts(ctx: McpContext, rawInput: unknown): Promise<ToolResult> {
  const input = recentInput.safeParse(rawInput ?? {});
  if (!input.success) return invalidInput(input.error);
  const village = await loadOwnVillage(ctx);
  if (!village) return noVillage();
  const { data } = await ctx.db
    .from("artifacts")
    .select("id, title, url, kind, item_type, house_id, created_at")
    .eq("owner_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(input.data.anzahl ?? 5);
  const byId = new Map(village.houses.map((h) => [h.id, houseLabel(h)]));
  const items = (data ?? []).map((a) => ({
    id: a.id,
    titel: a.title,
    url: a.url,
    typ: a.kind,
    objekt_typ: a.item_type,
    haus: byId.get(a.house_id) ?? "?",
    erstellt: a.created_at,
  }));
  return {
    ok: true,
    text: `Zuletzt platziert (${items.length}):\n${items.map((x) => `- «${x.titel}» in «${x.haus}» (${x.objekt_typ})`).join("\n") || "(noch nichts)"}\nDein Dorf: ${village.link}`,
    data: { dorf: village.link, objekte: items },
  };
}

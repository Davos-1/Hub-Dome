import { z } from "zod";
import { detectItemType, LINK_ITEM_TYPES, urlMatchesType } from "@/lib/item-types";
import { ARTIFACT_KINDS } from "@/lib/types";

export const emailSchema = z.email({ message: "Bitte eine gültige E-Mail-Adresse eingeben." });

export const onboardingSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,24}$/, "3–24 Zeichen: Kleinbuchstaben, Zahlen, _ und -."),
  displayName: z
    .string()
    .trim()
    .min(1, "Bitte einen Namen angeben.")
    .max(60, "Maximal 60 Zeichen."),
});

/** Erste Fehlermeldung einer fehlgeschlagenen Zod-Prüfung. */
export function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0].message;
}

/** Erlaubt nur interne Pfade als Weiterleitungsziel (kein Open Redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/start") {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Farbe.");

/** Optionales Semester 1–12; leeres Feld → null. */
const semesterSchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z
    .number({ message: "Semester: eine Zahl von 1 bis 12." })
    .int("Semester: eine ganze Zahl.")
    .min(1, "Semester: 1 bis 12.")
    .max(12, "Semester: 1 bis 12.")
    .nullable(),
);

export const houseSchema = z
  .object({
    kind: z.enum(["modul", "thema"]),
    moduleCode: z.string().trim().optional(),
    title: z.string().trim().max(80, "Maximal 80 Zeichen.").optional(),
    color: hexColor.default("#8fb3ff"),
    semester: semesterSchema,
  })
  .refine((h) => h.kind !== "modul" || Boolean(h.moduleCode), {
    message: "Bitte ein Modul wählen.",
    path: ["moduleCode"],
  })
  .refine((h) => h.kind !== "thema" || Boolean(h.title), {
    message: "Bitte einen Titel für das Themenhaus angeben.",
    path: ["title"],
  });

export const houseUpdateSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(80, "Maximal 80 Zeichen."),
  color: hexColor,
  semester: semesterSchema,
});

/** Komma-getrennte Tags → bereinigte Liste (max. 5, je max. 30 Zeichen). */
const tagsSchema = z
  .string()
  .default("")
  .transform((s) =>
    [
      ...new Set(
        s
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].slice(0, 5),
  )
  .pipe(z.array(z.string().max(30, "Ein Tag darf höchstens 30 Zeichen haben.")));

const httpsUrl = z.url().refine((u) => URL.parse(u)?.protocol === "https:", {
  message: "Nur https://-Links sind erlaubt.",
});

/** Checkbox aus FormData: «on» = an, fehlend = aus. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const artifactSchema = z
  .object({
    houseId: z.uuid({ message: "Bitte ein Haus wählen." }),
    url: httpsUrl,
    itemType: z.enum([...LINK_ITEM_TYPES, "auto"]).default("auto"),
    title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(120, "Maximal 120 Zeichen."),
    description: z
      .string()
      .trim()
      .max(500, "Maximal 500 Zeichen.")
      .transform((d) => d || null),
    kind: z.enum(ARTIFACT_KINDS),
    tags: tagsSchema,
    visibility: z.enum(["shared", "private"]),
    allowCopy: checkbox,
    topdorfOk: checkbox,
  })
  .transform((d) => ({
    ...d,
    // Topdorf nur für geteilte Objekte
    topdorfOk: d.topdorfOk && d.visibility === "shared",
    itemType: d.itemType === "auto" ? detectItemType(d.url) : d.itemType,
  }))
  .refine((d) => urlMatchesType(d.itemType, d.url), {
    message: "Der Link passt nicht zum gewählten Objekttyp.",
    path: ["url"],
  });

/** Übernehmen: Quelle und Zielhaus (eigene Haus-ID oder «neu:<Modulcode>»). */
export const copySchema = z.object({
  source: z.uuid({ message: "Ungültiges Objekt." }),
  house: z.union([z.uuid(), z.string().regex(/^neu:[A-Za-z0-9_.-]{1,40}$/)], {
    message: "Bitte ein Haus wählen.",
  }),
});

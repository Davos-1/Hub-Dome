import { z } from "zod";

/** Nur claude.ai-Links sind als Artifact erlaubt (siehe PLAN.md Abschnitt 9). */
export const artifactUrlSchema = z.url().refine(
  (u) => {
    const url = URL.parse(u);
    return url?.protocol === "https:" && url.hostname === "claude.ai";
  },
  { message: "Nur https://claude.ai/-Links sind erlaubt." },
);

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

/** Erlaubt nur interne Pfade als Weiterleitungsziel (kein Open Redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/doerfer") {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}

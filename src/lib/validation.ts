import { z } from "zod";

/** Nur claude.ai-Links sind als Artifact erlaubt (siehe PLAN.md Abschnitt 9). */
export const artifactUrlSchema = z
  .url()
  .refine(
    (u) => {
      const url = URL.parse(u);
      return url?.protocol === "https:" && url.hostname === "claude.ai";
    },
    { message: "Nur https://claude.ai/-Links sind erlaubt." },
  );

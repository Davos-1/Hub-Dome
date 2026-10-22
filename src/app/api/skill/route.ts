import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { zipStore } from "@/lib/zip";

/** Skill als ZIP zum Hochladen in claude.ai (nur für angemeldete Nutzer). */
export async function GET() {
  await requireUser();
  const file = path.join(process.cwd(), "skill", "hub-dome-platzieren", "SKILL.md");
  const content = await readFile(file, "utf8");
  const zip = zipStore([{ path: "hub-dome-platzieren/SKILL.md", content }]);
  return new Response(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="hub-dome-platzieren.zip"',
      "Cache-Control": "private, max-age=300",
    },
  });
}

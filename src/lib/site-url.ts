import { headers } from "next/headers";

/** Adresse aus der Umgebung (lokal: localhost), wenn keine Anfrage zur Hand ist. */
export function envSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Öffentliche Adresse der App: zuerst aus der Anfrage, sonst aus der Umgebung (lokal: localhost). */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return envSiteUrl();
}

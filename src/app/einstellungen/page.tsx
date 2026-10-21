import { redirect } from "next/navigation";

/** Alte Adresse: die Einstellungen sind jetzt ein Dialog in der Welt. */
export default function EinstellungenPage() {
  redirect("/start?d=einstellungen&t=profil");
}

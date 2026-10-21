import { redirect } from "next/navigation";

/** Alte Adresse: die Dörfer-Übersicht ist jetzt der Dialog «Dörfer besuchen» in der Welt. */
export default function DoerferPage() {
  redirect("/start?d=reise");
}

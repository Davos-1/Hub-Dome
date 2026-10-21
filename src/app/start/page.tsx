import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { DIALOG_IDS } from "@/components/world/dialog-ids";

export const metadata = { title: "Hub Dome" };

/**
 * Einstieg nach dem Login: leitet in die eigene Welt und öffnet dort den Start-Dialog.
 * `?d=reise` bzw. `?d=einstellungen` öffnen stattdessen diesen Dialog (alte Adressen leiten hierher um).
 */
async function StartContent({ searchParams }: Pick<PageProps<"/start">, "searchParams">) {
  const { profile } = await requireProfile();
  const { d, t } = await searchParams;
  const dialog = (DIALOG_IDS as readonly string[]).find((x) => x === d) ?? "start";
  const q = new URLSearchParams({ d: dialog });
  if (typeof t === "string" && /^[a-z]{1,12}$/.test(t)) q.set("t", t);
  redirect(`/dorf/${profile.username}?${q.toString()}`);
  return null;
}

export default function StartPage(props: PageProps<"/start">) {
  return (
    <Suspense>
      <StartContent searchParams={props.searchParams} />
    </Suspense>
  );
}

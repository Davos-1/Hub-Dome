import { Suspense } from "react";
import { redirect } from "next/navigation";

export const metadata = { title: "Dorf – Hub Dome" };

// Platzhalter bis Phase 4 (3D-Ansicht): leitet auf die 2D-Liste um.
async function DorfRedirect({ params }: Pick<PageProps<"/dorf/[username]">, "params">) {
  const { username } = await params;
  redirect(`/dorf/${username}/liste`);
  return null;
}

export default function DorfPage(props: PageProps<"/dorf/[username]">) {
  return (
    <Suspense>
      <DorfRedirect params={props.params} />
    </Suspense>
  );
}

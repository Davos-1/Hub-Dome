import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { ActionForm } from "@/components/ui/action-form";
import { acceptInvite } from "./actions";

export const metadata = { title: "Einladung – Hub Dome" };

async function EinladungContent({ params }: Pick<PageProps<"/einladung/[token]">, "params">) {
  const { token } = await params;
  await requireProfile();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Einladung in ein Dorf</h1>
      <p>
        Du wurdest eingeladen, ein Dorf in Hub Dome anzusehen. Mit dem Annehmen siehst du die
        geteilten Objekte.
      </p>
      <ActionForm action={acceptInvite} submitLabel="Einladung annehmen" pendingLabel="Nehme an…">
        <input type="hidden" name="token" value={token} />
      </ActionForm>
    </main>
  );
}

export default function EinladungPage(props: PageProps<"/einladung/[token]">) {
  return (
    <Suspense>
      <EinladungContent params={props.params} />
    </Suspense>
  );
}

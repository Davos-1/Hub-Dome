import { Suspense } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { confirmLogin } from "./actions";

export const metadata = { title: "Anmeldung bestätigen – Hub Dome" };

async function ConfirmContent({ searchParams }: Pick<PageProps<"/bestaetigen">, "searchParams">) {
  const { token_hash, type, next } = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

  return (
    <AuthCard title="Anmelden">
      <p className="text-[14px]">Tippe auf den Knopf, um die Anmeldung abzuschliessen.</p>
      <form action={confirmLogin} className="grid gap-3">
        <input type="hidden" name="token_hash" value={str(token_hash)} />
        <input type="hidden" name="type" value={str(type)} />
        <input type="hidden" name="next" value={str(next)} />
        <button type="submit" className="hd-btn hd-btn-primary">
          Jetzt anmelden
        </button>
      </form>
    </AuthCard>
  );
}

export default function ConfirmPage(props: PageProps<"/bestaetigen">) {
  return (
    <Suspense>
      <ConfirmContent searchParams={props.searchParams} />
    </Suspense>
  );
}

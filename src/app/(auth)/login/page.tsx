import { Suspense } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { safeNextPath } from "@/lib/validation";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden – Hub Dome" };

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, fehler, loeschung } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";

  return (
    <AuthCard title="Anmelden">
      <p className="text-[14px]">
        Du erhältst einen Link per E-Mail. Ein Passwort brauchst du nicht.
      </p>
      {fehler && (
        <p role="alert" className="rounded-xl bg-[#fdeceb] p-3 text-[#7a1f16]">
          Die Anmeldung hat nicht geklappt. Bitte fordere einen neuen Link an.
        </p>
      )}
      {loeschung && (
        <p role="status" className="rounded-xl bg-[#fff3cf] p-3 text-[#6b4e00]">
          Dein Konto wird in einem Tag mit allen Daten gelöscht. Meldest du dich vorher wieder an,
          wird die Löschung abgebrochen.
        </p>
      )}
      <LoginForm next={nextPath || undefined} />
      <p className="hd-note">
        <a href="/datenschutz" className="underline">
          Datenschutz
        </a>
      </p>
    </AuthCard>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense>
      <LoginContent searchParams={props.searchParams} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { safeNextPath } from "@/lib/validation";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden – Hub Dome" };

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, fehler } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Anmelden</h1>
      <p>Du erhältst einen Link per E-Mail. Ein Passwort brauchst du nicht.</p>
      {fehler && (
        <p role="alert" className="rounded-lg bg-red-100 p-3 text-red-900">
          Die Anmeldung hat nicht geklappt. Bitte fordere einen neuen Link an.
        </p>
      )}
      <LoginForm next={nextPath || undefined} />
    </main>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense>
      <LoginContent searchParams={props.searchParams} />
    </Suspense>
  );
}

import Link from "next/link";
import { signOut } from "@/app/doerfer/actions";

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
      <nav className="flex items-center gap-4 font-medium">
        <Link href="/doerfer" className="text-lg font-bold">
          Hub Dome
        </Link>
        <Link href="/doerfer" className="hover:underline">
          Meine Dörfer
        </Link>
        <Link href="/einstellungen" className="hover:underline">
          Einstellungen
        </Link>
      </nav>
      <form action={signOut} className="flex items-center gap-3 text-sm">
        <span className="text-zinc-500">{displayName}</span>
        <button type="submit" className="underline">
          Abmelden
        </button>
      </form>
    </header>
  );
}

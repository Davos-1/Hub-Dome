import type { ReactNode } from "react";

/** Karte im Stil der Welt (Holzschild-Kopf, Pergament) auf Himmelsverlauf: für Anmeldung und Einrichtung. */
export function AuthCard({
  title,
  kicker = "Hub Dome",
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <main className="hubdome-ui hd-sky flex min-h-screen items-center justify-center p-4">
      <div className="hd-frame hd-pop-in flex w-full max-w-md flex-col overflow-hidden rounded-[20px] bg-[var(--hd-paper)] text-[var(--hd-ink)] shadow-[0_24px_80px_rgba(28,27,25,.3)]">
        <div className="hd-plank px-6 py-4">
          <div className="hd-kicker">{kicker}</div>
          <h1 className="text-[24px] leading-tight font-bold">{title}</h1>
        </div>
        <div className="flex flex-col gap-4 px-6 py-6">{children}</div>
      </div>
    </main>
  );
}

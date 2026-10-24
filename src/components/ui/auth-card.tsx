import type { ReactNode } from "react";

/**
 * Silhouette der Welt am unteren Bildrand (Berge, Hügel, Häuser, Zentrale mit Turm): für Anmeldung,
 * Einrichtung und Ladebilder. Farben über Tokens (`currentColor`), keine Bilder.
 */
export function WorldSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMax slice"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] w-full ${className}`}
    >
      {/* ferne Berge */}
      <path
        d="M0 170 120 92l70 46 110-88 90 70 80-40 120 96 90-62 130 80 100-70 120 74 170-60v162H0z"
        className="fill-hd-accent opacity-25"
      />
      {/* Hügel mit Dorf */}
      <path
        d="M0 214c120-28 220-30 330-12s210 6 300-16 200-18 300 2 170 8 270-12v86H0z"
        className="fill-hd-box-top"
      />
      <g className="fill-hd-box-top">
        {/* Häuser */}
        <path d="M410 196v-22l16-14 16 14v22zM452 198v-18l13-11 13 11v18zM700 194v-24l18-15 18 15v24zM746 196v-18l13-11 13 11v18zM330 202v-16l11-10 11 10v16z" />
        {/* Zentrale mit Turm */}
        <path d="M560 192v-36l34-22 34 22v36zM586 134v-38l8-14 8 14v38z" />
        {/* Bäume */}
        <circle cx="390" cy="194" r="11" />
        <circle cx="660" cy="188" r="13" />
        <circle cx="800" cy="194" r="10" />
        <circle cx="520" cy="196" r="9" />
      </g>
    </svg>
  );
}

/** Box im Stil «Verlauf» auf Himmel mit Welt-Silhouette: für Anmeldung, Bestätigung und Einrichtung. */
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
    <main className="hd-app hd-sky relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <WorldSilhouette />
      <div className="hd-box hd-pop-in relative flex w-full max-w-md flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <div className="hd-kicker">{kicker}</div>
          <h1 className="text-[24px] leading-tight font-bold">{title}</h1>
        </div>
        <div className="flex flex-col gap-4 px-6 pt-3 pb-6">{children}</div>
      </div>
    </main>
  );
}

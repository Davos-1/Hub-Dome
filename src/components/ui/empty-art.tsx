/**
 * Kleine Illustrationen für Leerzustände (Baustelle, Freunde, Suche): Linien in der Schriftfarbe, ein Akzent
 * in Bernstein, prozedural als SVG. Der Kranhaken pendelt leicht (bei reduzierter Bewegung still).
 */
export function EmptyArt({
  kind,
  className = "",
}: {
  kind: "baustelle" | "freunde" | "suche";
  className?: string;
}) {
  const common = {
    width: 56,
    height: 44,
    viewBox: "0 0 56 44",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: `flex-none text-hd-muted ${className}`,
  };
  if (kind === "baustelle")
    return (
      <svg {...common}>
        {/* Boden, Kran mit Ausleger, pendelnder Haken mit Kiste, Leitkegel */}
        <path d="M4 40h48" />
        <path d="M14 40V8M14 8h30M14 14l6-6M10 40l4-6 4 6" />
        <g className="hd-swing" style={{ transformOrigin: "38px 8px" }}>
          <path d="M38 8v14" />
          <rect
            x="33"
            y="22"
            width="10"
            height="7"
            rx="1.5"
            fill="var(--hd-accent)"
            stroke="none"
          />
        </g>
        <path d="M44 40l3-9 3 9z" fill="var(--hd-accent)" stroke="none" />
        <path d="M45.2 36.5h3.6" stroke="var(--hd-surface)" />
      </svg>
    );
  if (kind === "freunde")
    return (
      <svg {...common}>
        {/* Zwei Häuschen, ein gestrichelter Weg dazwischen, ein Herz */}
        <path d="M4 40h48" />
        <path d="M7 40V27l7-6 7 6v13M35 40V27l7-6 7 6v13" />
        <path d="M21 36c4 0 6-3 7-3s3 3 7 3" strokeDasharray="2 2.5" />
        <path
          d="M28 15c-1.6-2.6-5-1.6-5 1 0 2.4 5 5.5 5 5.5s5-3.1 5-5.5c0-2.6-3.4-3.6-5-1z"
          fill="var(--hd-accent)"
          stroke="none"
        />
      </svg>
    );
  return (
    <svg {...common}>
      {/* Lupe mit kleinem Funken */}
      <circle cx="24" cy="20" r="10" />
      <path d="M31.5 27.5L40 36" strokeWidth={3} />
      <path
        d="M44 8l1.2 3 3 1.2-3 1.2L44 16.4l-1.2-3-3-1.2 3-1.2z"
        fill="var(--hd-accent)"
        stroke="none"
      />
    </svg>
  );
}

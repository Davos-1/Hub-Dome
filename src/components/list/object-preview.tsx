import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "@/lib/highlight";
import type { Artifact } from "@/lib/types";

const nf = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

/**
 * README als Markdown. Rohes HTML wird nicht gerendert (react-markdown maskiert es),
 * Bilder werden nicht von fremden Servern geladen, Links öffnen in neuem Tab.
 */
function Readme({ source }: { source: string }) {
  return (
    <div className="readme text-sm">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          img: ({ alt }) => <em>[Bild: {alt || "ohne Beschreibung"}]</em>,
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}

export function ObjectPreview({ artifact }: { artifact: Artifact }) {
  const { item_type: type, meta } = artifact;
  if (type !== "github_repo" && type !== "gist") return null;

  if ("unavailable" in meta) {
    return <p className="mt-2 text-xs text-hd-muted">Vorschau nicht verfügbar.</p>;
  }
  if (!("kind" in meta)) {
    return <p className="mt-2 text-xs text-hd-muted">Vorschau wird geladen…</p>;
  }

  if (meta.kind === "github") {
    return (
      <div className="mt-2 text-sm">
        <p className="text-xs text-hd-muted">
          {meta.full_name}
          {meta.language && ` · ${meta.language}`} · ★ {meta.stars}
          {meta.pushed_at && ` · letzter Push ${nf.format(new Date(meta.pushed_at))}`}
        </p>
        {meta.description && <p className="mt-1">{meta.description}</p>}
        {meta.readme && (
          <details className="mt-1">
            <summary className="cursor-pointer text-sm underline">README anzeigen</summary>
            <Readme source={meta.readme} />
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 text-sm">
      {meta.description && <p>{meta.description}</p>}
      {meta.files.map((f) => (
        <details key={f.filename} className="mt-1">
          <summary className="cursor-pointer text-sm underline">{f.filename}</summary>
          <pre className="hljs overflow-x-auto rounded-lg p-3 text-xs">
            <code dangerouslySetInnerHTML={{ __html: highlightCode(f.content, f.filename) }} />
            {f.truncated && "\n…"}
          </pre>
        </details>
      ))}
    </div>
  );
}

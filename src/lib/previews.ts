import { needsRefresh, parseGistId, parseGithubRepo, type ItemType } from "./item-types";

/** Gespeicherte Vorschau-Daten (Spalte `artifacts.meta`). */
type GithubMeta = {
  kind: "github";
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushed_at: string | null;
  readme: string | null;
};
type GistMeta = {
  kind: "gist";
  description: string | null;
  files: { filename: string; language: string | null; content: string; truncated: boolean }[];
};
type UnavailableMeta = { unavailable: true };
export type PreviewMeta = GithubMeta | GistMeta | UnavailableMeta | Record<string, never>;

type FetchFn = typeof fetch;
type Fetched = PreviewMeta | "rate_limited";

const README_MAX = 20_000;
const GIST_MAX_FILES = 5;
const GIST_MAX_LINES = 20;

function headers(accept = "application/vnd.github+json"): HeadersInit {
  const h: Record<string, string> = { Accept: accept, "User-Agent": "hub-dome" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

const isRateLimited = (res: Response) =>
  res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");

async function fetchGithub(owner: string, repo: string, fetchFn: FetchFn): Promise<Fetched> {
  const res = await fetchFn(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: headers(),
  });
  if (isRateLimited(res)) return "rate_limited";
  if (!res.ok) return { unavailable: true };
  const r = await res.json();

  let readme: string | null = null;
  const rr = await fetchFn(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: headers("application/vnd.github.raw+json"),
  });
  if (rr.ok) readme = (await rr.text()).slice(0, README_MAX);

  return {
    kind: "github",
    full_name: r.full_name,
    description: r.description ?? null,
    language: r.language ?? null,
    stars: r.stargazers_count ?? 0,
    pushed_at: r.pushed_at ?? null,
    readme,
  };
}

async function fetchGist(id: string, fetchFn: FetchFn): Promise<Fetched> {
  const res = await fetchFn(`https://api.github.com/gists/${id}`, { headers: headers() });
  if (isRateLimited(res)) return "rate_limited";
  if (!res.ok) return { unavailable: true };
  const g = await res.json();

  const files = Object.values(g.files ?? {})
    .slice(0, GIST_MAX_FILES)
    .map((f) => {
      const file = f as { filename: string; language?: string; content?: string };
      const lines = (file.content ?? "").split("\n");
      return {
        filename: file.filename,
        language: file.language ?? null,
        content: lines.slice(0, GIST_MAX_LINES).join("\n"),
        truncated: lines.length > GIST_MAX_LINES,
      };
    });
  return { kind: "gist", description: g.description ?? null, files };
}

type Row = {
  item_type: ItemType;
  url: string;
  meta: PreviewMeta;
  meta_refreshed_at: string | null;
};

/**
 * Entscheidet, ob die Vorschau neu geladen wird, und liefert ggf. das DB-Update.
 * `null` = nichts tun (nicht veraltet, kein Vorschau-Typ oder GitHub-Limit erreicht).
 */
export async function maybeRefresh(
  row: Row,
  fetchFn: FetchFn = fetch,
  now = Date.now(),
): Promise<{ meta: PreviewMeta; meta_refreshed_at: string } | null> {
  if (row.item_type !== "github_repo" && row.item_type !== "gist") return null;
  if (!needsRefresh(row.meta_refreshed_at, now)) return null;

  let result: Fetched;
  try {
    if (row.item_type === "github_repo") {
      const repo = parseGithubRepo(row.url);
      result = repo ? await fetchGithub(repo.owner, repo.repo, fetchFn) : { unavailable: true };
    } else {
      const id = parseGistId(row.url);
      result = id ? await fetchGist(id, fetchFn) : { unavailable: true };
    }
  } catch {
    return null; // Netzwerkfehler: beim nächsten Aufruf erneut versuchen
  }
  if (result === "rate_limited") return null;

  // Bei «nicht verfügbar» bleibt eine frühere erfolgreiche Vorschau erhalten.
  const hadPreview = "kind" in row.meta;
  const meta = "unavailable" in result && hadPreview ? row.meta : result;
  return { meta, meta_refreshed_at: new Date(now).toISOString() };
}

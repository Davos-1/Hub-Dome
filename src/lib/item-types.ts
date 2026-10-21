/** Objekttypen (Form eines Eintrags). `kind` bleibt die Inhaltskategorie. */
export const ITEM_TYPES = [
  "claude_artifact",
  "github_repo",
  "gist",
  "cloud_ordner",
  "link",
  "datei",
  "paket",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Typen, die der User per Link anlegen kann (datei/paket folgen in Phase 8/9). */
export const LINK_ITEM_TYPES = [
  "claude_artifact",
  "github_repo",
  "gist",
  "cloud_ordner",
  "link",
] as const satisfies readonly ItemType[];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  claude_artifact: "Claude-Artifact",
  github_repo: "GitHub-Repo",
  gist: "Gist",
  cloud_ordner: "Cloud-Ordner",
  link: "Link",
  datei: "Datei",
  paket: "Paket",
};

export const ITEM_TYPE_ICONS: Record<ItemType, string> = {
  claude_artifact: "💎",
  github_repo: "⚙️",
  gist: "📜",
  cloud_ordner: "🧰",
  link: "🪧",
  datei: "📄",
  paket: "📦",
};

const CLOUD_HOSTS = [
  "onedrive.live.com",
  "1drv.ms",
  "sharepoint.com",
  "drive.google.com",
  "docs.google.com",
  "switchdrive.ch",
  "drive.switch.ch",
  "dropbox.com",
];

const hostMatches = (host: string, domain: string) =>
  host === domain || host.endsWith("." + domain);

/** Erkennt den Objekttyp aus der URL. */
export function detectItemType(rawUrl: string): ItemType {
  const url = URL.parse(rawUrl);
  if (!url || url.protocol !== "https:") return "link";
  const host = url.hostname.toLowerCase();
  if (host === "claude.ai") return "claude_artifact";
  if (host === "gist.github.com") return "gist";
  if (host === "github.com") return parseGithubRepo(rawUrl) ? "github_repo" : "link";
  if (CLOUD_HOSTS.some((d) => hostMatches(host, d))) return "cloud_ordner";
  return "link";
}

/** `owner/repo` aus einer GitHub-Repo-URL (exakt zwei Pfadsegmente), sonst null. */
export function parseGithubRepo(rawUrl: string): { owner: string; repo: string } | null {
  const url = URL.parse(rawUrl);
  if (url?.protocol !== "https:" || url.hostname !== "github.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || url.pathname.replace(/\/$/, "").split("/").length !== 3) return null;
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
}

/** Gist-ID (letztes Pfadsegment), sonst null. */
export function parseGistId(rawUrl: string): string | null {
  const url = URL.parse(rawUrl);
  if (url?.protocol !== "https:" || url.hostname !== "gist.github.com") return null;
  const id = url.pathname.split("/").filter(Boolean).at(-1);
  return id && /^[0-9a-f]+$/i.test(id) ? id : null;
}

/** Spiegelt die DB-Prüfung `artifacts_url_by_type`. */
export function urlMatchesType(type: ItemType, rawUrl: string): boolean {
  if (!/^https:\/\//.test(rawUrl)) return false;
  switch (type) {
    case "claude_artifact":
      return /^https:\/\/claude\.ai\//.test(rawUrl);
    case "github_repo":
      return /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(rawUrl);
    case "gist":
      return /^https:\/\/gist\.github\.com\//.test(rawUrl);
    default:
      return true;
  }
}

export const hostOf = (rawUrl: string) => URL.parse(rawUrl)?.hostname.replace(/^www\./, "") ?? "";

export const META_TTL_MS = 24 * 60 * 60 * 1000;

/** Vorschau-Daten höchstens alle 24 h neu laden. */
export function needsRefresh(refreshedAt: string | null, now = Date.now()): boolean {
  return !refreshedAt || now - new Date(refreshedAt).getTime() >= META_TTL_MS;
}

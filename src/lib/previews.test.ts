import { describe, expect, it, vi } from "vitest";
import { maybeRefresh } from "./previews";

const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);
const NOW = Date.parse("2026-10-21T12:00:00Z");

function githubFetch() {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/readme")) return new Response("# Titel\nText");
    return json({
      full_name: "a/b",
      description: "Beschreibung",
      language: "Python",
      stargazers_count: 7,
      pushed_at: "2026-10-01T00:00:00Z",
    });
  });
}

const repoRow = {
  item_type: "github_repo" as const,
  url: "https://github.com/a/b",
  meta: {},
  meta_refreshed_at: null,
};

describe("maybeRefresh", () => {
  it("lädt GitHub-Repo mit README", async () => {
    const f = githubFetch();
    const r = await maybeRefresh(repoRow, f as unknown as typeof fetch, NOW);
    expect(r?.meta).toMatchObject({
      kind: "github",
      stars: 7,
      language: "Python",
      readme: "# Titel\nText",
    });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("macht innerhalb von 24 h keinen neuen API-Call", async () => {
    const f = githubFetch();
    const fresh = { ...repoRow, meta_refreshed_at: "2026-10-21T00:00:00Z" };
    expect(await maybeRefresh(fresh, f as unknown as typeof fetch, NOW)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("markiert private/nicht gefundene Repos als nicht verfügbar", async () => {
    const f = vi.fn(async () => new Response("", { status: 404 }));
    const r = await maybeRefresh(repoRow, f as unknown as typeof fetch, NOW);
    expect(r?.meta).toEqual({ unavailable: true });
  });

  it("behält eine frühere Vorschau, wenn das Repo später nicht erreichbar ist", async () => {
    const f = vi.fn(async () => new Response("", { status: 404 }));
    const old = {
      ...repoRow,
      meta: {
        kind: "github" as const,
        full_name: "a/b",
        description: null,
        language: null,
        stars: 1,
        pushed_at: null,
        readme: null,
      },
      meta_refreshed_at: "2026-10-01T00:00:00Z",
    };
    const r = await maybeRefresh(old, f as unknown as typeof fetch, NOW);
    expect(r?.meta).toMatchObject({ kind: "github" });
  });

  it("wartet bei Rate-Limit mit dem Speichern", async () => {
    const f = vi.fn(
      async () => new Response("", { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
    );
    expect(await maybeRefresh(repoRow, f as unknown as typeof fetch, NOW)).toBeNull();
  });

  it("lädt Gist mit gekürztem Inhalt", async () => {
    const content = Array.from({ length: 30 }, (_, i) => `zeile ${i}`).join("\n");
    const f = vi.fn(async () =>
      json({
        description: "g",
        files: { "a.py": { filename: "a.py", language: "Python", content } },
      }),
    );
    const r = await maybeRefresh(
      {
        item_type: "gist",
        url: "https://gist.github.com/u/abc123",
        meta: {},
        meta_refreshed_at: null,
      },
      f as unknown as typeof fetch,
      NOW,
    );
    const meta = r?.meta as { files: { content: string; truncated: boolean }[] };
    expect(meta.files[0].content.split("\n")).toHaveLength(20);
    expect(meta.files[0].truncated).toBe(true);
  });

  it("ignoriert andere Typen", async () => {
    const f = githubFetch();
    const row = {
      item_type: "link" as const,
      url: "https://example.com",
      meta: {},
      meta_refreshed_at: null,
    };
    expect(await maybeRefresh(row, f as unknown as typeof fetch, NOW)).toBeNull();
  });
});

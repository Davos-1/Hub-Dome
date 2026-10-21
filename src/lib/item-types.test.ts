import { describe, expect, it } from "vitest";
import {
  detectItemType,
  needsRefresh,
  parseGistId,
  parseGithubRepo,
  urlMatchesType,
} from "./item-types";

describe("detectItemType", () => {
  it.each([
    ["https://claude.ai/public/artifacts/x", "claude_artifact"],
    ["https://github.com/Davos-1/Hub-Dome", "github_repo"],
    ["https://github.com/Davos-1/Hub-Dome/", "github_repo"],
    ["https://github.com/Davos-1/Hub-Dome/issues", "link"],
    ["https://github.com/Davos-1", "link"],
    ["https://gist.github.com/user/abc123", "gist"],
    ["https://hslu.sharepoint.com/sites/x", "cloud_ordner"],
    ["https://drive.google.com/drive/folders/1", "cloud_ordner"],
    ["https://www.dropbox.com/sh/x", "cloud_ordner"],
    ["https://drive.switch.ch/x", "cloud_ordner"],
    ["https://example.com", "link"],
    ["http://claude.ai/x", "link"],
    ["https://claude.ai.evil.com/x", "link"],
    ["kein-link", "link"],
  ])("%s → %s", (url, type) => expect(detectItemType(url)).toBe(type));
});

describe("urlMatchesType", () => {
  it("lehnt ungültige Kombinationen ab", () => {
    expect(urlMatchesType("github_repo", "https://claude.ai/x")).toBe(false);
    expect(urlMatchesType("claude_artifact", "https://github.com/a/b")).toBe(false);
    expect(urlMatchesType("gist", "https://github.com/a/b")).toBe(false);
    expect(urlMatchesType("link", "http://example.com")).toBe(false);
  });
  it("akzeptiert passende", () => {
    expect(urlMatchesType("github_repo", "https://github.com/a/b")).toBe(true);
    expect(urlMatchesType("gist", "https://gist.github.com/u/1")).toBe(true);
    expect(urlMatchesType("link", "https://example.com")).toBe(true);
  });
});

describe("parser", () => {
  it("GitHub-Repo", () => {
    expect(parseGithubRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseGithubRepo("https://github.com/a/b/tree/main")).toBeNull();
  });
  it("Gist-ID", () => {
    expect(parseGistId("https://gist.github.com/user/aa11bb22")).toBe("aa11bb22");
    expect(parseGistId("https://gist.github.com/user")).toBeNull();
  });
});

describe("needsRefresh", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  it("lädt nie Geladenes", () => expect(needsRefresh(null, now)).toBe(true));
  it("lädt innerhalb 24 h nicht neu", () =>
    expect(needsRefresh("2026-10-20T13:00:00Z", now)).toBe(false));
  it("lädt nach 24 h neu", () => expect(needsRefresh("2026-10-20T11:59:00Z", now)).toBe(true));
});

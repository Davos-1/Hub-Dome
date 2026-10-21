import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import markdown from "highlight.js/lib/languages/markdown";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import csharp from "highlight.js/lib/languages/csharp";

hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("csharp", csharp);

const BY_EXTENSION: Record<string, string> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  ts: "typescript",
  json: "json",
  sh: "bash",
  md: "markdown",
  html: "xml",
  xml: "xml",
  css: "css",
  sql: "sql",
  cs: "csharp",
};

/**
 * Liefert HTML mit Syntax-Hervorhebung. highlight.js maskiert den Quelltext (&, <, >),
 * das Ergebnis ist daher als innerHTML unbedenklich. Unbekannte Sprachen: maskierter Klartext.
 */
export function highlightCode(code: string, filename: string): string {
  const language = BY_EXTENSION[filename.split(".").at(-1)?.toLowerCase() ?? ""];
  if (language) return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

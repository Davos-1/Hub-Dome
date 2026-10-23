import type { ReactNode } from "react";
import { CopyField } from "./copy-field";

/** Einmalig angezeigter Link (Freundschaftslink, Connector-URL) mit Hinweis. */
export function InviteResult({ url, children }: { url: string | undefined; children: ReactNode }) {
  if (!url) return null;
  return (
    <div className="flex flex-col gap-1">
      <CopyField value={url} />
      <p className="hd-note">{children}</p>
    </div>
  );
}

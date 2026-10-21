"use client";

import { useState } from "react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value}
        aria-label="Link"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black"
      />
      <button
        type="button"
        className="rounded-lg border border-zinc-300 px-3 py-1 text-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        }}
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

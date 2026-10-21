"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteModel, registerModel } from "@/app/einstellungen/model-actions";
import { inspectGlb } from "@/lib/glb";
import { MODEL_LIMITS } from "@/lib/styles";
import { createClient } from "@/lib/supabase/client";
import type { Village } from "@/lib/types";

const PROMPT = `Erstelle mir ein 3D-Modell als einzelne Datei im Format GLB (glTF 2.0 binär).
Thema: <beschreibe dein Gebäude oder Objekt, z.B. «kleine Sternwarte mit Kuppel»>

Vorgaben:
- Schreibe ein Skript (z.B. Python mit trimesh/pygltflib oder JavaScript mit three.js GLTFExporter) und führe es aus, sodass du die Datei «zentrale.glb» liefern kannst.
- Stil: stilisiert (Low-Poly bis Mid-Poly), freundliche Farben, einfache Materialien (Farben oder PBR-Grundfarbe, keine Spezialeffekte).
- Y ist oben, Einheit Meter, Grösse etwa 6–10 m breit, der Boden liegt auf y = 0, der Mittelpunkt des Grundrisses im Ursprung, die Vorderseite (Eingang) zeigt nach +Z.
- Höchstens 60 000 Dreiecke, höchstens 4 Texturen (am besten gar keine, nur Farben), Datei kleiner als 5 MB.
- Alles in einer Datei: keine externen Bilder oder .bin-Dateien, keine Draco- oder Meshopt-Komprimierung.`;

type Props = { villageId: string; meta: Village["zentrale_model_meta"] };

export function ModelUpload({ villageId, meta }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function upload(file: File) {
    setMessage(null);
    start(async () => {
      // Schnelle Vorprüfung im Browser; verbindlich ist die Prüfung auf dem Server.
      const check = inspectGlb(await file.arrayBuffer());
      if (!check.ok) return setMessage({ kind: "error", text: check.error });

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("village-models")
        .upload(`${villageId}/zentrale.glb`, file, {
          upsert: true,
          contentType: "model/gltf-binary",
        });
      if (error) {
        return setMessage({
          kind: "error",
          text: "Der Upload ist fehlgeschlagen. Bitte erneut versuchen.",
        });
      }

      const res = await registerModel();
      if (res.error) return setMessage({ kind: "error", text: res.error });
      setMessage({
        kind: "ok",
        text: "Modell hochgeladen und geprüft. Wähle oben «Eigenes Modell» und speichere die Stile.",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600">
        Ersetze die Zentrale durch ein eigenes, mit Claude erstelltes 3D-Objekt. Format:{" "}
        <strong>.glb</strong> (glTF binär), höchstens {MODEL_LIMITS.maxBytes / 1024 / 1024} MB und{" "}
        {MODEL_LIMITS.maxTriangles.toLocaleString("de-CH")} Dreiecke. Die Datei wird nur geprüft und
        angezeigt, nie ausgeführt, und ist nur für dich und deine Freigegebenen sichtbar.
      </p>

      {meta && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
          Aktuelles Modell: {(meta.bytes / 1024).toFixed(0)} KB,{" "}
          {meta.triangles.toLocaleString("de-CH")} Dreiecke, hochgeladen am{" "}
          {new Date(meta.uploaded_at).toLocaleDateString("de-CH")}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".glb,model/gltf-binary"
          className="hidden"
          aria-label="GLB-Datei auswählen"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Prüfe und lade hoch…" : meta ? "Modell ersetzen" : "GLB-Datei hochladen"}
        </button>
        {meta && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Eigenes Modell löschen?") &&
              start(async () => {
                const res = await deleteModel();
                setMessage(
                  res.error
                    ? { kind: "error", text: res.error }
                    : { kind: "ok", text: "Modell gelöscht." },
                );
                router.refresh();
              })
            }
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60"
          >
            Modell löschen
          </button>
        )}
      </div>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`text-sm ${message.kind === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {message.text}
        </p>
      )}

      <details className="rounded-lg border border-zinc-300 p-3">
        <summary className="cursor-pointer font-medium">
          So erstellst du ein Modell mit Claude
        </summary>
        <p className="mt-2 text-sm text-zinc-600">
          Kopiere diese Vorlage in einen Chat mit Claude, ergänze das Thema und lade die gelieferte
          Datei hier hoch.
        </p>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs whitespace-pre-wrap text-zinc-900">
          {PROMPT}
        </pre>
        <button
          type="button"
          className="mt-2 rounded-lg border border-zinc-300 px-3 py-1 text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(PROMPT);
            setCopied(true);
          }}
        >
          {copied ? "Kopiert" : "Vorlage kopieren"}
        </button>
      </details>
    </div>
  );
}

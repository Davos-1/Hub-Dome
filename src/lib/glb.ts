import { MODEL_LIMITS } from "./styles";

/**
 * Prüft eine glTF-Binärdatei (.glb), ohne sie auszuführen oder zu rendern: Aufbau, Grössenlimits,
 * keine externen Verweise, nur erlaubte Erweiterungen. Läuft identisch im Browser (schnelles Feedback)
 * und auf dem Server (verbindliche Prüfung).
 */
export type GlbInfo = { bytes: number; triangles: number; textures: number };
export type GlbResult = ({ ok: true } & GlbInfo) | { ok: false; error: string };

/** Nur reine Daten-Erweiterungen; Komprimierungen (Draco, Meshopt) brauchen Decoder und sind nicht erlaubt. */
const ALLOWED_EXTENSIONS = new Set([
  "KHR_materials_unlit",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  "KHR_materials_specular",
  "KHR_materials_clearcoat",
  "KHR_materials_transmission",
  "KHR_materials_volume",
  "KHR_texture_transform",
  "KHR_mesh_quantization",
  "KHR_lights_punctual",
]);

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a;

type Accessor = { count?: number };
type Primitive = { attributes?: { POSITION?: number }; indices?: number; mode?: number };
type Gltf = {
  asset?: { version?: string };
  buffers?: { uri?: string }[];
  images?: { uri?: string }[];
  textures?: unknown[];
  meshes?: { primitives?: Primitive[] }[];
  accessors?: Accessor[];
  extensionsRequired?: string[];
};

const fail = (error: string): GlbResult => ({ ok: false, error });

export function inspectGlb(input: ArrayBuffer | Uint8Array): GlbResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MODEL_LIMITS.maxBytes) {
    return fail(`Die Datei ist zu gross (max. ${MODEL_LIMITS.maxBytes / 1024 / 1024} MB).`);
  }
  if (bytes.byteLength < 28) return fail("Das ist keine gültige GLB-Datei.");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return fail("Das ist keine GLB-Datei (falsche Kennung).");
  if (view.getUint32(4, true) !== 2) return fail("Nur glTF-Version 2 wird unterstützt.");
  if (view.getUint32(8, true) !== bytes.byteLength)
    return fail("Die Dateigrösse stimmt nicht mit dem Kopf überein.");

  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + jsonLength > bytes.byteLength) {
    return fail("Die GLB-Datei ist beschädigt.");
  }

  let gltf: Gltf;
  try {
    gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  } catch {
    return fail("Die GLB-Datei enthält ungültige Beschreibungsdaten.");
  }
  if (gltf.asset?.version !== "2.0") return fail("Nur glTF 2.0 wird unterstützt.");

  // Keine externen Dateien: alles muss in der GLB stecken (oder als data:-URI)
  const external = (u?: string) => u !== undefined && !u.startsWith("data:");
  if (gltf.buffers?.some((b) => external(b.uri)) || gltf.images?.some((i) => external(i.uri))) {
    return fail(
      "Die Datei verweist auf externe Dateien. Exportiere als einzelne .glb mit eingebetteten Texturen.",
    );
  }

  const unsupported = (gltf.extensionsRequired ?? []).filter((e) => !ALLOWED_EXTENSIONS.has(e));
  if (unsupported.length) {
    return fail(
      `Nicht unterstützte Erweiterung: ${unsupported.join(", ")}. Exportiere ohne Draco-/Meshopt-Komprimierung.`,
    );
  }

  const textures = gltf.textures?.length ?? 0;
  if (textures > MODEL_LIMITS.maxTextures) {
    return fail(`Zu viele Texturen (${textures}, max. ${MODEL_LIMITS.maxTextures}).`);
  }

  const meshes = gltf.meshes ?? [];
  if (meshes.length === 0) return fail("Die Datei enthält kein 3D-Objekt.");

  // Dreiecke zählen (nur Modus 4 = Dreiecke; Standard)
  let triangles = 0;
  for (const mesh of meshes) {
    for (const p of mesh.primitives ?? []) {
      const mode = p.mode ?? 4;
      if (mode !== 4) continue;
      const acc =
        p.indices !== undefined
          ? gltf.accessors?.[p.indices]
          : gltf.accessors?.[p.attributes?.POSITION ?? -1];
      triangles += Math.floor((acc?.count ?? 0) / 3);
    }
  }
  if (triangles > MODEL_LIMITS.maxTriangles) {
    return fail(
      `Zu viele Dreiecke (${triangles.toLocaleString("de-CH")}, max. ${MODEL_LIMITS.maxTriangles.toLocaleString("de-CH")}).`,
    );
  }
  if (triangles === 0) return fail("Die Datei enthält keine Dreiecke.");

  return { ok: true, bytes: bytes.byteLength, triangles, textures };
}

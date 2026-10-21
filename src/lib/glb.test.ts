import { describe, expect, it } from "vitest";
import { inspectGlb } from "./glb";

/** Baut eine minimale GLB mit dem gegebenen glTF-JSON (ohne Binärchunk). */
function makeGlb(json: unknown, extraBytes = 0): Uint8Array {
  const text = JSON.stringify(json);
  const enc = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.ceil(enc.length / 4) * 4).fill(0x20);
  padded.set(enc);
  const total = 12 + 8 + padded.length + extraBytes;
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, padded.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(padded, 20);
  return out;
}

const good = {
  asset: { version: "2.0" },
  accessors: [{ count: 36 }, { count: 24 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 1 }, indices: 0 }] }],
  textures: [{}],
};

describe("inspectGlb", () => {
  it("akzeptiert eine gültige GLB und zählt Dreiecke", () => {
    const r = inspectGlb(makeGlb(good));
    expect(r).toMatchObject({ ok: true, triangles: 12, textures: 1 });
  });

  it("zählt ohne Indizes die Eckpunkte", () => {
    const r = inspectGlb(
      makeGlb({ ...good, meshes: [{ primitives: [{ attributes: { POSITION: 1 } }] }] }),
    );
    expect(r).toMatchObject({ ok: true, triangles: 8 });
  });

  it("lehnt falsche Kennung, Version und Länge ab", () => {
    const bytes = makeGlb(good);
    const wrongMagic = bytes.slice();
    wrongMagic[0] = 0;
    expect(inspectGlb(wrongMagic)).toMatchObject({ ok: false });
    const wrongVersion = bytes.slice();
    new DataView(wrongVersion.buffer).setUint32(4, 1, true);
    expect(inspectGlb(wrongVersion)).toMatchObject({ ok: false });
    expect(inspectGlb(bytes.slice(0, bytes.length - 4))).toMatchObject({ ok: false });
    expect(
      inspectGlb(new TextEncoder().encode("# kein glb, nur Text hier, mehr als 28 Bytes")),
    ).toMatchObject({ ok: false });
  });

  it("lehnt externe Dateien ab (SSRF/Tracking), erlaubt data:-URIs", () => {
    const ext = inspectGlb(makeGlb({ ...good, images: [{ uri: "https://evil.example/x.png" }] }));
    expect(ext).toMatchObject({ ok: false });
    const extBuf = inspectGlb(makeGlb({ ...good, buffers: [{ uri: "model.bin" }] }));
    expect(extBuf).toMatchObject({ ok: false });
    const data = inspectGlb(makeGlb({ ...good, images: [{ uri: "data:image/png;base64,AAAA" }] }));
    expect(data).toMatchObject({ ok: true });
  });

  it("lehnt Draco/Meshopt und unbekannte Pflicht-Erweiterungen ab", () => {
    const r = inspectGlb(makeGlb({ ...good, extensionsRequired: ["KHR_draco_mesh_compression"] }));
    expect(r).toMatchObject({ ok: false });
    expect(
      inspectGlb(makeGlb({ ...good, extensionsRequired: ["KHR_materials_unlit"] })),
    ).toMatchObject({ ok: true });
  });

  it("hält Limits für Texturen, Dreiecke und Grösse ein", () => {
    expect(inspectGlb(makeGlb({ ...good, textures: [{}, {}, {}, {}, {}] }))).toMatchObject({
      ok: false,
    });
    const heavy = { ...good, accessors: [{ count: 61_000 * 3 }, { count: 10 }] };
    expect(inspectGlb(makeGlb(heavy))).toMatchObject({ ok: false });
    expect(inspectGlb(makeGlb(good, 5 * 1024 * 1024))).toMatchObject({ ok: false });
  });

  it("lehnt Dateien ohne Mesh oder ohne Dreiecke ab", () => {
    expect(inspectGlb(makeGlb({ asset: { version: "2.0" } }))).toMatchObject({ ok: false });
    expect(inspectGlb(makeGlb({ ...good, accessors: [{ count: 0 }, { count: 0 }] }))).toMatchObject(
      { ok: false },
    );
  });
});

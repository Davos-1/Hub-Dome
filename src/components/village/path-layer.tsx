"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { QUARTER_COLORS } from "@/lib/layout";
import type { VillagePath } from "@/lib/paths";
import { seededRandom } from "@/lib/random";
import type { World } from "@/lib/world/generate";
import {
  CURB,
  halfWidth,
  hasCurb,
  pathDress,
  surfaceOf,
  type PathDress,
  type Surface,
} from "@/lib/world/path-dress";
import {
  cobbleTexture,
  earthTexture,
  flagTexture,
  stepTexture,
  TILE_METERS,
} from "./path-textures";
import { gravelTexture } from "./paths-geometry";

/**
 * Wege (P7, alle Generator-Versionen): je Belag ein Band mit Längs-UV und eigener Textur (Kies, Kopfsteinpflaster,
 * Platten, Erde), Randsteine, Trittplatten und Steinchen in einer Geometrie, Randgras als Instanzen. Höchstens
 * sechs Draw Calls. Die Lage kommt aus `pathDress` (reine Regeln, getestet).
 */

type Pt = { x: number; z: number };

/** Grundtöne der Beläge (die Textur ist hell, die Vertexfarbe gibt den Ton). */
const TONES: Record<Surface, { main: string; edge: string }> = {
  kies: { main: "#d6cdb6", edge: "#ada38a" },
  pflaster: { main: "#c3baa8", edge: "#998f7c" },
  platten: { main: "#d4cdbd", edge: "#a69d8a" },
  erde: { main: "#c2a77e", edge: "#97815e" },
};
/** Höhe der Belagfläche je Wegtyp (Stichwege unter der Gasse, damit die Gasse die Einmündung deckt). */
const LEVEL: Record<VillagePath["kind"], number> = {
  pfad: 0.016,
  stich: 0.018,
  gasse: 0.022,
  haupt: 0.024,
};

/** Band eines Wegs (7 Stützpunkte quer): Gras → Kante → Belag → Kante → Gras, Längs-UV in Metern / Kachelgrösse. */
function ribbon(
  path: VillagePath,
  line: Pt[],
  surface: Surface,
  grass: THREE.Color,
  out: { pos: number[]; col: number[]; uv: number[]; tex: number[] },
) {
  const tone = TONES[surface];
  let cMain = new THREE.Color(tone.main);
  let cEdge = new THREE.Color(tone.edge);
  // Gassen tragen einen Hauch der Quartierfarbe (Orientierung), Stichwege sind etwas heller
  if (path.kind === "gasse" && path.quarterIndex !== null) {
    const q = QUARTER_COLORS[path.quarterIndex % QUARTER_COLORS.length];
    cMain = cMain.lerp(new THREE.Color(q.main), 0.3);
    cEdge = cEdge.lerp(new THREE.Color(q.edge), 0.3);
  }
  if (path.kind === "stich") cMain = cMain.lerp(new THREE.Color("#ece5d3"), 0.25);
  const cEdgeSoft = cEdge.clone().lerp(grass, 0.35);
  const curb = hasCurb(surface) && path.kind !== "stich";
  const tile = TILE_METERS[surface];
  const y = LEVEL[path.kind];
  const n = line.length;
  const acc = [0];
  for (let k = 1; k < n; k++)
    acc.push(acc[k - 1] + Math.hypot(line[k].x - line[k - 1].x, line[k].z - line[k - 1].z));
  const total = acc[n - 1];
  const tmp = new THREE.Color();
  type V = { x: number; y: number; z: number; c: THREE.Color; u: number; v: number; t: number };
  const rows: V[][] = [];
  // Anteil der Textur je Spalte: Belag voll, Saum halb (Kies, Erde) bzw. aus (unter dem Randstein), Gras aus
  const texMix = curb ? [0, 0, 1, 1, 1, 0, 0] : [0, 0.45, 1, 1, 1, 0.45, 0];
  for (let k = 0; k < n; k++) {
    const a = line[Math.max(0, k - 1)];
    const b = line[Math.min(n - 1, k + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / l;
    const nz = (b.x - a.x) / l;
    const s = acc[k];
    const w = halfWidth(path, s, total);
    // Kante: bei Pflaster liegt dort der Randstein, sonst ein weicher Saum ins Gras
    const e = curb ? CURB.w : 0.14;
    const fade = Math.min(1, s / 0.6 + 0.0001) * Math.min(1, (total - s) / 0.6 + 0.0001);
    const blend = (path.kind === "stich" ? 0.2 : 0.4) * fade;
    const offs = [-(w + e + blend), -(w + e), -w, 0, w, w + e, w + e + blend];
    const ys = [y - 0.014, y - 0.008, y, y, y, y - 0.008, y - 0.014];
    // Ton leicht variieren (keine sichtbare Wiederholung): langsam längs, etwas quer
    const vary =
      1 + 0.045 * Math.sin(s * 0.83 + path.seed) + 0.025 * Math.sin(s * 2.9 + path.seed * 3.1);
    const cols = [grass, cEdgeSoft, cEdge, cMain, cEdge, cEdgeSoft, grass].map((c, j) =>
      j === 0 || j === 6
        ? c
        : tmp
            .copy(c)
            .multiplyScalar(vary * (1 + 0.02 * Math.sin(j * 1.7 + s)))
            .clone(),
    );
    rows.push(
      offs.map((o, j) => ({
        x: line[k].x + nx * o,
        y: ys[j],
        z: line[k].z + nz * o,
        c: cols[j],
        u: o / tile,
        v: s / tile,
        t: texMix[j],
      })),
    );
  }
  const push = (v: V) => {
    out.pos.push(v.x, v.y, v.z);
    out.col.push(v.c.r, v.c.g, v.c.b);
    out.uv.push(v.u, v.v);
    out.tex.push(v.t);
  };
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < 6; j++) {
      const a = rows[i][j];
      const b = rows[i][j + 1];
      const c = rows[i + 1][j];
      const d = rows[i + 1][j + 1];
      for (const [p, q, r] of [
        [a, b, c],
        [b, d, c],
      ]) {
        // Dreiecke nach oben ausrichten
        const up = (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z) > 0;
        push(p);
        push(up ? q : r);
        push(up ? r : q);
      }
    }
  }
}

function toGeometry(a: {
  pos: number[];
  col: number[];
  uv?: number[];
  nor?: number[];
  tex?: number[];
}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(a.col, 3));
  if (a.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(a.uv, 2));
  if (a.tex) g.setAttribute("aTex", new THREE.Float32BufferAttribute(a.tex, 1));
  if (a.nor) g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
  else g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Prisma aus einem Umriss (lokal x/z), oben `top`, unten `bottom`, in die Listen geschrieben (flach schattiert). */
function prism(
  ring: Pt[],
  top: number,
  bottom: number,
  color: THREE.Color,
  out: { pos: number[]; col: number[] },
  /** Höhe der Mitte der Deckfläche (gewölbt, z.B. Steinchen); Standard flach. */
  peak = top,
) {
  const tri = (a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like, k = 1) => {
    out.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) out.col.push(color.r * k, color.g * k, color.b * k);
  };
  const m = ring.length;
  const cx = ring.reduce((s, p) => s + p.x, 0) / m;
  const cz = ring.reduce((s, p) => s + p.z, 0) / m;
  // Ringrichtung so, dass die Deckfläche nach oben zeigt
  let area = 0;
  for (let i = 0; i < m; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % m];
    area += a.x * b.z - b.x * a.z;
  }
  const rr = area > 0 ? [...ring].reverse() : ring;
  for (let i = 0; i < m; i++) {
    const a = rr[i];
    const b = rr[(i + 1) % m];
    tri({ x: cx, y: peak, z: cz }, { x: a.x, y: top, z: a.z }, { x: b.x, y: top, z: b.z });
    // Seiten etwas dunkler (Tiefe ohne Schatten)
    tri(
      { x: a.x, y: top, z: a.z },
      { x: a.x, y: bottom, z: a.z },
      { x: b.x, y: bottom, z: b.z },
      0.78,
    );
    tri(
      { x: a.x, y: top, z: a.z },
      { x: b.x, y: bottom, z: b.z },
      { x: b.x, y: top, z: b.z },
      0.78,
    );
  }
}

/** Randsteine, Trittplatten und Steinchen als eine Geometrie (Vertexfarben, flach schattiert). */
function stonesGeometry(d: PathDress, seed: string) {
  const out = { pos: [] as number[], col: [] as number[] };
  const r = seededRandom(`steine-${seed}`);
  const curbTones = ["#b9b1a1", "#aea694", "#c2bba9", "#a69e8d"].map((c) => new THREE.Color(c));
  // Randsteine: Stücke von etwa 0.5 m mit schmaler Fuge
  for (const run of d.curbs) {
    const pts = run.pts;
    for (let i = 0; i + 1 < pts.length; i += 3) {
      const j = Math.min(pts.length - 1, i + 3);
      const a = pts[i];
      const b = pts[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const tx = dx / l;
      const tz = dz / l;
      const nx = -tz * (CURB.w / 2);
      const nz = tx * (CURB.w / 2);
      const g = 0.012;
      const a2 = { x: a.x + tx * g, z: a.z + tz * g };
      const b2 = { x: b.x - tx * g, z: b.z - tz * g };
      const ring = [
        { x: a2.x + nx, z: a2.z + nz },
        { x: b2.x + nx, z: b2.z + nz },
        { x: b2.x - nx, z: b2.z - nz },
        { x: a2.x - nx, z: a2.z - nz },
      ];
      prism(ring, 0.022 + CURB.h, 0.0, curbTones[Math.floor(r() * curbTones.length)], out);
    }
  }
  // Trittplatten: unregelmässiges Sechseck
  const stepTone = new THREE.Color("#b8b2a6");
  for (const s of d.steps) {
    const ring: Pt[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const j = 0.86 + r() * 0.14;
      const lx = Math.sin(a) * (s.w / 2) * j;
      const lz = Math.cos(a) * (s.d / 2) * j;
      ring.push({
        x: s.x + lx * Math.cos(s.angle) + lz * Math.sin(s.angle),
        z: s.z - lx * Math.sin(s.angle) + lz * Math.cos(s.angle),
      });
    }
    prism(ring, 0.05, 0.0, stepTone.clone().multiplyScalar(0.9 + r() * 0.16), out);
  }
  // Steinchen am Rand: kleine, gewölbte Fünfecke, halb im Boden
  const pebbleTones = ["#b3ab9c", "#a59e90", "#bfb8a8", "#9d9586"].map((c) => new THREE.Color(c));
  for (const p of d.pebbles) {
    const ring: Pt[] = [];
    for (let k = 0; k < 5; k++) {
      const a = p.rot + (k / 5) * Math.PI * 2;
      const j = 0.75 + r() * 0.25;
      ring.push({ x: p.x + Math.cos(a) * p.s * j, z: p.z + Math.sin(a) * p.s * j });
    }
    const tone = pebbleTones[Math.floor(p.tone * pebbleTones.length)];
    prism(ring, p.s * 0.22, -0.02, tone, out, p.s * 0.5);
  }
  if (!out.pos.length) return null;
  // Ebene UV in Metern (feine Steinkörnung, gleich gross auf allen Steinen)
  const uv: number[] = [];
  for (let i = 0; i < out.pos.length; i += 3)
    uv.push(out.pos[i] / 0.8, out.pos[i + 2] / 0.8 + out.pos[i + 1]);
  return toGeometry({ ...out, uv });
}

/** Grasbüschel: sieben kurze Halme im Kreis, nach aussen geneigt (doppelseitig), Höhe 1 (pro Instanz skaliert). */
function tuftGeometry() {
  const pos: number[] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + (k % 2) * 0.4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const h = k % 3 === 0 ? 1 : 0.72;
    const out = 0.55 + (k % 2) * 0.25;
    // Fuss quer zur Neigung, Spitze aussen
    pos.push(
      c * 0.12 - s * 0.16,
      0,
      s * 0.12 + c * 0.16,
      c * 0.12 + s * 0.16,
      0,
      s * 0.12 - c * 0.16,
      c * out,
      h,
      s * out,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Material mit zweiter Textur-Skala: dieselbe Textur grob und gedreht noch einmal darübergelegt, damit keine
 * Wiederholung sichtbar wird.
 */
function surfaceMaterial(map: THREE.Texture, roughness: number) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness });
  m.onBeforeCompile = (sh) => {
    // Anteil der Textur je Ecke (`aTex`): Saum und Grasübergang ohne Belagmuster
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aTex;\nvarying float vTex;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTex = aTex;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vTex;")
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
  vec4 hdTex = texture2D(map, vMapUv);
  vec2 hdUv = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.29 + vec2(0.31, 0.17);
  hdTex.rgb *= mix(0.88, 1.12, texture2D(map, hdUv).g);
  diffuseColor *= mix(vec4(1.0), hdTex, vTex);
#endif`,
      );
  };
  m.customProgramCacheKey = () => "hd-weg";
  return m;
}

const TEXTURES: Record<Surface, () => THREE.Texture> = {
  kies: gravelTexture,
  pflaster: cobbleTexture,
  platten: flagTexture,
  erde: earthTexture,
};

/** Geometrien der Wege (ohne Texturen): Bänder je Belag, Steine, Randgras. */
function pathGeometries(world: World, dress: PathDress, grass: string) {
  const g = new THREE.Color(grass);
  const lists = new Map<Surface, { pos: number[]; col: number[]; uv: number[]; tex: number[] }>();
  world.layout.paths.forEach((p, i) => {
    const s = surfaceOf(p);
    if (!lists.has(s)) lists.set(s, { pos: [], col: [], uv: [], tex: [] });
    ribbon(p, dress.lines[i], s, g, lists.get(s)!);
  });
  const surfaces = [...lists.entries()].map(([s, a]) => {
    const nor = new Array<number>(a.pos.length);
    for (let i = 0; i < nor.length; i += 3) {
      nor[i] = 0;
      nor[i + 1] = 1;
      nor[i + 2] = 0;
    }
    return { surface: s, geo: toGeometry({ ...a, nor }) };
  });
  return { surfaces, stones: stonesGeometry(dress, world.seed) };
}

/** Budget der Wege: Dreiecke und Draw Calls (Test: höchstens sechs Draw Calls). */
export function pathBudget(world: World, lowDetail: boolean) {
  const dress = pathDress(world, lowDetail ? 0.4 : 1);
  const { surfaces, stones } = pathGeometries(world, dress, "#86bf6c");
  const tuft = tuftGeometry();
  const tris =
    surfaces.reduce((n, s) => n + s.geo.attributes.position.count / 3, 0) +
    (stones ? stones.attributes.position.count / 3 : 0) +
    (tuft.attributes.position.count / 3) * dress.tufts.length;
  const calls = surfaces.length + (stones ? 1 : 0) + (dress.tufts.length ? 1 : 0);
  surfaces.forEach((s) => s.geo.dispose());
  stones?.dispose();
  tuft.dispose();
  return { tris, calls, tufts: dress.tufts.length, curbs: dress.curbs.length };
}

export function PathLayer({
  world,
  grass,
  lowDetail,
}: {
  world: World;
  grass: string;
  lowDetail: boolean;
}) {
  const dress = useMemo(() => pathDress(world, lowDetail ? 0.4 : 1), [world, lowDetail]);
  const { surfaces, stones } = useMemo(
    () => pathGeometries(world, dress, grass),
    [world, dress, grass],
  );
  const tuft = useMemo(() => tuftGeometry(), []);
  const materials = useMemo(() => {
    const m = new Map<Surface, THREE.MeshStandardMaterial>();
    for (const s of ["kies", "pflaster", "platten", "erde"] as Surface[])
      m.set(s, surfaceMaterial(TEXTURES[s](), s === "erde" ? 1 : 0.95));
    return m;
  }, []);
  const stepMap = useMemo(() => stepTexture(), []);
  useEffect(
    () => () => {
      surfaces.forEach((s) => s.geo.dispose());
    },
    [surfaces],
  );
  useEffect(() => () => stones?.dispose(), [stones]);
  useEffect(() => () => tuft.dispose(), [tuft]);
  useEffect(
    () => () => {
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      stepMap.dispose();
    },
    [materials, stepMap],
  );

  // Randgras: Instanzen mit Farbe aus der Grasfarbe der Karte
  const tufts = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = tufts.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const base = new THREE.Color(grass);
    const c = new THREE.Color();
    dress.tufts.forEach((t, i) => {
      e.set(0, t.rot, 0);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(t.x, 0, t.z),
        q,
        new THREE.Vector3(t.s * 1.3, t.s * (0.8 + t.tone * 0.5), t.s * 1.3),
      );
      mesh.setMatrixAt(i, m);
      c.copy(base).multiplyScalar(0.78 + t.tone * 0.3);
      c.offsetHSL(0.01 * (t.tone - 0.5), 0.05, 0);
      mesh.setColorAt(i, c);
    });
    mesh.count = dress.tufts.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dress, grass]);

  return (
    <group>
      {surfaces.map((s) => (
        <mesh key={s.surface} geometry={s.geo} material={materials.get(s.surface)} receiveShadow />
      ))}
      {stones && (
        <mesh geometry={stones} receiveShadow castShadow>
          <meshStandardMaterial vertexColors map={stepMap} roughness={0.9} flatShading />
        </mesh>
      )}
      {dress.tufts.length > 0 && (
        <instancedMesh
          ref={tufts}
          args={[tuft, undefined, dress.tufts.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial side={THREE.DoubleSide} roughness={1} />
        </instancedMesh>
      )}
    </group>
  );
}

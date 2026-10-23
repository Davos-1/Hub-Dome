"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import type { WorldMap } from "@/lib/world/map";
import { panoramaOf, riverDistance, type Panorama } from "@/lib/world/panorama";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mergeParts, type Part } from "./geo";

/**
 * Panorama hinter der Karte (P2): drei gestaffelte Bergringe (Vorberge mit Wald, Berge, ferne Gipfel mit Schnee
 * bei «Alpin»), dazu wenige, kleine Wahrzeichen: Alpweide mit Sennhütte, Kühen und Kaminrauch, Kapelle auf einem
 * Vorhügel, Wasserfall an einer Felswand und am Morgen Nebelbänder im Tal. Luftperspektive: Der Szenen-Dunst
 * (exponentiell, siehe `Daylight`) und nach hinten hellere, bläulichere Grundfarben. Reine Darstellung.
 *
 * Budget: Desktop ≤ 100 000 Dreiecke und ≤ 8 Draw Calls, Mobile (`lowDetail`) ≤ 25 000.
 */

const dummy = new THREE.Object3D();
const tmp = new THREE.Color();

const HAZE = new THREE.Color("#9fb4c8");

/** Farbe mit Luftperspektive: Richtung Blaugrau aufhellen (Anteil 0…1). */
function aerial(c: THREE.Color, k: number) {
  return c.lerp(HAZE, k);
}

type Detail = { seg: number; rows: number; trees: number };
const DETAIL: Record<"high" | "low", Detail> = {
  high: { seg: 304, rows: 26, trees: 3100 },
  low: { seg: 112, rows: 12, trees: 700 },
};

/** Alle Ringe als ein Mesh mit Vertexfarben (Wiese, Wald, Fels, Schnee je nach Höhe und Steilheit). */
function ringsGeometry(map: WorldMap, pano: Panorama, d: Detail) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const pal = map.palette;
  const grass = new THREE.Color(pal.grassHill);
  const forest = new THREE.Color(pal.needles[1] ?? pal.needles[0]);
  const rock = new THREE.Color(pal.rocks[0]).lerp(new THREE.Color("#5f6b78"), 0.45);
  const slopeGreen = new THREE.Color(pal.needles[2] ?? pal.needles[0]).lerp(grass, 0.2);
  const snow = new THREE.Color("#f4f6f8");
  const c = new THREE.Color();
  const r = seededRandom(`panorama-farbe-${map.seed}`);
  pano.rings.forEach((ring, ri) => {
    const base = pos.length / 3;
    const seg = ri === 0 ? d.seg : Math.round(d.seg * 0.8);
    const rows = d.rows;
    for (let i = 0; i <= rows; i++) {
      // Dichter am inneren Rand (Übergang zur Karte)
      const t = (i / rows) ** (ri === 0 ? 1.5 : 1);
      const rad = ring.rIn + (ring.rOut - ring.rIn) * t;
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const h = ring.height(a, rad);
        pos.push(Math.cos(a) * rad, h, Math.sin(a) * rad);
        // Steilheit über den Nachbarn in Radialrichtung
        const slope = Math.abs(ring.height(a, rad + 6) - h) / 6;
        const n = r() * 0.08;
        if (h > pano.snowLine * (0.92 + n)) c.copy(snow);
        else if (slope > 0.75 || h > pano.treeLine * 2.2) c.copy(rock).lerp(grass, 0.1 + n);
        else if (ri === 0 && h > 3 && h < pano.treeLine) c.copy(forest).lerp(grass, 0.18 + n);
        else if (ri > 0)
          c.copy(slopeGreen).lerp(rock, Math.min(1, h / (pano.treeLine * 2.2)) * 0.6);
        else c.copy(grass).lerp(forest, 0.35 + n * 2);
        // Am inneren Rand des vorderen Rings genau die Farbe der Karte (keine Naht)
        if (ri === 0) c.lerp(grass, 1 - Math.min(1, (rad - ring.rIn) / 40));
        // Luftperspektive: der Dunst der Szene macht den Grossteil, die Grundfarbe nur leicht vorgetönt
        aerial(c, [0.04, 0.14, 0.26][ri] ?? 0.26);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < seg; j++) {
        const a = base + i * seg + j;
        const b = base + i * seg + ((j + 1) % seg);
        const cc = a + seg;
        const dd = b + seg;
        // Dreiecke nach oben (Umlaufsinn gegen den Uhrzeigersinn von oben gesehen)
        idx.push(a, b, cc, b, dd, cc);
      }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Waldbäume auf den Vorbergen (Nadel und Laub nach Stimmung), nicht im Tal und nicht über der Baumgrenze. */
function forestSpots(map: WorldMap, pano: Panorama, count: number) {
  const r = seededRandom(`panorama-wald-${map.seed}`);
  const ring = pano.rings[0];
  const out: { x: number; y: number; z: number; s: number; conifer: boolean; color: string }[] = [];
  for (let k = 0; k < count * 4 && out.length < count; k++) {
    const a = r() * Math.PI * 2;
    const rad = pano.groundRadius + 8 + r() * (ring.rOut - pano.groundRadius - 20);
    const h = ring.height(a, rad);
    if (h < 2.5 || h > pano.treeLine) continue;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (riverDistance(map, x, z) < 12) continue;
    // Dichte Waldflächen: in Flecken (Rauschen über den Winkel)
    if (Math.sin(a * 9 + rad * 0.05) + Math.sin(a * 23) * 0.5 < -0.4) continue;
    const conifer = r() < Math.max(0.45, map.palette.conifer);
    const list = conifer ? map.palette.needles : map.palette.leaves;
    out.push({
      x,
      y: h - 0.4,
      z,
      s: 1.3 + r() * 1.1,
      conifer,
      color: list[Math.floor(r() * list.length) % list.length],
    });
  }
  return out;
}

/** Wahrzeichen: Sennhütte mit Kühen auf der Alpweide, Kapelle; Fenster leuchten nachts. */
function landmarkParts(map: WorldMap, pano: Panorama) {
  const body: Part[] = [];
  const glow: Part[] = [];
  const ring = pano.rings[0];
  const at = (a: number, rad: number) => {
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    return { x, z, y: ring.height(a, rad), face: Math.atan2(-x, -z) };
  };
  // Alpweide: Hütte, Zaun angedeutet, Kühe
  const alp = at(pano.landmarks.alp, pano.groundRadius + 55);
  const hut = (dx: number, dz: number) => ({
    x: alp.x + dx * Math.cos(alp.face) + dz * Math.sin(alp.face),
    z: alp.z - dx * Math.sin(alp.face) + dz * Math.cos(alp.face),
  });
  const h0 = alp.y;
  body.push(
    {
      geo: new THREE.BoxGeometry(8, 4, 6),
      color: "#8a5a2b",
      pos: [alp.x, h0 + 1.6, alp.z],
      rot: [0, alp.face, 0],
    },
    {
      geo: new THREE.CylinderGeometry(0.01, 5.6, 3, 4, 1),
      color: "#5b4a3e",
      pos: [alp.x, h0 + 5, alp.z],
      rot: [0, alp.face + Math.PI / 4, 0],
      scale: [1.15, 1, 0.85],
    },
    {
      geo: new THREE.BoxGeometry(0.8, 2.2, 0.8),
      color: "#7d7770",
      pos: [hut(2.2, -1).x, h0 + 6, hut(2.2, -1).z],
    },
  );
  glow.push({
    geo: new THREE.BoxGeometry(1.4, 1.1, 0.2),
    color: "#ffe9b8",
    pos: [hut(-1.6, 3.05).x, h0 + 2, hut(-1.6, 3.05).z],
    rot: [0, alp.face, 0],
  });
  const rc = seededRandom(`kuehe-${map.seed}`);
  for (let i = 0; i < 6; i++) {
    const p = hut((rc() - 0.5) * 26, 8 + rc() * 12);
    const a = Math.atan2(p.z, p.x);
    const y = ring.height(a, Math.hypot(p.x, p.z));
    const brown = i % 3 === 0;
    body.push(
      {
        geo: new THREE.BoxGeometry(2.4, 1.3, 1.1),
        color: brown ? "#8a5a3b" : "#f2efe8",
        pos: [p.x, y + 1.25, p.z],
        rot: [0, rc() * 6, 0],
      },
      {
        geo: new THREE.BoxGeometry(0.9, 0.9, 0.8),
        color: "#3a3330",
        pos: [p.x, y + 1.6, p.z + 0.01],
        rot: [0, rc() * 6, 0],
      },
    );
  }
  // Kapelle auf einem Vorhügel
  const ch = at(pano.landmarks.chapel, pano.groundRadius + 38);
  body.push(
    {
      geo: new THREE.BoxGeometry(6, 5, 9),
      color: "#f1ede4",
      pos: [ch.x, ch.y + 2.3, ch.z],
      rot: [0, ch.face, 0],
    },
    {
      geo: new THREE.CylinderGeometry(0.01, 6.2, 3.4, 4, 1),
      color: "#a2442f",
      pos: [ch.x, ch.y + 6.4, ch.z],
      rot: [0, ch.face + Math.PI / 4, 0],
      scale: [0.75, 1, 1.15],
    },
  );
  const tower = {
    x: ch.x - Math.sin(ch.face) * 4.2,
    z: ch.z - Math.cos(ch.face) * 4.2,
  };
  body.push(
    {
      geo: new THREE.BoxGeometry(2.6, 9, 2.6),
      color: "#ece7dc",
      pos: [tower.x, ch.y + 4.4, tower.z],
      rot: [0, ch.face, 0],
    },
    {
      geo: new THREE.ConeGeometry(2.1, 4, 4),
      color: "#4b5563",
      pos: [tower.x, ch.y + 10.9, tower.z],
      rot: [0, ch.face + Math.PI / 4, 0],
    },
  );
  glow.push({
    geo: new THREE.BoxGeometry(1.2, 2, 0.2),
    color: "#ffe9b8",
    pos: [ch.x + Math.sin(ch.face) * 4.55, ch.y + 2.6, ch.z + Math.cos(ch.face) * 4.55],
    rot: [0, ch.face, 0],
  });
  // Ein paar Höfe weiter hinten: nachts einzelne Lichter
  const rl = seededRandom(`hoefe-${map.seed}`);
  for (let i = 0; i < 5; i++) {
    const a = rl() * Math.PI * 2;
    const rad = pano.groundRadius + 70 + rl() * 60;
    const y = ring.height(a, rad);
    if (y > pano.treeLine || riverDistance(map, Math.cos(a) * rad, Math.sin(a) * rad) < 14)
      continue;
    glow.push({
      geo: new THREE.BoxGeometry(1.2, 1, 1.2),
      color: "#ffe9b8",
      pos: [Math.cos(a) * rad, y + 1.6, Math.sin(a) * rad],
    });
    body.push({
      geo: new THREE.BoxGeometry(5, 3, 4),
      color: "#9a7b5b",
      pos: [Math.cos(a) * rad, y + 1.2, Math.sin(a) * rad],
      rot: [0, a, 0],
    });
  }
  return { body, glow, smoke: [hut(2.2, -1).x, h0 + 7.3, hut(2.2, -1).z] as const };
}

/** Wasserfall: Streifen an der Felswand des mittleren Rings, Textur fliesst langsam abwärts. */
function waterfallGeometry(pano: Panorama) {
  const ring = pano.rings[1];
  const a = pano.landmarks.waterfall;
  // Oberkante am Hang, unten am Fuss des Rings
  const r0 = ring.rIn + 18;
  const r1 = ring.rIn + 70;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const rad = r1 + (r0 - r1) * (i / 14);
    pts.push(
      new THREE.Vector3(
        Math.cos(a) * (rad - 2),
        Math.max(0, ring.height(a, rad)) + 0.8,
        Math.sin(a) * (rad - 2),
      ),
    );
  }
  const tx = -Math.sin(a);
  const tz = Math.cos(a);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    const w = 4 + (i / 14) * 5;
    pos.push(p.x - tx * w, p.y, p.z - tz * w, p.x + tx * w, p.y, p.z + tz * w);
    uv.push(0, i / 3, 1, i / 3);
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function waterfallTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#cfe8f4";
  ctx.fillRect(0, 0, 64, 128);
  const r = seededRandom("wasserfall");
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.9)" : "rgba(120,170,200,0.5)";
    ctx.fillRect(r() * 64, r() * 128, 1 + r() * 3, 10 + r() * 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Weicher, horizontaler Nebelstreifen (Deckkraft fällt zu den Rändern ab). */
function fogTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 32);
  const h = ctx.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, "rgba(0,0,0,1)");
  h.addColorStop(0.2, "rgba(0,0,0,0)");
  h.addColorStop(0.8, "rgba(0,0,0,0)");
  h.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function PanoramaLayer({
  map,
  lowDetail,
  glow,
  morning,
  frozen,
}: {
  map: WorldMap;
  lowDetail: boolean;
  /** Leuchtkraft der Fenster (Tageszeit). */
  glow: number;
  /** Morgen: Nebelbänder im Tal. */
  morning: boolean;
  /** `prefers-reduced-motion`: Rauch, Wasserfall und Nebel stehen still. */
  frozen: boolean;
}) {
  const d = lowDetail ? DETAIL.low : DETAIL.high;
  const pano = useMemo(() => panoramaOf(map), [map]);
  const rings = useMemo(() => ringsGeometry(map, pano, d), [map, pano, d]);
  useEffect(() => () => rings.dispose(), [rings]);

  const trees = useMemo(() => forestSpots(map, pano, d.trees), [map, pano, d.trees]);
  const conifers = useMemo(() => trees.filter((t) => t.conifer), [trees]);
  const broad = useMemo(() => trees.filter((t) => !t.conifer), [trees]);
  const coneRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  // Vor dem ersten Zeichnen füllen: sonst kennt das Material die Instanzfarben noch nicht
  useLayoutEffect(() => {
    const fill = (mesh: THREE.InstancedMesh | null, list: typeof trees, tall: number) => {
      if (!mesh) return;
      list.forEach((t, i) => {
        dummy.position.set(t.x, t.y + (tall * t.s) / 2, t.z);
        dummy.rotation.set(0, i, 0);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, aerial(tmp.set(t.color), 0.06).multiplyScalar(0.92));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    fill(coneRef.current, conifers, 2.4);
    fill(crownRef.current, broad, 1.6);
  }, [conifers, broad]);

  const marks = useMemo(() => {
    const p = landmarkParts(map, pano);
    const body = mergeParts(p.body);
    const glowGeo = mergeParts(p.glow);
    [...p.body, ...p.glow].forEach((x) => x.geo.dispose());
    return { body, glow: glowGeo, smoke: p.smoke };
  }, [map, pano]);
  useEffect(
    () => () => {
      marks.body.dispose();
      marks.glow.dispose();
    },
    [marks],
  );

  const fall = useMemo(() => (lowDetail ? null : waterfallGeometry(pano)), [pano, lowDetail]);
  const fallTex = useMemo(() => (lowDetail ? null : waterfallTexture()), [lowDetail]);
  useEffect(
    () => () => {
      fall?.dispose();
      fallTex?.dispose();
    },
    [fall, fallTex],
  );

  const fogTex = useMemo(() => fogTexture(), []);
  useEffect(() => () => fogTex.dispose(), [fogTex]);
  // Nebelbänder: vor den Vorbergen über dem Talboden, alle in einer Geometrie (ein Draw Call)
  const bands = useMemo(() => {
    const r = seededRandom(`nebel-${map.seed}`);
    const ring = pano.rings[0];
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (lowDetail ? 3 : 6); i++) {
      const a = r() * Math.PI * 2;
      const rad = pano.groundRadius - 30 + r() * 45;
      const y = Math.max(0, ring.height(a, rad)) + 3 + r() * 6;
      const g = new THREE.PlaneGeometry(120 + r() * 120, 16);
      g.rotateY(-Math.PI / 2);
      g.translate(rad, y, 0);
      g.rotateY(-a);
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [map.seed, pano, lowDetail]);
  useEffect(() => () => bands.dispose(), [bands]);

  const smokeRef = useRef<THREE.InstancedMesh>(null);
  const fogRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime;
    if (fallTex) fallTex.offset.set(0, (t * 0.35) % 1);
    const sm = smokeRef.current;
    if (sm) {
      for (let i = 0; i < 5; i++) {
        const k = (((t * 0.08 + i / 5) % 1) + 1) % 1;
        dummy.position.set(
          marks.smoke[0] + k * 2,
          marks.smoke[1] + k * 9,
          marks.smoke[2] + k * 1.5,
        );
        dummy.scale.setScalar(0.9 + k * 2.6);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
    }
    // Nebel zieht sehr langsam
    if (fogRef.current) fogRef.current.rotation.y = Math.sin(t * 0.015) * 0.025;
  });

  return (
    <group>
      <mesh geometry={rings} receiveShadow={false}>
        <meshLambertMaterial vertexColors />
      </mesh>
      {conifers.length > 0 && (
        <instancedMesh
          ref={coneRef}
          args={[undefined, undefined, conifers.length]}
          key={`c${conifers.length}`}
        >
          <coneGeometry args={[0.95, 2.4, 6]} />
          <meshLambertMaterial />
        </instancedMesh>
      )}
      {broad.length > 0 && (
        <instancedMesh
          ref={crownRef}
          args={[undefined, undefined, broad.length]}
          key={`b${broad.length}`}
        >
          <icosahedronGeometry args={[0.9, 0]} />
          <meshLambertMaterial />
        </instancedMesh>
      )}
      <mesh geometry={marks.body}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={marks.glow}>
        <meshStandardMaterial color="#ffe9b8" emissive="#ffb84d" emissiveIntensity={glow * 1.4} />
      </mesh>
      <instancedMesh ref={smokeRef} args={[undefined, undefined, 5]}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshLambertMaterial color="#e8e6e1" transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
      {fall && fallTex && (
        <mesh geometry={fall}>
          <meshLambertMaterial map={fallTex} transparent opacity={0.9} />
        </mesh>
      )}
      {morning && (
        <group ref={fogRef}>
          <mesh geometry={bands}>
            <meshBasicMaterial map={fogTex} transparent depthWrite={false} opacity={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Dreiecke und Draw Calls des Panoramas (Test des Budgets: Desktop ≤ 100 000 / 8, Mobile ≤ 25 000). */
export function panoramaBudget(map: WorldMap, lowDetail: boolean) {
  const d = lowDetail ? DETAIL.low : DETAIL.high;
  const pano = panoramaOf(map);
  const rings = ringsGeometry(map, pano, d);
  const trees = forestSpots(map, pano, d.trees);
  const conifer = trees.filter((t) => t.conifer).length;
  const marks = landmarkParts(map, pano);
  const tri = (g: THREE.BufferGeometry) =>
    (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  const landmarkTris = [...marks.body, ...marks.glow].reduce((s, p) => s + tri(p.geo), 0);
  const fall = lowDetail ? null : waterfallGeometry(pano);
  const triangles =
    tri(rings) +
    conifer * tri(new THREE.ConeGeometry(0.95, 2.4, 6)) +
    (trees.length - conifer) * tri(new THREE.IcosahedronGeometry(0.9, 0)) +
    landmarkTris +
    5 * tri(new THREE.IcosahedronGeometry(0.7, 0)) +
    (fall ? tri(fall) : 0) +
    (lowDetail ? 3 : 6) * 2;
  // Ringe, Nadelbäume, Laubbäume, Wahrzeichen, Fenster, Rauch, Wasserfall, Nebel
  const drawCalls = 7 + (fall ? 1 : 0);
  return { triangles, drawCalls };
}

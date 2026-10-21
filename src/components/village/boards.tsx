"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ThreeEvent } from "@react-three/fiber";
import type { VillageModel } from "@/lib/village-model";
import type { AtlasEntry } from "./label-atlas";
import type { VillageGardens } from "./garden-geometry";
import { mergeParts, type Part } from "./geo";
import { NOTICE_ANGLE, NOTICE_POS, noticePostParts, quarterPostParts } from "./plaza-geometry";
import type { VillageAtlas } from "./village-atlas";

type Spec = {
  entry: AtlasEntry;
  w: number;
  h: number;
  matrix: THREE.Matrix4;
  kind: "holz" | "baustelle" | "quartier" | "anschlag";
  houseId?: string;
};

const WOOD_BOARD = "#7a5233";

function compose(
  pos: [number, number, number],
  rotY: number,
  rotX = 0,
  parent?: THREE.Matrix4,
): THREE.Matrix4 {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0, "YXZ")),
    new THREE.Vector3(1, 1, 1),
  );
  return parent ? new THREE.Matrix4().multiplyMatrices(parent, m) : m;
}

/** Holzkörper (mit Vertexfarbe) und Vorderseiten (mit Atlas-UV) aller Schilder als je eine Geometrie. */
function buildBoards(specs: Spec[], atlas: VillageAtlas) {
  const [AW, AH] = atlas.size;
  const bodies: THREE.BufferGeometry[] = [];
  const faces: THREE.BufferGeometry[] = [];
  const wood = new THREE.Color(WOOD_BOARD);
  for (const s of specs) {
    const b = new THREE.BoxGeometry(s.w, s.h, 0.07).toNonIndexed();
    b.deleteAttribute("uv");
    const colors = new Float32Array(b.attributes.position.count * 3);
    for (let i = 0; i < b.attributes.position.count; i++) wood.toArray(colors, i * 3);
    b.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    b.applyMatrix4(s.matrix);
    bodies.push(b);

    const f = new THREE.PlaneGeometry(s.w, s.h).toNonIndexed();
    const uv = f.attributes.uv;
    const { ax, ay, canvas } = s.entry;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (ax + uv.getX(i) * canvas.width) / AW,
        1 - (ay + (1 - uv.getY(i)) * canvas.height) / AH,
      );
    }
    f.translate(0, 0, 0.036);
    f.applyMatrix4(s.matrix);
    f.deleteAttribute("color");
    faces.push(f);
  }
  const body = bodies.length ? mergeGeometries(bodies, false) : null;
  const face = faces.length ? mergeGeometries(faces, false) : null;
  bodies.forEach((g) => g.dispose());
  faces.forEach((g) => g.dispose());
  return { body, face };
}

/** Pfosten der Schilder (Quartiertafeln, Anschlagbrett) in Weltkoordinaten. */
function buildPosts(model: VillageModel) {
  const geos: THREE.BufferGeometry[] = [];
  const add = (parts: Part[], m: THREE.Matrix4) => {
    const g = mergeParts(parts);
    parts.forEach((p) => p.geo.dispose());
    g.applyMatrix4(m);
    geos.push(g);
  };
  for (const q of model.layout.quarters) {
    const ux = Math.cos(q.theta);
    const uz = Math.sin(q.theta);
    add(quarterPostParts(), compose([q.x + ux * 0.4, 0, q.z + uz * 0.4], Math.atan2(-ux, -uz)));
  }
  add(
    noticePostParts(),
    compose(
      [NOTICE_POS.x, 0, NOTICE_POS.z],
      Math.atan2(Math.cos(NOTICE_ANGLE), Math.sin(NOTICE_ANGLE)),
    ),
  );
  const merged = geos.length ? mergeGeometries(geos, false) : null;
  geos.forEach((g) => g.dispose());
  return merged;
}

/**
 * Alle Schilder des Dorfs: Holzschilder am Tor, Baustellenschilder, Quartiertafeln und Anschlagbrett.
 * Zwei Draw Calls für alle Schilder plus einer für die Pfosten (Beschriftung aus dem Atlas).
 */
export function Boards({
  model,
  atlas,
  gardens,
  isOwner,
  onConstruction,
  onNotice,
  onHoverPointer,
}: {
  model: VillageModel;
  atlas: VillageAtlas;
  gardens: VillageGardens;
  isOwner: boolean;
  /** Klick auf das Baustellenschild eines Hauses (nur Besitzer). */
  onConstruction: (houseId: string) => void;
  /** Klick auf eine Zeile des Anschlagbretts. */
  onNotice: (index: number) => void;
  onHoverPointer: (pointer: boolean) => void;
}) {
  const built = useMemo(() => {
    const specs: Spec[] = [];
    for (const b of gardens.boards) {
      const entry = b.kind === "holz" ? atlas.board[b.houseId] : atlas.construction;
      if (!entry) continue;
      specs.push({
        entry,
        w: b.size[0],
        h: b.size[1],
        matrix: new THREE.Matrix4().multiplyMatrices(
          b.world,
          new THREE.Matrix4().makeTranslation(...b.pos),
        ),
        kind: b.kind,
        houseId: b.houseId,
      });
    }
    for (const q of model.layout.quarters) {
      const ux = Math.cos(q.theta);
      const uz = Math.sin(q.theta);
      const parent = compose([q.x + ux * 0.4, 0, q.z + uz * 0.4], Math.atan2(-ux, -uz));
      specs.push({
        entry: atlas.quarterBoard[q.id],
        w: 4.8,
        h: 2.4,
        matrix: compose([0, 2.6, 0.14], 0, -0.28, parent),
        kind: "quartier",
      });
    }
    specs.push({
      entry: atlas.notice,
      w: 2.3,
      h: 1.44,
      matrix: compose(
        [0, 1.38, 0.08],
        0,
        0,
        compose(
          [NOTICE_POS.x, 0, NOTICE_POS.z],
          Math.atan2(Math.cos(NOTICE_ANGLE), Math.sin(NOTICE_ANGLE)),
        ),
      ),
      kind: "anschlag",
    });
    return { specs, ...buildBoards(specs, atlas), posts: buildPosts(model) };
  }, [model, atlas, gardens]);

  useEffect(
    () => () => {
      built.body?.dispose();
      built.face?.dispose();
      built.posts?.dispose();
    },
    [built],
  );

  const specAt = (e: ThreeEvent<MouseEvent | PointerEvent>) =>
    e.faceIndex == null ? undefined : built.specs[Math.floor(e.faceIndex / 2)];
  const clickable = (s: Spec | undefined) =>
    s !== undefined && (s.kind === "anschlag" || (s.kind === "baustelle" && isOwner));

  return (
    <group>
      {built.posts && (
        <mesh geometry={built.posts} castShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      )}
      {built.body && (
        <mesh geometry={built.body} castShadow>
          <meshStandardMaterial vertexColors roughness={0.9} />
        </mesh>
      )}
      {built.face && (
        <mesh
          geometry={built.face}
          onPointerMove={(e) => {
            onHoverPointer(clickable(specAt(e)));
          }}
          onPointerOut={() => onHoverPointer(false)}
          onClick={(e) => {
            if (e.delta > 5) return;
            const s = specAt(e);
            if (!s) return;
            if (s.kind === "anschlag" && e.uv) {
              const { ay, canvas } = s.entry;
              const [, AH] = atlas.size;
              const v0 = 1 - (ay + canvas.height) / AH;
              const local = (e.uv.y - v0) / (canvas.height / AH);
              const row = Math.floor((640 * (1 - local) - 124) / 100);
              if (row >= 0) {
                e.stopPropagation();
                onNotice(row);
              }
            } else if (s.kind === "baustelle" && isOwner && s.houseId) {
              e.stopPropagation();
              onConstruction(s.houseId);
            }
          }}
        >
          <meshStandardMaterial map={atlas.base} roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}

"use client";

import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { QuarterLayout } from "@/lib/layout";
import type { VillageModel } from "@/lib/village-model";
import { noticeRowAt, type AtlasEntry } from "./label-atlas";
import type { VillageGardens } from "./garden-geometry";
import { composeInto, mergeAll, mergeParts, yawMatrix, type Part, type Vec3 } from "./geo";
import { isClick } from "./pointer";
import { NOTICE_ANGLE, noticePos, noticePostParts, quarterPostParts } from "./plaza-geometry";
import { useDisposable } from "./use-disposable";
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

/** Standort der Quartiertafel am Rand des Nebenplatzes, mit dem Rücken zum Platz. */
function quarterMatrix(q: QuarterLayout): THREE.Matrix4 {
  const ux = Math.cos(q.theta);
  const uz = Math.sin(q.theta);
  return yawMatrix(q.x + ux * 0.4, q.z + uz * 0.4, Math.atan2(-ux, -uz));
}

/** Standort des Anschlagbretts am Hauptplatz. */
function noticeMatrix(plazaRadius: number): THREE.Matrix4 {
  const notice = noticePos(plazaRadius);
  return yawMatrix(notice.x, notice.z, Math.atan2(Math.cos(NOTICE_ANGLE), Math.sin(NOTICE_ANGLE)));
}

/** Lage `pos` (um die X-Achse um `tiltX` geneigt) im Koordinatensystem `parent`. */
function onParent(pos: Vec3, tiltX: number, parent: THREE.Matrix4): THREE.Matrix4 {
  const local = composeInto(new THREE.Matrix4(), pos, [tiltX, 0, 0], [1, 1, 1]);
  return new THREE.Matrix4().multiplyMatrices(parent, local);
}

/** Alle Schilder des Dorfs in fester Reihenfolge: Tor- und Baustellenschilder, Quartiertafeln, Anschlagbrett. */
function boardSpecs(model: VillageModel, atlas: VillageAtlas, gardens: VillageGardens): Spec[] {
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
    specs.push({
      entry: atlas.quarterBoard[q.id],
      w: 4.8,
      h: 2.4,
      matrix: onParent([0, 2.6, 0.14], -0.28, quarterMatrix(q)),
      kind: "quartier",
    });
  }
  specs.push({
    entry: atlas.notice,
    w: 2.3,
    h: 1.44,
    matrix: onParent([0, 1.38, 0.08], 0, noticeMatrix(model.layout.plazaRadius)),
    kind: "anschlag",
  });
  return specs;
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
    const { ax, ay, w, h } = s.entry;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (ax + uv.getX(i) * w) / AW, 1 - (ay + (1 - uv.getY(i)) * h) / AH);
    }
    f.translate(0, 0, 0.036);
    f.applyMatrix4(s.matrix);
    f.deleteAttribute("color");
    faces.push(f);
  }
  return { body: mergeAll(bodies), face: mergeAll(faces) };
}

/** Pfosten der Schilder (Quartiertafeln, Anschlagbrett) in Weltkoordinaten. */
function buildPosts(model: VillageModel): THREE.BufferGeometry | null {
  const placed = (parts: Part[], m: THREE.Matrix4) => mergeParts(parts).applyMatrix4(m);
  const geos = model.layout.quarters.map((q) => placed(quarterPostParts(), quarterMatrix(q)));
  geos.push(placed(noticePostParts(), noticeMatrix(model.layout.plazaRadius)));
  return mergeAll(geos);
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
  const built = useDisposable(() => {
    const specs = boardSpecs(model, atlas, gardens);
    const { body, face } = buildBoards(specs, atlas);
    const posts = buildPosts(model);
    return {
      specs,
      body,
      face,
      posts,
      dispose() {
        body?.dispose();
        face?.dispose();
        posts?.dispose();
      },
    };
  }, [model, atlas, gardens]);

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
            if (!isClick(e)) return;
            const s = specAt(e);
            if (!s) return;
            if (s.kind === "anschlag" && e.uv) {
              const { ay, h } = s.entry;
              const [, AH] = atlas.size;
              const v0 = 1 - (ay + h) / AH;
              const row = noticeRowAt((e.uv.y - v0) / (h / AH));
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

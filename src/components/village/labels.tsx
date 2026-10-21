"use client";

import { useEffect, useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { FachbereichId } from "@/lib/fachbereiche";
import type { VillageModel } from "@/lib/village-model";
import { LabelSprite } from "./label-sprite";
import type { SceneActions } from "./scene-actions";
import type { SceneStore } from "./scene-store";
import type { VillageAtlas } from "./village-atlas";

/**
 * Beschriftungen als Sprites mit konstanter Bildschirmgrösse: Zentrale, Chip pro Haus (Karte bei Hover
 * oder Tastaturwahl), Quartiernamen. Pro Bild werden Sichtbarkeit und Überlappung neu berechnet.
 */
export function Labels({
  model,
  atlas,
  tops,
  store,
  actions,
}: {
  model: VillageModel;
  atlas: VillageAtlas;
  /** Höhe der Oberkante pro Haus (Meter). */
  tops: Record<string, number>;
  store: SceneStore;
  actions: SceneActions;
}) {
  // Labels und Gruppe in einem Zug bauen (die Fabrik darf nicht zweimal verschiedene Gruppen füllen)
  const { labels, group } = useMemo(() => {
    const out: LabelSprite[] = [];
    const { layout } = model;
    for (const h of model.houses) {
      const l = layout.houses[h.id];
      if (!l) continue;
      if (h.kind === "zentrale") {
        out.push(
          new LabelSprite(
            new THREE.Vector3(l.x, (tops[h.id] ?? 6) + 1, l.z),
            atlas.zentralePill,
            0.034,
            null,
            0,
            h.id,
            null,
            null,
          ),
        );
      } else {
        out.push(
          new LabelSprite(
            new THREE.Vector3(l.x, (tops[h.id] ?? 4) + 0.5, l.z),
            atlas.chip[h.id],
            0.032,
            atlas.card[h.id],
            0.062,
            h.id,
            null,
            l.quarterId,
          ),
        );
      }
    }
    for (const q of layout.quarters) {
      out.push(
        new LabelSprite(
          new THREE.Vector3(q.x, 3.4, q.z),
          atlas.quarterPill[q.id],
          0.03,
          null,
          0,
          null,
          q.id,
          q.id,
        ),
      );
    }
    const g = new THREE.Group();
    out.forEach((l) => g.add(l.sprite));
    return { labels: out, group: g };
  }, [model, atlas, tops]);

  useEffect(() => () => labels.forEach((l) => l.dispose()), [labels]);

  const homes = model.houses.length - 1;
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const s = store.get();
    const nav = s.nav;
    const nq = nav.level === "dorf" ? null : nav.q;
    const active = s.hoverHouseId ?? s.kbdHouse;
    const cam = state.camera;
    const el = state.gl.domElement;
    const Wd = el.clientWidth;
    const Hd = el.clientHeight;
    const k = 1.207 * Hd;
    const list: { l: LabelSprite; dist: number; x: number; y: number; w: number; h: number }[] = [];
    const filter = s.filter;

    for (const l of labels) {
      const showAlt = l.hasAlt && l.houseId === active;
      if (showAlt !== l.showingAlt) l.show(showAlt);
      const dist = cam.position.distanceTo(l.sprite.position);
      let dim = 1;
      if (filter && l.houseId) {
        const info = model.byId[l.houseId];
        if (info.kind !== "zentrale" && !info.items.some((i) => i.kind === filter)) dim = 0.28;
      }
      let op = dim;
      if (nq && l.ownerQuarter !== nq) op *= 0.3;
      if (nq && l.quarterId === nq) op = 0;
      if (
        nav.level === "dorf" &&
        homes > 15 &&
        l.ownerQuarter &&
        !l.quarterId &&
        !showAlt &&
        l.houseId !== active
      )
        op = 0;
      if (l.quarterId && nav.level === "dorf" && s.kbdQuarter && s.kbdQuarter !== l.quarterId)
        op *= 0.55;
      if ((!showAlt && l.hasAlt) || (l.quarterId && nav.level !== "dorf")) {
        op *= Math.min(1, Math.max(0, (dist - 18) / 6));
      }
      l.setOp(op);
      if (l.bottom && !showAlt && op > 0.02) {
        v.copy(l.sprite.position).project(cam);
        if (v.z < 1) {
          list.push({
            l,
            dist: l.quarterId ? -1 : dist,
            x: ((v.x + 1) / 2) * Wd,
            y: ((1 - v.y) / 2) * Hd,
            w: l.sprite.scale.x * k,
            h: l.sprite.scale.y * k,
          });
        }
      } else {
        l.resetAnchor();
      }
    }

    // Überlappung: höchstens ein Ausweichschritt nach oben, sonst ausblenden; Nähere haben Vorrang.
    list.sort((a, b) => a.dist - b.dist);
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const it of list) {
      let off = 0;
      let ok = false;
      for (let n = 0; n < 2 && !ok; n++) {
        const r = {
          x0: it.x - it.w / 2,
          x1: it.x + it.w / 2,
          y0: it.y - it.h - off,
          y1: it.y - off,
        };
        if (!placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0)) {
          placed.push(r);
          ok = true;
        } else if (n === 0) off = it.h * 1.06;
      }
      if (!ok) {
        off = 0;
        it.l.setOp(0);
      }
      it.l.dodge(-off / it.h);
      if (ok && off > 0) it.l.setOp(it.l.op * 0.85);
    }
    for (const l of labels) l.applyOpacity();
  });

  return (
    <primitive
      object={group}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        const q = e.object.userData.quarterId as FachbereichId | undefined;
        if (!q || e.delta > 5) return;
        e.stopPropagation();
        actions.openQuarter(q);
      }}
    />
  );
}

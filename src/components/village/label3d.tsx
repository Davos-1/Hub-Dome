"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

type Props = {
  text: string;
  /** Zweiter, abgeschwächter Textteil (z.B. Anzahl). */
  sub?: string;
  position: [number, number, number];
  /** Höhe des Schilds in Metern. */
  height: number;
  dark?: boolean;
};

const PX_H = 96;

function draw({ text, sub, dark }: Pick<Props, "text" | "sub" | "dark">) {
  const font = `600 44px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const subFont = `400 38px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const w1 = measure.measureText(text).width;
  measure.font = subFont;
  const w2 = sub ? measure.measureText(`  · ${sub}`).width : 0;
  const width = Math.ceil(Math.min(w1 + w2, 900) + 56);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = PX_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = dark ? "rgba(24,24,27,0.92)" : "rgba(255,255,255,0.93)";
  ctx.beginPath();
  ctx.roundRect(0, 0, width, PX_H, PX_H / 2);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.fillStyle = dark ? "#fff" : "#18181b";
  ctx.font = font;
  ctx.fillText(text, 28, PX_H / 2 + 2, 900);
  if (sub) {
    ctx.fillStyle = dark ? "rgba(255,255,255,0.65)" : "rgba(24,24,27,0.55)";
    ctx.font = subFont;
    ctx.fillText(`  · ${sub}`, 28 + w1, PX_H / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / PX_H };
}

/**
 * Beschriftung als Sprite. Bewusst ohne DOM-Overlay (drei `Html`): das vermeidet
 * Portal-Fehler beim Verlassen der Seite und kostet nur eine Textur pro Schild.
 */
export function Label3D({ text, sub, position, height, dark }: Props) {
  const { texture, aspect } = useMemo(() => draw({ text, sub, dark }), [text, sub, dark]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

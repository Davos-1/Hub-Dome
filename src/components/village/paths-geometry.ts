import * as THREE from "three";
import { seededRandom } from "./colors";

/** Kachelbare Kies-Textur (hell, damit die Vertexfarbe den Ton bestimmt). */
export function gravelTexture(): THREE.CanvasTexture {
  const N = 512;
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const ctx = c.getContext("2d")!;
  const rnd = seededRandom("kies");
  ctx.fillStyle = "#f3f0e9";
  ctx.fillRect(0, 0, N, N);
  const dot = (x: number, y: number, r: number, colour: string) => {
    ctx.fillStyle = colour;
    // an allen Rändern spiegeln, damit die Textur nahtlos kachelt
    for (const dx of [-N, 0, N]) {
      for (const dy of [-N, 0, N]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * (0.7 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 260; i++) {
    dot(
      rnd() * N,
      rnd() * N,
      10 + rnd() * 22,
      `rgba(${(200 + rnd() * 30) | 0},${(195 + rnd() * 30) | 0},${(185 + rnd() * 30) | 0},0.35)`,
    );
  }
  for (let i = 0; i < 5200; i++) {
    const g = (205 + rnd() * 50) | 0;
    dot(rnd() * N, rnd() * N, 1.2 + rnd() * 3.2, `rgb(${g},${g - 4},${g - 10})`);
  }
  for (let i = 0; i < 900; i++) {
    dot(rnd() * N, rnd() * N, 0.8 + rnd() * 1.4, "rgba(255,255,255,0.7)");
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { box, composeInto, mergeAll, mergeParts, yawMatrix, type Part } from "./geo";

/** Zählt, wie oft eine Geometrie freigegeben wird. */
function watchDispose(geo: THREE.BufferGeometry) {
  const spy = vi.fn();
  geo.addEventListener("dispose", spy);
  return spy;
}

describe("mergeParts", () => {
  it("führt Bauteile zu einer Geometrie mit Position, Normale und Farbe zusammen", () => {
    const parts: Part[] = [
      { geo: box(1, 1, 1), color: "#ff0000" },
      { geo: box(1, 1, 1), color: "#00ff00", pos: [4, 0, 0] },
    ];
    const merged = mergeParts(parts);
    // Würfel: 12 Dreiecke, nicht indiziert
    expect(merged.attributes.position.count).toBe(2 * 36);
    expect(Object.keys(merged.attributes).sort()).toEqual(["color", "normal", "position"]);
    expect(merged.boundingSphere).not.toBeNull();
    // erstes Teil rot, zweites grün
    const color = merged.attributes.color;
    expect([color.getX(0), color.getY(0)]).toEqual([1, 0]);
    expect([color.getX(36), color.getY(36)]).toEqual([0, 1]);
  });

  it("wendet Verschiebung, Drehung und Skalierung an", () => {
    const merged = mergeParts([
      { geo: box(1, 1, 1), color: "#ffffff", pos: [2, 3, 4], scale: [2, 4, 6] },
    ]);
    const bounds = new THREE.Box3().setFromBufferAttribute(merged.attributes.position as never);
    expect(bounds.min.toArray()).toEqual([1, 1, 1]);
    expect(bounds.max.toArray()).toEqual([3, 5, 7]);
  });

  it("gibt die Geometrien der Bauteile frei", () => {
    const parts: Part[] = [
      { geo: box(1, 1, 1), color: "#ffffff" },
      { geo: box(2, 2, 2), color: "#ffffff" },
    ];
    const spies = parts.map((p) => watchDispose(p.geo));
    mergeParts(parts);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("mergeAll", () => {
  it("gibt bei einer leeren Liste null zurück", () => {
    expect(mergeAll([])).toBeNull();
  });

  it("führt Geometrien zusammen, berechnet die Hüllkugel und gibt die Teile frei", () => {
    const parts = [
      mergeParts([{ geo: box(1, 1, 1), color: "#ffffff" }]),
      mergeParts([{ geo: box(1, 1, 1), color: "#ffffff", pos: [10, 0, 0] }]),
    ];
    const spies = parts.map(watchDispose);
    const merged = mergeAll(parts);
    expect(merged?.attributes.position.count).toBe(72);
    expect(merged?.boundingSphere?.center.x).toBeCloseTo(5);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("yawMatrix", () => {
  it("dreht um Y und verschiebt auf (x, 0, z)", () => {
    const p = new THREE.Vector3(0, 1, 1).applyMatrix4(yawMatrix(5, -2, Math.PI / 2));
    expect(p.x).toBeCloseTo(6);
    expect(p.y).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(-2);
  });

  it("entspricht composeInto mit reiner Y-Drehung", () => {
    const a = yawMatrix(1, 2, 0.7);
    const b = composeInto(new THREE.Matrix4(), [1, 0, 2], [0, 0.7, 0], [1, 1, 1]);
    expect(a.elements).toEqual(b.elements);
  });
});

describe("composeInto", () => {
  it("schreibt in die übergebene Matrix und gibt sie zurück", () => {
    const out = new THREE.Matrix4();
    const result = composeInto(out, [1, 2, 3], [0, 0, 0], [2, 2, 2]);
    expect(result).toBe(out);
    expect(new THREE.Vector3(1, 1, 1).applyMatrix4(out).toArray()).toEqual([3, 4, 5]);
  });
});

"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { inspectGlb } from "@/lib/glb";
import { MODEL_LIMITS } from "@/lib/styles";

export type ModelStatus = "loading" | "ready" | "error";

/** Gibt Geometrien, Materialien und Texturen eines geladenen Modells frei (Arbeitsspeicher sparen). */
function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const m of materials) {
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      m.dispose();
    }
  });
}

/**
 * Lädt ein hochgeladenes GLB im Hintergrund (nur wenn die Zentrale im Stil «Eigenes Modell» angezeigt wird),
 * prüft es erneut, skaliert es auf die Dorfgrösse und gibt alles beim Entfernen wieder frei.
 * Externe Verweise im Modell werden blockiert; es werden nur Daten gelesen, nie Code ausgeführt.
 */
export function CustomModel({
  url,
  onStatus,
}: {
  url: string;
  onStatus: (status: ModelStatus) => void;
}) {
  const [object, setObject] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Group | null = null;
    onStatus("loading");

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Download fehlgeschlagen");
        const buffer = await res.arrayBuffer();
        if (!inspectGlb(buffer).ok) throw new Error("Ungültiges Modell");

        const loader = new GLTFLoader();
        // Nur eingebettete Daten erlauben (data:/blob:), keine Netzwerkzugriffe aus dem Modell heraus.
        loader.manager.setURLModifier((u) =>
          u.startsWith("data:") || u.startsWith("blob:") ? u : "",
        );
        const gltf = await loader.parseAsync(buffer, "");
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }

        const inner = gltf.scene;
        const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
        const horizontal = Math.max(size.x, size.z) || 1;
        const s = Math.min(
          MODEL_LIMITS.fitSize / horizontal,
          (MODEL_LIMITS.fitSize * 1.6) / (size.y || 1),
        );
        inner.scale.setScalar(s);
        const box = new THREE.Box3().setFromObject(inner);
        const center = box.getCenter(new THREE.Vector3());
        inner.position.set(-center.x, -box.min.y, -center.z);
        inner.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const root = new THREE.Group();
        root.add(inner);
        loaded = root;
        setObject(root);
        onStatus("ready");
      } catch {
        if (!cancelled) onStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (loaded) disposeObject(loaded);
    };
  }, [url, onStatus]);

  return object ? <primitive object={object} /> : null;
}

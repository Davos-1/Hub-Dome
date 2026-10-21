import * as THREE from "three";
import type { AtlasEntry } from "./label-atlas";

/**
 * Eine Beschriftung als Sprite mit konstanter Bildschirmgrösse. Die Zustände (Deckkraft, Karte statt Chip)
 * ändern sich pro Bild; sie leben in dieser Klasse, nicht in React.
 */
export class LabelSprite {
  readonly sprite: THREE.Sprite;
  private readonly mat: THREE.SpriteMaterial;
  /** Chip ist unten verankert (Spitze zeigt auf das Haus) und darf ausweichen. */
  readonly bottom: boolean;
  showingAlt = false;
  private opacity = 1;
  private center: [number, number];

  constructor(
    pos: THREE.Vector3,
    private readonly base: AtlasEntry,
    private readonly baseHeight: number,
    private readonly alt: AtlasEntry | null,
    private readonly altHeight: number,
    readonly houseId: string | null,
    readonly quarterId: string | null,
    readonly ownerQuarter: string | null,
  ) {
    this.mat = new THREE.SpriteMaterial({
      map: base.tex,
      transparent: true,
      depthTest: false,
      sizeAttenuation: false,
      toneMapped: false,
    });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.position.copy(pos);
    this.sprite.renderOrder = 10;
    if (quarterId) this.sprite.userData.quarterId = quarterId;
    this.bottom = base.center[1] === 0;
    this.center = base.center;
    this.show(false);
  }

  get op() {
    return this.opacity;
  }

  setOp(v: number) {
    this.opacity = v;
  }

  get hasAlt() {
    return this.alt !== null;
  }

  /** Chip (false) oder Karte (true) zeigen. */
  show(alt: boolean) {
    const useAlt = alt && this.alt !== null;
    const e = useAlt ? this.alt! : this.base;
    const h = useAlt ? this.altHeight : this.baseHeight;
    this.showingAlt = alt;
    this.center = e.center;
    this.mat.map = e.tex;
    this.mat.needsUpdate = true;
    this.sprite.center.set(e.center[0], e.center[1]);
    this.sprite.scale.set(h * e.aspect, h, 1);
    this.sprite.renderOrder = useAlt ? 20 : 10;
  }

  /** Senkrechte Verschiebung (Anteil der Höhe) gegen Überlappung. */
  dodge(offset: number) {
    this.sprite.center.set(this.center[0], offset);
  }

  resetAnchor() {
    this.sprite.center.set(this.center[0], this.center[1]);
  }

  applyOpacity() {
    this.mat.opacity = this.opacity;
    this.sprite.visible = this.opacity > 0.01;
  }

  dispose() {
    this.mat.dispose();
  }
}

/** Rauchfahne eines Kamins: Sprites steigen auf, werden grösser und blenden aus. */
export class SmokeStack {
  readonly group = new THREE.Group();
  private readonly puffs: { sprite: THREE.Sprite; phase: number }[] = [];

  constructor(
    texture: THREE.Texture,
    private readonly x: number,
    private readonly y: number,
    private readonly z: number,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        color: "#f4f4f2",
      });
      const sprite = new THREE.Sprite(mat);
      this.group.add(sprite);
      this.puffs.push({ sprite, phase: i / count });
    }
  }

  update(time: number, wind: { x: number; z: number }) {
    for (const it of this.puffs) {
      const p = (time * 0.22 + it.phase) % 1;
      it.sprite.position.set(
        this.x + p * 0.9 * wind.x,
        this.y + p * 2.4,
        this.z + p * 0.9 * wind.z,
      );
      const sc = 0.35 + p * 1.1;
      it.sprite.scale.set(sc, sc, 1);
      it.sprite.material.opacity = Math.sin(p * Math.PI) * 0.55;
    }
  }

  dispose() {
    this.puffs.forEach((p) => p.sprite.material.dispose());
  }
}

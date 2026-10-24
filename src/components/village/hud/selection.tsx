"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { VillageModel } from "@/lib/village-model";
import { useOverlay, type OverlayStore } from "../overlay-store";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore, type TafelMode } from "../scene-store";
import { HUD, hudLayout, sucherAround } from "./layout";
import { useViewport } from "./use-viewport";

type Tile = {
  key: string;
  label: string;
  glyph: string;
  onClick: () => void;
  on: boolean;
  /** Objekt: Petrol gefüllt. */
  primary?: boolean;
  badge?: number;
};

/**
 * Hausauswahl «Sucher» (Phase 4h): vier Ecken um das gewählte Haus, dazu vier Kacheln (86 × 72 px) oben, rechts,
 * unten und links: Öffnen (mit Zähler), Objekt (Petrol), Bearbeiten, Liste. Erst nach dem Anflug sichtbar,
 * danach folgen sie der Kamera. Besucher sehen nur Öffnen und Liste. Ohne Platz (schmale Fläche) entfallen
 * sie; auf dem Handy erscheinen die Kacheln als Leiste unten.
 */
export function Selection({
  model,
  store,
  overlay,
  actions,
  isOwner,
  reducedMotion,
  onList,
  onEditZentrale,
}: {
  model: VillageModel;
  store: SceneStore;
  overlay: OverlayStore;
  actions: SceneActions;
  isOwner: boolean;
  reducedMotion: boolean;
  /** Liste öffnen und das Haus darin zeigen. */
  onList: (houseId: string) => void;
  /** Zentrale «bearbeiten» = Einstellungen › Dorf (Stil der Zentrale). */
  onEditZentrale: () => void;
}) {
  const nav = useScene(store, (s) => s.nav);
  const mode = useScene(store, (s) => s.tafel?.mode ?? null);
  const listW = useScene(store, (s) => s.listW);
  const building = useScene(store, (s) => s.building);
  const inv = useScene(store, (s) => s.inv);
  const sel = useOverlay(overlay, (s) => s.sel);
  const arrived = useOverlay(overlay, (s) => s.arrived);
  const { width, height } = useViewport();
  const firstTile = useRef<HTMLButtonElement>(null);

  const houseId = nav.level === "haus" ? nav.h : null;
  const house = houseId ? model.byId[houseId] : undefined;
  const lay = hudLayout({ width, height, listW, level: nav.level, tafel: mode !== null });
  const ready = !!house && arrived === houseId && !building && !inv;

  // Tastatur: nach der Ankunft (ohne Tafel) Fokus auf die erste Kachel, damit Tab die Aktionen erreicht
  useEffect(() => {
    if (ready && mode === null && document.activeElement === document.body)
      firstTile.current?.focus({ preventScroll: true });
  }, [ready, mode]);

  if (!ready || !house) return null;

  const zentrale = house.kind === "zentrale";
  const open = (m: TafelMode) => () =>
    mode === m ? actions.closeTafel() : actions.openTafel(house.id, m);
  const all: Tile[] = [
    {
      key: "open",
      label: "Öffnen",
      glyph: "↗",
      onClick: open("haus"),
      on: mode === "haus" || mode === "objekt",
      badge: house.items.length || undefined,
    },
    {
      key: "new",
      label: "Objekt",
      glyph: "+",
      onClick: open("neu"),
      on: mode === "neu" || mode === "objektedit",
      primary: true,
    },
    {
      key: "edit",
      label: "Bearbeiten",
      glyph: "✎",
      onClick: zentrale ? onEditZentrale : open("hausedit"),
      on: mode === "hausedit",
    },
    { key: "list", label: "Liste", glyph: "≡", onClick: () => onList(house.id), on: listW > 0 },
  ];
  const tiles = isOwner ? all : [all[0], all[3]];

  // Handy bzw. kein Platz um das Haus: Kacheln als Leiste unten (nur ohne Tafel)
  if (!lay.ring || !sel) {
    if (mode !== null) return null;
    return (
      <div
        role="toolbar"
        aria-label={`Aktionen für ${zentrale ? "die Zentrale" : house.title}`}
        className="hd-rise pointer-events-auto absolute left-1/2 flex -translate-x-1/2 gap-1.5"
        style={{ bottom: HUD.bottom + 8, marginLeft: listW / 2 }}
      >
        {tiles.map((t, i) => (
          <TileButton key={t.key} tile={t} ref={i === 0 ? firstTile : undefined} />
        ))}
      </div>
    );
  }

  const { sucher, tiles: pos } = sucherAround(sel);
  const slots = isOwner ? pos : [pos[0], pos[3]];
  const motion = !reducedMotion;
  const corner: CSSProperties = { position: "absolute", width: 26, height: 26 };
  const line = "2px solid var(--hd-accent-line)";
  const r = "var(--hd-radius-ctl)";

  return (
    <div
      role="toolbar"
      aria-label={`Aktionen für ${zentrale ? "die Zentrale" : house.title}`}
      className="pointer-events-none absolute inset-0"
    >
      <div
        aria-hidden
        className={motion ? "hd-sucher-in" : undefined}
        style={{
          position: "absolute",
          left: sucher.x,
          top: sucher.y,
          width: sucher.w,
          height: sucher.h,
        }}
      >
        <span
          style={{
            ...corner,
            left: 0,
            top: 0,
            borderLeft: line,
            borderTop: line,
            borderTopLeftRadius: r,
          }}
        />
        <span
          style={{
            ...corner,
            right: 0,
            top: 0,
            borderRight: line,
            borderTop: line,
            borderTopRightRadius: r,
          }}
        />
        <span
          style={{
            ...corner,
            right: 0,
            bottom: 0,
            borderRight: line,
            borderBottom: line,
            borderBottomRightRadius: r,
          }}
        />
        <span
          style={{
            ...corner,
            left: 0,
            bottom: 0,
            borderLeft: line,
            borderBottom: line,
            borderBottomLeftRadius: r,
          }}
        />
      </div>
      {tiles.map((t, i) => (
        <TileButton
          key={t.key}
          tile={t}
          ref={i === 0 ? firstTile : undefined}
          style={{
            position: "absolute",
            left: slots[i].x,
            top: slots[i].y,
            transform: "translate(-50%, -50%)",
            animationDelay: motion ? `${i * 60}ms` : undefined,
          }}
          pop={motion}
        />
      ))}
    </div>
  );
}

function TileButton({
  tile,
  style,
  pop,
  ref,
}: {
  tile: Tile;
  style?: CSSProperties;
  pop?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={tile.onClick}
      aria-pressed={tile.on}
      style={style}
      className={`hd-tile pointer-events-auto relative flex h-[72px] w-[86px] cursor-pointer flex-col items-center justify-center gap-[5px] border p-1.5 text-[11.5px] font-bold ${
        pop ? "hd-tile-in" : ""
      } ${
        tile.primary
          ? "border-hd-accent bg-hd-accent text-hd-accent-ink"
          : "border-hd-line bg-hd-surface text-hd-ink"
      }`}
    >
      <span
        aria-hidden
        className={`leading-none ${tile.primary ? "text-[24px]" : "text-[21px] text-hd-accent-text"}`}
      >
        {tile.glyph}
      </span>
      <span>{tile.label}</span>
      {tile.badge ? (
        <span
          aria-label={`${tile.badge} Objekte`}
          className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-hd-ink px-[5px] text-[11px] font-bold text-hd-surface"
        >
          {tile.badge}
        </span>
      ) : null}
    </button>
  );
}

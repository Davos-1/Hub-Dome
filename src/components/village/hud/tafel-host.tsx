"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { deleteArtifact, deleteHouse } from "@/app/dorf/actions";
import { Panel } from "@/components/ui/panel";
import { FACHBEREICHE } from "@/lib/fachbereiche";
import { ITEM_TYPE_LABELS } from "@/lib/item-types";
import { ARTIFACT_KIND_LABELS, type Artifact, type House, type ModuleOption } from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { HouseCreate } from "../../world/tafel/house-create";
import { HouseEdit } from "../../world/tafel/house-edit";
import { HouseGallery } from "../../world/tafel/house-gallery";
import { ObjectDetail } from "../../world/tafel/object-detail";
import { ObjectSteps } from "../../world/tafel/object-steps";
import { QuarterOverview } from "../../world/tafel/quarter-overview";
import { countText } from "../../world/tafel/shared";
import type { SceneActions } from "../scene-actions";
import { useScene, type SceneStore } from "../scene-store";
import { hudLayout } from "./layout";
import { useUi } from "./ui-context";
import { useViewport } from "./use-viewport";

const upper = (s: string) => s.toLocaleUpperCase("de-CH");

/**
 * Tafel am Ort (Phase 4h): neben dem gewählten Haus bzw. rechts angedockt (Lage aus `hudLayout`), auf dem Handy
 * ein Blatt unten. Nicht modal: Die Welt bleibt bedienbar; Esc schliesst (von innen nach aussen), der Fokus
 * kehrt zum Auslöser zurück. Löschen läuft verzögert mit «Rückgängig».
 */
export function TafelHost({
  model,
  store,
  actions,
  houses,
  artifacts,
  previews,
  isOwner,
  modules,
  onNewHouse,
}: {
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  houses: House[];
  artifacts: Artifact[];
  previews: Record<string, ReactNode>;
  isOwner: boolean;
  modules: ModuleOption[];
  /** Neues Haus angelegt: die Ansicht wählt es, sobald es in den Daten ist. */
  onNewHouse: (id: string) => void;
}) {
  const tafel = useScene(store, (s) => s.tafel);
  const nav = useScene(store, (s) => s.nav);
  const listW = useScene(store, (s) => s.listW);
  const building = useScene(store, (s) => s.building);
  const inv = useScene(store, (s) => s.inv);
  const { width, height } = useViewport();
  const ui = useUi();
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const modeKey = tafel ? `${tafel.mode}:${tafel.objId ?? ""}:${tafel.houseId ?? ""}` : null;

  // Fokus: beim Öffnen in die Tafel (Eingabefeld oder Kopf), beim Schliessen zurück zum Auslöser
  useEffect(() => {
    if (!modeKey) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && !ref.current?.contains(active)) opener.current = active;
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el;
    target?.focus({ preventScroll: true });
  }, [modeKey]);
  useEffect(() => {
    if (modeKey) return;
    const o = opener.current;
    opener.current = null;
    if (o?.isConnected) o.focus({ preventScroll: true });
  }, [modeKey]);

  if (!tafel || building || inv) return null;
  const lay = hudLayout({ width, height, listW, level: nav.level, tafel: true });
  if (!lay.tafel) return null;

  const houseId = tafel.houseId ?? (nav.level === "haus" ? nav.h : null);
  const house = houseId ? model.byId[houseId] : undefined;
  const raw = houseId ? houses.find((h) => h.id === houseId) : undefined;
  const mine = houseId ? artifacts.filter((a) => a.house_id === houseId) : [];
  const artifact = tafel.objId ? artifacts.find((a) => a.id === tafel.objId) : undefined;
  const houseName = house ? (house.kind === "zentrale" ? "Zentrale" : house.title) : "";

  const removeObject = (a: Artifact) => {
    actions.openTafel(a.house_id, "haus");
    ui.deferred(`«${a.title}» gelöscht`, [a.id], () => {
      const fd = new FormData();
      fd.set("id", a.id);
      void deleteArtifact({}, fd).then((r) => r.error && ui.say(r.error, { error: true }));
    });
  };
  const removeHouse = (h: House) => {
    const ids = [h.id, ...artifacts.filter((a) => a.house_id === h.id).map((a) => a.id)];
    actions.clearSelection();
    ui.deferred(`Haus «${h.title}» gelöscht`, ids, () => {
      const fd = new FormData();
      fd.set("id", h.id);
      void deleteHouse({}, fd).then((r) => r.error && ui.say(r.error, { error: true }));
    });
  };

  let kicker = "";
  let title: ReactNode = "";
  let sub: ReactNode = null;
  let body: ReactNode = null;
  switch (tafel.mode) {
    case "haus":
      if (!house) break;
      kicker =
        house.kind === "zentrale" ? "Zentrale" : `Haus · ${upper(FACHBEREICHE[house.fach].name)}`;
      title = houseName;
      sub = `${countText(house.items.length)}${house.semester ? ` · ${house.semester}. Semester` : ""}`;
      body = (
        <HouseGallery
          house={house}
          artifacts={mine}
          isOwner={isOwner}
          onObject={(id) => actions.openTafel(house.id, "objekt", id)}
          onAdd={() => actions.openTafel(house.id, "neu")}
          onEdit={() => actions.openTafel(house.id, "hausedit")}
        />
      );
      break;
    case "objekt":
      kicker = `Objekt · ${upper(houseName)}`;
      if (!artifact) {
        title = "Wird geladen …";
        break;
      }
      title = artifact.title;
      sub = `${ITEM_TYPE_LABELS[artifact.item_type]} · ${ARTIFACT_KIND_LABELS[artifact.kind]}`;
      body = (
        <ObjectDetail
          key={artifact.id}
          artifact={artifact}
          preview={previews[artifact.id]}
          isOwner={isOwner}
          onEdit={() => actions.openTafel(artifact.house_id, "objektedit", artifact.id)}
          onDelete={() => removeObject(artifact)}
        />
      );
      break;
    case "neu":
    case "objektedit": {
      const edit = tafel.mode === "objektedit";
      if (edit && !artifact) break;
      if (!house) break;
      kicker = edit ? "Objekt bearbeiten" : `Neues Objekt in ${upper(houseName)}`;
      title = edit ? artifact!.title : "Neues Objekt";
      sub = edit ? houseName : "Link einfügen, der Rest ist schnell gewählt";
      body = (
        <ObjectSteps
          key={`${tafel.mode}-${artifact?.id ?? house.id}`}
          artifact={edit ? artifact : undefined}
          houseId={house.id}
          houses={model.houses}
          onDelete={edit ? () => removeObject(artifact!) : undefined}
          onSaved={({ id, houseId: target, isNew }) => {
            const t = model.byId[target];
            ui.say(
              isNew
                ? `An ${t?.kind === "zentrale" ? "die Zentrale" : t?.title} gehängt`
                : "Gespeichert",
            );
            if (id) actions.openTafel(target, "objekt", id);
            else actions.openTafel(target, "haus");
          }}
        />
      );
      break;
    }
    case "hausedit":
      if (!raw || !house || raw.kind === "zentrale") break;
      kicker = "Haus bearbeiten";
      title = raw.title;
      sub = FACHBEREICHE[house.fach].name;
      body = (
        <HouseEdit
          key={raw.id}
          house={raw}
          objectCount={house.items.length}
          onDelete={() => removeHouse(raw)}
          onSaved={(moved) => {
            ui.say(moved ? `Haus zieht nach ${FACHBEREICHE[moved].name}` : "Haus gespeichert");
            // Die Kamera fliegt mit (neue Lage kommt mit den neuen Daten)
            actions.openTafel(raw.id, "haus");
          }}
        />
      );
      break;
    case "quartier": {
      if (nav.level !== "quartier") break;
      kicker = "Quartier";
      title = FACHBEREICHE[nav.q].name;
      const q = nav.q;
      body = (
        <QuarterOverview
          model={model}
          quarterId={q}
          isOwner={isOwner}
          onHouse={(id) => actions.openHouse(id)}
          onAddHouse={() => store.set({ tafel: { mode: "hausneu", houseId: q } })}
        />
      );
      break;
    }
    case "hausneu": {
      if (!isOwner) break;
      kicker = "Neu";
      title = "Haus anlegen";
      const preset = tafel.houseId && tafel.houseId in FACHBEREICHE ? tafel.houseId : undefined;
      body = (
        <HouseCreate
          modules={modules}
          usedCodes={new Set(houses.map((h) => h.module_code).filter((c): c is string => !!c))}
          presetQuarter={preset as keyof typeof FACHBEREICHE | undefined}
          onCreated={(id, name, quarter) => {
            ui.say(`Haus «${name}» angelegt · Baustelle in ${FACHBEREICHE[quarter].name}`);
            actions.closeTafel();
            if (id) onNewHouse(id);
          }}
        />
      );
      break;
    }
  }
  if (!title) return null;

  const t = lay.tafel;
  return (
    <Panel
      as="aside"
      panelRef={ref}
      role="dialog"
      kicker={kicker}
      title={title}
      sub={sub}
      onClose={actions.closeTafel}
      className="hd-rise pointer-events-auto absolute z-20"
      style={{
        left: t.x,
        top: t.y,
        width: t.w,
        maxHeight: t.h,
        ...(t.sheet ? { height: t.h } : {}),
        transition: "left .45s var(--hd-ease), top .45s var(--hd-ease)",
      }}
    >
      <div data-hd-tafel className="flex flex-1 flex-col">
        {body ?? <p className="px-5 pb-4 text-[13px] text-hd-muted">Wird geladen …</p>}
      </div>
    </Panel>
  );
}

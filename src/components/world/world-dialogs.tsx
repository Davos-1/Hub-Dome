"use client";

import type { ShellData } from "@/lib/shell-data";
import type { Artifact, House } from "@/lib/types";
import type { VillageModel } from "@/lib/village-model";
import { AddHouseDialog, AddObjectDialog, EditHouseDialog, EditObjectDialog } from "./add-dialogs";
import { SettingsDialog, type SettingsTab } from "./settings-dialog";
import { StartDialog } from "./start-dialog";
import { TravelDialog, type TravelTab } from "./travel-dialog";
import type { DialogApi, DialogId } from "./use-dialog";

/** Zeigt den Dialog, der laut URL offen ist. */
export function WorldDialogs({
  active,
  dialog,
  shell,
  model,
  houses,
  artifacts,
  isOwner,
  villageName,
  ownerUsername,
  lowDetail,
  onEnter,
}: {
  active: DialogId | null;
  dialog: DialogApi;
  shell: ShellData;
  model: VillageModel;
  houses: House[];
  artifacts: Artifact[];
  isOwner: boolean;
  villageName: string;
  ownerUsername: string;
  lowDetail: boolean;
  /** «Mein Dorf betreten»: Start-Dialog schliessen, Kamera fliegt ein. */
  onEnter: () => void;
}) {
  const houseOptions = model.houses.map((h) => ({
    id: h.id,
    title: h.kind === "zentrale" ? "Zentrale" : h.title,
  }));

  switch (active) {
    case "start":
      return (
        <StartDialog
          shell={shell}
          village={{
            name: villageName,
            houses: model.houses.filter((h) => h.kind !== "zentrale").length,
            objects: model.houses.reduce((n, h) => n + h.items.length, 0),
            fresh: model.houses.reduce((n, h) => n + h.newCount, 0),
          }}
          isOwner={isOwner}
          lowDetail={lowDetail}
          onEnter={onEnter}
          onTravel={() => dialog.open("reise")}
          onFriends={() => dialog.open("reise", { tab: "freunde" })}
          onSettings={() => dialog.open("einstellungen", { tab: "profil" })}
          onAddHouse={() => dialog.open("haus")}
        />
      );
    case "reise":
      return (
        <TravelDialog
          shell={shell}
          currentUsername={ownerUsername}
          tab={dialog.tab}
          onTab={(t: TravelTab) => dialog.setTab(t)}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "einstellungen":
      return (
        <SettingsDialog
          shell={shell}
          tab={dialog.tab}
          onTab={(t: SettingsTab) => dialog.setTab(t)}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "objekt":
      return (
        <AddObjectDialog
          houses={houseOptions}
          houseId={dialog.houseId}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "objektedit":
      return (
        <EditObjectDialog
          artifact={artifacts.find((a) => a.id === dialog.objectId)}
          houses={houseOptions}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "haus":
      return (
        <AddHouseDialog
          modules={shell.own?.modules ?? []}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "hausedit": {
      const house = houses.find((h) => h.id === dialog.houseId && h.kind !== "zentrale");
      return (
        <EditHouseDialog
          house={house}
          objectCount={artifacts.filter((a) => a.house_id === house?.id).length}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    }
    default:
      return null;
  }
}

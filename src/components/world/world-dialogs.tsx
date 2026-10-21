"use client";

import type { ShellData } from "@/lib/shell-data";
import type { VillageModel } from "@/lib/village-model";
import type { SceneActions } from "../village/scene-actions";
import type { SceneStore } from "../village/scene-store";
import { AddHouseDialog, AddObjectDialog } from "./add-dialogs";
import { InviteDialog } from "./invite-dialog";
import { SettingsDialog, type SettingsTab } from "./settings-dialog";
import { StartDialog } from "./start-dialog";
import { TravelDialog } from "./travel-dialog";
import type { DialogApi, DialogId } from "./use-dialog";

/** Zeigt den Dialog, der laut URL (oder Einladungslink) offen ist. */
export function WorldDialogs({
  active,
  dialog,
  inviteToken,
  shell,
  model,
  store,
  actions,
  isOwner,
  villageName,
  ownerUsername,
  lowDetail,
  onEnter,
}: {
  active: DialogId | null;
  dialog: DialogApi;
  inviteToken?: string;
  shell: ShellData;
  model: VillageModel;
  store: SceneStore;
  actions: SceneActions;
  isOwner: boolean;
  villageName: string;
  ownerUsername: string;
  lowDetail: boolean;
  /** «Mein Dorf betreten»: Start-Dialog schliessen, Kamera fliegt ein. */
  onEnter: () => void;
}) {
  const houses = model.houses.map((h) => ({
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
          onSettings={() => dialog.open("einstellungen", { tab: "profil" })}
          onAddHouse={() => dialog.open("haus")}
        />
      );
    case "reise":
      return (
        <TravelDialog
          shell={shell}
          currentUsername={ownerUsername}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "einstellungen":
      return (
        <SettingsDialog
          shell={shell}
          store={store}
          actions={actions}
          tab={dialog.tab}
          onTab={(t: SettingsTab) => dialog.setTab(t)}
          lowDetail={lowDetail}
          onClose={dialog.close}
        />
      );
    case "objekt":
      return (
        <AddObjectDialog
          houses={houses}
          houseId={dialog.houseId}
          ownerUsername={ownerUsername}
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
    case "einladung":
      return inviteToken ? <InviteDialog token={inviteToken} lowDetail={lowDetail} /> : null;
    default:
      return null;
  }
}

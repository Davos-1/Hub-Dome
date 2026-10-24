"use client";

import type { ShellData } from "@/lib/shell-data";
import type { VillageModel } from "@/lib/village-model";
import { FriendLinkDialog, type FriendLinkInfo } from "./friend-link-dialog";
import { SettingsDialog, type SettingsTab } from "./settings-dialog";
import { StartDialog } from "./start-dialog";
import { TravelDialog, type TravelTab } from "./travel-dialog";
import type { DialogApi, DialogId } from "./use-dialog";

/**
 * Zeigt den Dialog bzw. Bereich, der laut URL offen ist. Objekte und Häuser bearbeiten laufen seit Phase 4h über
 * Tafeln am Ort, die Liste ist eine Seitenleiste (alte Adressen leiten dorthin um, siehe `VillageView`).
 */
export function WorldDialogs({
  active,
  dialog,
  shell,
  friendLink,
  model,
  isOwner,
  villageName,
  ownerUsername,
  lowDetail,
  onEnter,
  onAddHouse,
  onPreviewSeed,
}: {
  /** «Welt neu würfeln»: Vorschau mit diesem Seed in der Szene zeigen. */
  onPreviewSeed: (seed: string) => void;
  active: DialogId | "freund" | null;
  dialog: DialogApi;
  shell: ShellData;
  friendLink?: FriendLinkInfo;
  model: VillageModel;
  isOwner: boolean;
  villageName: string;
  ownerUsername: string;
  lowDetail: boolean;
  /** «Mein Dorf betreten»: Start-Dialog schliessen, Kamera fliegt ein. */
  onEnter: () => void;
  /** «Haus anlegen» (Tafel am Ort). */
  onAddHouse: () => void;
}) {
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
          onAddHouse={onAddHouse}
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
          world={{
            model,
            isOwner,
            onPreview: (seed) => {
              dialog.close();
              onPreviewSeed(seed);
            },
          }}
        />
      );
    case "freund":
      return friendLink ? <FriendLinkDialog link={friendLink} lowDetail={lowDetail} /> : null;
    default:
      return null;
  }
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ShellData } from "@/lib/shell-data";
import { DialogShell, DialogTabs, resolveTab } from "./dialog-shell";
import { FriendsTab } from "./friends-tab";
import { VillagesTab } from "./villages-tab";

const TRAVEL_TABS = [
  ["doerfer", "Dörfer"],
  ["freunde", "Freunde"],
] as const;
export type TravelTab = (typeof TRAVEL_TABS)[number][0];

/** Reise und Freunde: Dörfer besuchen, Freundschaftsanfragen senden, annehmen und beenden. */
export function TravelDialog({
  shell,
  currentUsername,
  tab,
  onTab,
  lowDetail,
  onClose,
}: {
  shell: ShellData;
  currentUsername: string;
  tab: string | null;
  onTab: (t: TravelTab) => void;
  lowDetail: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const current = resolveTab(TRAVEL_TABS, tab);
  const requests = shell.friends.filter((f) => f.status === "eingehend").length;

  const go = (username: string) => {
    if (username === currentUsername) return onClose();
    setTarget(username);
    start(() => router.push(`/dorf/${username}`));
  };

  return (
    <DialogShell
      title="Reise und Freunde"
      kicker="Hub Dome · Reise"
      icon="reise"
      subtitle="Besuche die Dörfer deiner Freunde."
      onClose={onClose}
      lowDetail={lowDetail}
    >
      <DialogTabs
        label="Reise und Freunde"
        tabs={TRAVEL_TABS}
        current={current}
        onTab={onTab}
        badges={{ freunde: requests }}
        busy={pending}
      >
        {pending && target && (
          <p role="status" className="rounded-lg bg-[#e6efe9] px-3 py-2 text-[13px] text-[#2f5d4a]">
            Reise nach @{target}…
          </p>
        )}
        {current === "doerfer" ? (
          <VillagesTab
            shell={shell}
            currentUsername={currentUsername}
            onTravel={go}
            pending={pending}
            onFriends={() => onTab("freunde")}
          />
        ) : (
          <FriendsTab shell={shell} />
        )}
      </DialogTabs>
    </DialogShell>
  );
}

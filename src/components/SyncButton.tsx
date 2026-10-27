"use client";

import { useIsSyncing, useSync } from "@/lib/useSync";

export function SyncButton() {
  const { mutate } = useSync();
  const syncing = useIsSyncing();

  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={syncing}
      className="h-8 rounded-md bg-fg px-3 text-sm font-medium text-bg transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
    >
      {syncing ? "Sync 중…" : "Sync"}
    </button>
  );
}

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
      className="rounded-md border border-accent px-3 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
    >
      {syncing ? "Sync 중…" : "Sync"}
    </button>
  );
}

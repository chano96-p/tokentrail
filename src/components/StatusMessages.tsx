"use client";

import { useAppMode } from "@/app/providers";

// 결과 0건은 DB가 빈 경우와 필터 결과가 없는 경우 둘 다라, 프로젝트가 하나라도 있는지(hasAnyData)로 나눈다.
// demo 스냅샷에는 ImportedFile이 없을 수 있어 lastImportedAt으로는 판단하지 않는다.
export function EmptyState({ hasAnyData }: { hasAnyData: boolean }) {
  const mode = useAppMode();
  let message: React.ReactNode;
  if (hasAnyData) {
    message = "선택한 기간·필터에 해당하는 데이터가 없습니다.";
  } else if (mode === "local") {
    message = (
      <>
        아직 가져온 세션이 없습니다. 상단 Sync를 누르거나 터미널에서{" "}
        <code className="rounded bg-fill px-1 font-mono">pnpm run sync</code>를
        실행하세요.
      </>
    );
  } else {
    message = "표시할 데모 데이터가 없습니다.";
  }
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}

export function LoadError({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm">
      <p>데이터를 불러오지 못했습니다</p>
      <p className="mt-1 text-xs text-muted">{error?.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-8 rounded-md bg-fg px-3 text-bg hover:opacity-85"
      >
        다시 시도
      </button>
    </div>
  );
}

// 이미 보이던 데이터가 있을 때 다시 불러오기가 실패하면 화면은 그대로 두고 이 한 줄만 붙인다.
export function StaleNotice() {
  return (
    <p className="text-xs text-warn">
      최신 데이터를 불러오지 못해 이전 결과를 보여주고 있습니다.
    </p>
  );
}

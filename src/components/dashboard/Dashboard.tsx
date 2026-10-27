"use client";

import { useAppMode } from "@/app/providers";
import { FilterBar } from "@/components/FilterBar";
import { api, queryKeys } from "@/lib/api";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DailyTokensChart } from "./DailyTokensChart";
import { KpiCards } from "./KpiCards";
import { ModelShare } from "./ModelShare";
import { Panel } from "./Panel";
import { ProjectTokens } from "./ProjectTokens";
import { TopSessions } from "./TopSessions";

export function DashboardSkeleton() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-lg bg-line/60" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-line/60" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-lg bg-line/60" />
        <div className="h-48 rounded-lg bg-line/60" />
      </div>
    </div>
  );
}

function EmptyState({ hasAnyData }: { hasAnyData: boolean }) {
  const mode = useAppMode();
  let message: React.ReactNode;
  if (hasAnyData) {
    message = "선택한 기간·필터에 해당하는 데이터가 없습니다.";
  } else if (mode === "local") {
    message = (
      <>
        아직 가져온 세션이 없습니다. 상단 Sync를 누르거나 터미널에서{" "}
        <code className="rounded bg-accent-soft px-1 font-mono">
          pnpm run sync
        </code>
        를 실행하세요.
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

function DashboardBody() {
  const { values } = useUrlFilters();
  const filters = useQuery({
    queryKey: queryKeys.filters,
    queryFn: api.filters,
  });
  const overview = useQuery({
    queryKey: queryKeys.overview(values),
    queryFn: () => api.overview(values),
    // 필터를 바꾸는 동안 이전 숫자를 흐리게 남겨 화면이 비었다 채워지지 않게 한다.
    placeholderData: keepPreviousData,
  });

  if (overview.isPending) return <DashboardSkeleton />;
  // 이미 보이던 데이터가 있으면 다시 불러오기가 실패해도 화면을 지우지 않고 안내만 붙인다.
  const data = overview.data;
  if (!data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm">
        <p>데이터를 불러오지 못했습니다</p>
        <p className="mt-1 text-xs text-muted">{overview.error?.message}</p>
        <button
          type="button"
          onClick={() => overview.refetch()}
          className="mt-4 rounded-md border border-accent px-3 py-1 text-accent hover:bg-accent-soft"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // sessionCount 0은 DB가 빈 경우와 필터 결과가 없는 경우 둘 다라, 프로젝트가 하나라도 있는지로 나눈다.
  // demo 스냅샷에는 ImportedFile이 없을 수 있어 lastImportedAt으로는 판단하지 않는다.
  if (data.sessionCount === 0) {
    return <EmptyState hasAnyData={(filters.data?.projects.length ?? 0) > 0} />;
  }

  return (
    <div
      className={`grid gap-4 transition-opacity ${overview.isPlaceholderData ? "opacity-60" : ""}`}
    >
      {overview.isError && (
        <p className="text-xs text-warn">
          최신 데이터를 불러오지 못해 이전 결과를 보여주고 있습니다.
        </p>
      )}
      <KpiCards overview={data} />
      <Panel title="일별 토큰">
        <DailyTokensChart daily={data.daily} />
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="프로젝트별 토큰">
          <ProjectTokens byProject={data.byProject} />
        </Panel>
        <Panel title="모델별 토큰 비율">
          <ModelShare byModel={data.byModel} />
        </Panel>
      </div>
      <Panel title="토큰을 많이 쓴 세션">
        <TopSessions sessions={data.topSessions} />
      </Panel>
    </div>
  );
}

export function Dashboard() {
  return (
    <div className="grid gap-4">
      <FilterBar />
      <DashboardBody />
    </div>
  );
}

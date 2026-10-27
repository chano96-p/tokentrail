"use client";

import { FilterBar } from "@/components/FilterBar";
import {
  EmptyState,
  LoadError,
  StaleNotice,
} from "@/components/StatusMessages";
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
  const data = overview.data;
  if (!data) {
    return (
      <LoadError error={overview.error} onRetry={() => overview.refetch()} />
    );
  }

  if (data.sessionCount === 0) {
    return <EmptyState hasAnyData={(filters.data?.projects.length ?? 0) > 0} />;
  }

  return (
    <div
      className={`grid gap-4 transition-opacity ${overview.isPlaceholderData ? "opacity-60" : ""}`}
    >
      {overview.isError && <StaleNotice />}
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

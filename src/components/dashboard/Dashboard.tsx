"use client";

import { FilterBar } from "@/components/FilterBar";
import {
  EmptyState,
  LoadError,
  StaleNotice,
} from "@/components/StatusMessages";
import { api, queryKeys } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { useUrlFilters } from "@/lib/useUrlFilters";
import type { Overview } from "@/server/queries/overview";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DailyTokensChart } from "./DailyTokensChart";
import { Headline } from "./Headline";
import { Panel } from "./Panel";
import { ProjectTokens } from "./ProjectTokens";
import { SessionMap } from "./SessionMap";
import { TopSessions } from "./TopSessions";

export function DashboardSkeleton() {
  return (
    <div className="grid animate-pulse gap-10" aria-busy="true">
      <div className="grid gap-4 py-4 sm:py-8">
        <div className="h-4 w-48 rounded bg-line/60" />
        <div className="h-20 max-w-2xl rounded bg-line/60" />
        <div className="h-5 w-80 rounded bg-line/60" />
      </div>
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="h-96 rounded-lg bg-line/60 lg:col-span-2" />
        <div className="h-96 rounded-lg bg-line/60" />
      </div>
    </div>
  );
}

function share(part: number, whole: number): string {
  return formatPercent(part / Math.max(whole, 1));
}

function topSessionsSummary(data: Overview): string | undefined {
  const sessions = data.topSessions;
  if (sessions.length === 0) return undefined;
  // 세션별 합계는 복사된 호출을 세션마다 세서, 여러 세션을 더하면 중복 제거된 전체를 넘을 수 있다.
  return `가장 많이 쓴 세션 하나가 전체 토큰의 ${share(sessions[0].totalTokens, data.totalTokens)}를 썼습니다.`;
}

function projectsSummary(data: Overview): string | undefined {
  const top = data.byProject[0];
  if (!top) return undefined;
  return `가장 많이 쓴 프로젝트는 ${top.name}, 전체의 ${share(top.totalTokens, data.totalTokens)}입니다.`;
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
      className={`grid gap-10 transition-opacity ${overview.isPlaceholderData ? "opacity-60" : ""}`}
    >
      {overview.isError && <StaleNotice />}
      <Headline
        overview={data}
        map={
          <SessionMap
            days={data.daily.map((day) => day.date)}
            activity={data.activity}
            sessions={data.activitySessions}
          />
        }
      />
      <div className="grid gap-10 lg:grid-cols-3">
        <Panel title="일별 토큰" className="lg:col-span-2">
          <DailyTokensChart daily={data.daily} />
        </Panel>
        <Panel title="토큰을 많이 쓴 세션" summary={topSessionsSummary(data)}>
          <TopSessions sessions={data.topSessions} total={data.totalTokens} />
        </Panel>
      </div>
      <Panel title="프로젝트별 토큰" summary={projectsSummary(data)}>
        <ProjectTokens byProject={data.byProject} total={data.totalTokens} />
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

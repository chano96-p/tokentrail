"use client";

import { FilterBar } from "@/components/FilterBar";
import {
  EmptyState,
  LoadError,
  StaleNotice,
} from "@/components/StatusMessages";
import { addDays } from "@/core/time";
import { api, queryKeys } from "@/lib/api";
import { useUrlFilters } from "@/lib/useUrlFilters";
import type { Overview } from "@/server/queries/overview";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { DailyTokensChart } from "./DailyTokensChart";
import { KpiCards } from "./KpiCards";
import { ModelShare } from "./ModelShare";
import { Panel, PanelLink } from "./Panel";
import { ProjectTokens } from "./ProjectTokens";
import { RecentSessions } from "./RecentSessions";
import { SessionMap } from "./SessionMap";
import { TopSessions } from "./TopSessions";

export function DashboardSkeleton() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-line/60" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-96 rounded-2xl bg-line/60 lg:col-span-2" />
        <div className="h-96 rounded-2xl bg-line/60" />
      </div>
    </div>
  );
}

// 지금 보는 기간 바로 앞의 같은 길이 기간. 증감 비교용이라 프로젝트·모델 필터는 그대로 둔다.
function previousPeriodParams(
  data: Overview | undefined,
  values: Record<string, string>,
): Record<string, string> | null {
  const first = data?.daily[0]?.date;
  if (!first) return null;
  const length = data.daily.length;
  const params: Record<string, string> = {
    from: addDays(first, -length),
    to: addDays(first, -1),
  };
  if (values.project) params.project = values.project;
  if (values.model) params.model = values.model;
  return params;
}

// 세션 목록도 URL에서 기간·프로젝트·모델을 읽으므로, 카드에서 넘어갈 때 같은 필터를 넘겨야 같은 세션들이 보인다.
function sessionsHref(
  values: Record<string, string>,
  extra: Record<string, string> = {},
): string {
  const query = new URLSearchParams({ ...values, ...extra }).toString();
  return query ? `/sessions?${query}` : "/sessions";
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
  const prevParams = previousPeriodParams(overview.data, values);
  const previous = useQuery({
    // 비교 기간을 못 정할 때 overview({})를 키로 쓰면 필터 없는 기본 화면 캐시가 그대로 나와서 키를 따로 둔다.
    queryKey: ["overview-previous", prevParams],
    queryFn: prevParams ? () => api.overview(prevParams) : skipToken,
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
      <KpiCards overview={data} previous={previous.data} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="일별 토큰" className="lg:col-span-2">
          <DailyTokensChart daily={data.daily} />
        </Panel>
        <Panel
          title="토큰을 많이 쓴 세션"
          action={
            <PanelLink href={sessionsHref(values, { sort: "tokens" })}>
              전체 보기
            </PanelLink>
          }
        >
          <TopSessions sessions={data.topSessions} total={data.totalTokens} />
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="시간대별 활동" className="lg:col-span-2">
          <SessionMap
            days={data.daily.map((day) => day.date)}
            activity={data.activity}
            sessions={data.activitySessions}
          />
        </Panel>
        <Panel title="프로젝트별 토큰">
          <ProjectTokens byProject={data.byProject} total={data.totalTokens} />
          <div className="mt-6 grid gap-3 border-t border-line pt-5">
            <h3 className="text-sm font-medium">모델</h3>
            <ModelShare byModel={data.byModel} />
          </div>
        </Panel>
      </div>
      <Panel
        title="최근 세션"
        action={<PanelLink href={sessionsHref(values)}>전체 보기</PanelLink>}
      >
        <RecentSessions filters={values} />
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

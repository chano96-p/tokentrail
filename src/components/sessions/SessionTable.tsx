"use client";

import { useTimeZone } from "@/app/providers";
import {
  EmptyState,
  LoadError,
  StaleNotice,
} from "@/components/StatusMessages";
import { api, queryKeys } from "@/lib/api";
import { formatDateTime, formatDuration, formatTokens } from "@/lib/format";
import { useUrlFilters } from "@/lib/useUrlFilters";
import type { SessionListItem } from "@/server/queries/sessions";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import Link from "next/link";

const SORT_OPTIONS = [
  { value: "recent", label: "최신순" },
  { value: "tokens", label: "토큰순" },
];

export function SessionTableSkeleton() {
  return (
    <div
      className="h-112 animate-pulse rounded-2xl bg-line/60"
      aria-busy="true"
    />
  );
}

export function SortToggle() {
  const { values, set } = useUrlFilters();
  const active = values.sort === "tokens" ? "tokens" : "recent";
  return (
    <div
      role="group"
      aria-label="정렬"
      className="inline-flex h-8 gap-0.5 rounded-lg bg-fill p-0.5 text-sm"
    >
      {SORT_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={active === value}
          onClick={() => set({ sort: value === "recent" ? null : value })}
          className="rounded-md px-3 text-muted not-aria-pressed:hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-sm"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SessionRow({ session }: { session: SessionListItem }) {
  const timeZone = useTimeZone();
  return (
    // 행 전체를 누를 수 있게 제목 링크의 클릭 영역을 행 크기로 넓힌다(링크는 하나만 둬서 탭 순서를 단순하게).
    <tr className="relative border-b border-line last:border-0 hover:bg-fill/60">
      {/* 표 셀의 max-width는 브라우저마다 다르게 처리돼, 너비 제한과 말줄임은 셀 안쪽 요소에 건다. */}
      <td className="px-5 py-3">
        <Link
          href={`/sessions/${encodeURIComponent(session.id)}`}
          className="block max-w-80 truncate font-medium after:absolute after:inset-0"
        >
          {session.title ?? <span className="text-muted">제목 없음</span>}
        </Link>
      </td>
      <td className="px-3 py-3 text-muted">
        <div className="max-w-40 truncate">{session.projectName}</div>
      </td>
      <td className="px-3 py-3 font-mono text-xs text-muted">
        <div className="max-w-40 truncate">{session.gitBranch ?? "–"}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-muted tabular-nums">
        {formatDateTime(session.startedAt, timeZone)}
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap text-muted tabular-nums">
        {formatDuration(session.startedAt, session.endedAt)}
      </td>
      <td className="px-3 py-3 text-right font-medium tabular-nums">
        {formatTokens(session.totalTokens)}
      </td>
      <td className="px-5 py-3 text-right text-muted tabular-nums">
        {session.subagentCount > 0 ? session.subagentCount : "–"}
      </td>
    </tr>
  );
}

export function SessionTable() {
  const { values: urlValues } = useUrlFilters();
  // 커서는 pageParam으로만 넘긴다. 공유 링크 등으로 URL에 cursor가 있으면 첫 페이지가 중간부터 시작한다.
  const values = Object.fromEntries(
    Object.entries(urlValues).filter(([key]) => key !== "cursor"),
  );
  const filters = useQuery({
    queryKey: queryKeys.filters,
    queryFn: api.filters,
  });
  // 필터·정렬이 queryKey에 들어 있어, 바뀌면 커서를 버리고 첫 페이지부터 다시 읽는다.
  // 이전 커서를 새 필터에 쓰면 그 행이 빠져 있을 때 skip: 1이 정상 행을 건너뛸 수 있다.
  const sessions = useInfiniteQuery({
    queryKey: queryKeys.sessions(values),
    queryFn: ({ pageParam }) =>
      api.sessions(pageParam ? { ...values, cursor: pageParam } : values),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });

  if (sessions.isPending) return <SessionTableSkeleton />;
  const pages = sessions.data?.pages;
  if (!pages) {
    return (
      <LoadError error={sessions.error} onRetry={() => sessions.refetch()} />
    );
  }

  const items = pages.flatMap((page) => page.items);

  return (
    <div className="grid gap-4">
      {/* "더 보기" 실패는 이미 보인 목록과 상관없어 버튼 옆에 따로 안내한다. */}
      {sessions.isError && !sessions.isFetchNextPageError && <StaleNotice />}
      {items.length === 0 ? (
        <EmptyState hasAnyData={(filters.data?.projects.length ?? 0) > 0} />
      ) : (
        <div
          className={`overflow-x-auto rounded-2xl border border-line bg-surface transition-opacity ${sessions.isPlaceholderData ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-normal">제목</th>
                <th className="px-3 py-3 font-normal">프로젝트</th>
                <th className="px-3 py-3 font-normal">브랜치</th>
                <th className="px-3 py-3 font-normal">시작</th>
                <th className="px-3 py-3 text-right font-normal">소요</th>
                <th className="px-3 py-3 text-right font-normal">토큰</th>
                <th className="px-5 py-3 text-right font-normal">
                  <abbr title="서브에이전트" className="no-underline">
                    서브
                  </abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sessions.isFetchNextPageError && (
        <p className="text-center text-xs text-warn">
          다음 목록을 불러오지 못했습니다. 다시 눌러 주세요.
        </p>
      )}
      {sessions.hasNextPage && (
        <button
          type="button"
          onClick={() => sessions.fetchNextPage()}
          disabled={sessions.isFetchingNextPage}
          className="mx-auto h-9 rounded-lg border border-line bg-surface px-4 text-sm text-muted hover:bg-fill hover:text-fg disabled:opacity-60"
        >
          {sessions.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
        </button>
      )}
    </div>
  );
}

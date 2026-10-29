"use client";

import { useTimeZone } from "@/app/providers";
import { api, queryKeys } from "@/lib/api";
import { formatDateTime, formatTokens } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const RECENT_LIMIT = "5";

export function RecentSessions({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const timeZone = useTimeZone();
  const params = { ...filters, limit: RECENT_LIMIT };
  const sessions = useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => api.sessions(params),
  });

  if (sessions.isPending) {
    return <div className="h-48 animate-pulse rounded-lg bg-fill" />;
  }
  if (sessions.isError) {
    return (
      <p className="text-sm text-warn">최근 세션을 불러오지 못했습니다.</p>
    );
  }
  const items = sessions.data.items;
  if (items.length === 0) {
    return <p className="text-sm text-muted">이 기간에는 세션이 없습니다.</p>;
  }
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-5 pb-2 font-normal sm:px-6">제목</th>
            <th className="px-3 pb-2 font-normal">프로젝트</th>
            <th className="px-3 pb-2 font-normal">시작</th>
            <th className="px-5 pb-2 text-right font-normal sm:px-6">토큰</th>
          </tr>
        </thead>
        <tbody>
          {items.map((session) => (
            <tr
              key={session.id}
              className="relative border-b border-line last:border-0 hover:bg-fill/60"
            >
              <td className="px-5 py-3 sm:px-6">
                <Link
                  href={`/sessions/${encodeURIComponent(session.id)}`}
                  className="block max-w-96 truncate font-medium after:absolute after:inset-0"
                >
                  {session.title ?? (
                    <span className="text-muted">제목 없음</span>
                  )}
                </Link>
              </td>
              <td className="px-3 py-3 text-muted">
                <div className="max-w-48 truncate">{session.projectName}</div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-muted tabular-nums">
                {formatDateTime(session.startedAt, timeZone)}
              </td>
              <td className="px-5 py-3 text-right font-medium tabular-nums sm:px-6">
                {formatTokens(session.totalTokens)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

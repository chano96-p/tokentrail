import { formatPercent, formatTokens } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";
import Link from "next/link";

export function TopSessions({
  sessions,
  total,
}: {
  sessions: Overview["topSessions"];
  total: number;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted">이 기간에는 세션이 없습니다.</p>;
  }
  const max = Math.max(sessions[0].totalTokens, 1);
  return (
    <ol className="grid gap-1">
      {sessions.map((session, index) => (
        <li key={session.id}>
          <Link
            href={`/sessions/${encodeURIComponent(session.id)}`}
            className="-mx-3 grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 rounded-lg px-3 py-3 hover:bg-surface focus-visible:bg-surface"
          >
            <span className="text-sm text-muted tabular-nums">{index + 1}</span>
            <span className="truncate font-medium">
              {session.title ?? "제목 없음"}
            </span>
            <span className="text-right font-medium tabular-nums">
              {formatTokens(session.totalTokens)}
            </span>
            <span className="col-start-2 truncate text-xs text-muted">
              {session.projectName}
            </span>
            <span className="text-right text-xs text-muted tabular-nums">
              {formatPercent(session.totalTokens / Math.max(total, 1))}
            </span>
            <span className="col-span-2 col-start-2 mt-1 h-1 rounded-full bg-fill">
              <span
                className="block h-full rounded-full bg-fg"
                style={{ width: `${(session.totalTokens / max) * 100}%` }}
              />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

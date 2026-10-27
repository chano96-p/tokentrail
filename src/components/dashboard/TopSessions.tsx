import { formatTokens } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";
import Link from "next/link";

export function TopSessions({
  sessions,
}: {
  sessions: Overview["topSessions"];
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted">이 기간에는 세션이 없습니다.</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/sessions/${encodeURIComponent(session.id)}`}
            className="flex items-baseline gap-3 py-2 hover:text-accent"
          >
            <span className="min-w-0 flex-1 truncate">
              {session.title ?? "제목 없음"}
            </span>
            <span className="max-w-[40%] shrink-0 truncate text-xs text-muted">
              {session.projectName}
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">
              {formatTokens(session.totalTokens)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

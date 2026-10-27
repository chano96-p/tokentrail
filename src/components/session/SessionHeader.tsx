"use client";

import { useTimeZone } from "@/app/providers";
import {
  formatDateTime,
  formatDuration,
  formatTokens,
  formatUsd,
} from "@/lib/format";
import type { SessionDetail } from "@/server/queries/sessionDetail";
import Link from "next/link";

const TOKEN_PARTS = [
  { key: "inputTokens", label: "input", color: "var(--tok-in)" },
  { key: "outputTokens", label: "output", color: "var(--tok-out)" },
  { key: "cacheReadTokens", label: "cache read", color: "var(--tok-cr)" },
  { key: "cacheWriteTokens", label: "cache write", color: "var(--tok-cw)" },
] as const;

export function SessionHeader({
  session,
}: {
  session: SessionDetail["session"];
}) {
  const timeZone = useTimeZone();
  const meta = [
    session.projectName,
    session.gitBranch,
    formatDateTime(session.startedAt, timeZone),
    formatDuration(session.startedAt, session.endedAt),
    `${formatTokens(session.totalTokens)} tokens`,
    `≈ ${formatUsd(session.estimatedCostUsd)}`,
  ].filter(Boolean);

  return (
    <header className="grid gap-2">
      <Link href="/sessions" className="text-xs text-muted hover:text-fg">
        ← 세션 목록
      </Link>
      <h1 className="text-xl font-semibold break-words">
        {session.title ?? <span className="text-muted">제목 없음</span>}
      </h1>
      <p className="text-sm text-muted">{meta.join(" · ")}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {TOKEN_PARTS.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <i
              aria-hidden="true"
              className="inline-block size-2 rounded-sm"
              style={{ background: part.color }}
            />
            {part.label}
            <span className="text-fg tabular-nums">
              {formatTokens(session[part.key])}
            </span>
          </li>
        ))}
        {session.subagentCount > 0 && (
          <li>서브에이전트 {session.subagentCount}개</li>
        )}
      </ul>
      {session.unpricedModels.length > 0 && (
        <p className="text-xs text-warn">
          단가 없음(비용에서 제외): {session.unpricedModels.join(", ")}
        </p>
      )}
    </header>
  );
}

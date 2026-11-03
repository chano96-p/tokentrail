"use client";

import { useTimeZone } from "@/app/providers";
import { Panel } from "@/components/dashboard/Panel";
import {
  formatDateTime,
  formatDuration,
  formatPercent,
  formatTokens,
  formatUsd,
} from "@/lib/format";
import type { SessionDetail } from "@/server/queries/sessionDetail";
import Link from "next/link";

// 대시보드 차트 범례와 같은 순서(위에서 아래로 output → cache read)라 두 화면에서 색 위치가 같다.
const TOKEN_PARTS = [
  { key: "outputTokens", label: "output", color: "var(--tok-out)" },
  { key: "inputTokens", label: "input", color: "var(--tok-in)" },
  { key: "cacheWriteTokens", label: "cache write", color: "var(--tok-cw)" },
  { key: "cacheReadTokens", label: "cache read", color: "var(--tok-cr)" },
] as const;

type Session = SessionDetail["session"];

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

// cache read가 대부분이라 비율 막대 하나로는 나머지가 보이지 않아, 종류별 값과 비율을 줄마다 적는다.
function TokenBreakdown({ session }: { session: Session }) {
  const total = Math.max(session.totalTokens, 1);
  return (
    <ul className="grid gap-3">
      {TOKEN_PARTS.map((part) => (
        <li
          key={part.key}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto_2.75rem] items-center gap-2.5 text-sm"
        >
          <i
            aria-hidden="true"
            className="size-2.5 rounded-xs"
            style={{ background: part.color }}
          />
          <span className="text-muted">{part.label}</span>
          <span className="font-medium tabular-nums">
            {formatTokens(session[part.key])}
          </span>
          <span className="text-right text-xs text-muted tabular-nums">
            {formatPercent(session[part.key] / total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SessionHeader({
  session,
  turnCount,
}: {
  session: Session;
  turnCount: number;
}) {
  const timeZone = useTimeZone();

  return (
    <div className="grid gap-4">
      <Link href="/sessions" className="w-fit text-sm text-muted hover:text-fg">
        ← 세션 목록
      </Link>
      <div className="grid gap-4 lg:grid-cols-3">
        <header className="grid content-between gap-6 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:col-span-2">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight wrap-break-word">
              {session.title ?? <span className="text-muted">제목 없음</span>}
            </h1>
            <p className="text-sm text-muted">{session.projectName}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
            <Stat label="총 토큰" value={formatTokens(session.totalTokens)} />
            <Stat
              label="API 단가로 환산"
              value={`≈ ${formatUsd(session.estimatedCostUsd)}`}
            />
            <Stat label="턴" value={`${turnCount}개`} />
            <Stat
              label="시작"
              value={formatDateTime(session.startedAt, timeZone)}
            />
            <Stat
              label="소요"
              value={formatDuration(session.startedAt, session.endedAt)}
            />
            <Stat
              label="브랜치"
              value={
                <span
                  className="font-mono text-xs"
                  title={session.gitBranch ?? undefined}
                >
                  {session.gitBranch ?? "–"}
                </span>
              }
            />
          </dl>
          {(session.subagentCount > 0 || session.unpricedModels.length > 0) && (
            <div className="grid gap-1 text-xs">
              {session.subagentCount > 0 && (
                <p className="text-muted">
                  서브에이전트 {session.subagentCount}개가 함께 실행됐습니다.
                </p>
              )}
              {session.unpricedModels.length > 0 && (
                <p className="text-warn">
                  단가가 없어 비용에서 빠진 모델:{" "}
                  {session.unpricedModels.join(", ")}
                </p>
              )}
            </div>
          )}
        </header>
        <Panel title="토큰 구성">
          <TokenBreakdown session={session} />
        </Panel>
      </div>
    </div>
  );
}

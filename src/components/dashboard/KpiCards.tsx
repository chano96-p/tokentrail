import {
  CoinIcon,
  LayersIcon,
  SparkIcon,
  TerminalIcon,
} from "@/components/icons";
import { formatPercent, formatTokens, formatUsd } from "@/lib/format";
import type { DailyTokens, Overview } from "@/server/queries/overview";

const DAYS_PER_MONTH = 30;

// cache read가 전체의 대부분이라 총 토큰 하나로는 실제로 새로 처리한 양이 보이지 않아, 신규 처리분과 캐시 재사용분을 나눈다.
function freshTokensOf(daily: DailyTokens[]): number {
  return daily.reduce(
    (sum, d) => sum + d.inputTokens + d.outputTokens + d.cacheWriteTokens,
    0,
  );
}

function cacheReadTokensOf(daily: DailyTokens[]): number {
  return daily.reduce((sum, d) => sum + d.cacheReadTokens, 0);
}

// 토큰이 늘었다고 좋거나 나쁜 게 아니라서 증감에 상태 색(초록·빨강)을 쓰지 않고 화살표만 붙인다.
function Delta({
  current,
  previous,
  days,
}: {
  current: number;
  previous: number | undefined;
  days: number;
}) {
  if (previous === undefined) return <span className="h-5" />;
  if (previous === 0) {
    return <span className="text-xs opacity-70">이전 {days}일 기록 없음</span>;
  }
  const ratio = (current - previous) / previous;
  const arrow = ratio > 0 ? "↑" : ratio < 0 ? "↓" : "";
  return (
    <span className="text-xs tabular-nums">
      <span className="font-medium">
        {arrow && `${arrow} `}
        {formatPercent(Math.abs(ratio))}
      </span>
      <span className="opacity-70"> 이전 {days}일 대비</span>
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  delta,
  note,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: React.ReactNode;
  note?: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 rounded-2xl border p-4 sm:p-5 ${
        primary ? "border-fg bg-fg text-bg" : "border-line bg-surface text-fg"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid size-8 place-items-center rounded-lg ${
            primary ? "bg-bg/15" : "bg-fill"
          }`}
        >
          {icon}
        </span>
        <span
          className={`text-sm break-keep ${primary ? "opacity-80" : "text-muted"}`}
        >
          {label}
        </span>
      </div>
      <div className="grid gap-1">
        <span className="text-2xl leading-none sm:text-[28px] font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {delta}
        {note && (
          <span className={`text-xs ${primary ? "opacity-70" : "text-muted"}`}>
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

export function KpiCards({
  overview,
  previous,
}: {
  overview: Overview;
  previous: Overview | undefined;
}) {
  const days = overview.daily.length;
  // 월 구독료를 조회 기간 길이만큼으로 환산해, 같은 기간 API로 썼다면 몇 배였는지 본다.
  const subscriptionForPeriod =
    (overview.subscriptionMonthlyUsd * days) / DAYS_PER_MONTH;
  // 설정 파일에 구독료를 0으로 두면 배수를 낼 수 없다(env 값만 loadConfig에서 검증한다).
  const multiple =
    subscriptionForPeriod > 0
      ? overview.estimatedCostUsd / subscriptionForPeriod
      : null;
  // Claude Code가 직접 만든 <synthetic> 메시지처럼 토큰이 0인 모델은 단가가 없어도 비용에 영향이 없다.
  const unpricedWithTokens = overview.unpricedModels.filter((model) =>
    overview.byModel.some((m) => m.model === model && m.totalTokens > 0),
  );

  const fresh = freshTokensOf(overview.daily);
  const cacheRead = cacheReadTokensOf(overview.daily);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Kpi
        primary
        icon={<SparkIcon className="size-4.5" />}
        label="새로 처리한 토큰"
        value={formatTokens(fresh)}
        delta={
          <Delta
            current={fresh}
            previous={previous && freshTokensOf(previous.daily)}
            days={days}
          />
        }
        note="cache write + input + output"
      />
      <Kpi
        icon={<LayersIcon className="size-4.5" />}
        label="캐시에서 읽은 토큰"
        value={formatTokens(cacheRead)}
        delta={
          <Delta
            current={cacheRead}
            previous={previous && cacheReadTokensOf(previous.daily)}
            days={days}
          />
        }
      />
      <Kpi
        icon={<CoinIcon className="size-4.5" />}
        label="API 단가로 환산"
        value={`≈ ${formatUsd(overview.estimatedCostUsd)}`}
        delta={
          <Delta
            current={overview.estimatedCostUsd}
            previous={previous?.estimatedCostUsd}
            days={days}
          />
        }
        note={
          <>
            {multiple !== null && (
              <>같은 기간 구독료의 {multiple.toFixed(1)}배</>
            )}
            {unpricedWithTokens.length > 0 && (
              <span className="block text-warn">
                단가가 없어 빠진 모델: {unpricedWithTokens.join(", ")}
              </span>
            )}
          </>
        }
      />
      <Kpi
        icon={<TerminalIcon className="size-4.5" />}
        label="세션"
        value={`${overview.sessionCount.toLocaleString()}개`}
        delta={
          <Delta
            current={overview.sessionCount}
            previous={previous?.sessionCount}
            days={days}
          />
        }
        note={`${days}일 중 ${overview.activeDays}일 작업`}
      />
    </div>
  );
}

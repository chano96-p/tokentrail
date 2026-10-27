import { formatTokens, formatUsd } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";

const DAYS_PER_MONTH = 30;

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 rounded-lg border border-line bg-surface px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

export function KpiCards({ overview }: { overview: Overview }) {
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

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="총 토큰" value={formatTokens(overview.totalTokens)} />
      <Kpi label="세션" value={overview.sessionCount.toLocaleString()} />
      <Kpi label="활동일" value={`${overview.activeDays} / ${days}`} />
      <Kpi
        label="API 환산"
        value={`≈ ${formatUsd(overview.estimatedCostUsd)}`}
        note={
          <>
            {multiple !== null && <>구독료 대비 {multiple.toFixed(1)}배</>}
            {unpricedWithTokens.length > 0 && (
              <span className="block text-warn">
                단가 없음: {unpricedWithTokens.join(", ")}
              </span>
            )}
          </>
        }
      />
    </div>
  );
}

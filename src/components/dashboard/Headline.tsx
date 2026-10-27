import { formatDateKeyShort, formatTokens, formatUsd } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";
import { ModelShare } from "./ModelShare";

const DAYS_PER_MONTH = 30;

function Figure({ children }: { children: React.ReactNode }) {
  return <span className="text-fg tabular-nums">{children}</span>;
}

// 카드 대신 한 문장으로 기간 요약을 적는다. cache read가 전체의 대부분이라 총 토큰 하나로는
// 실제로 새로 처리한 양이 보이지 않으므로, 신규 처리분과 캐시 재사용분을 나눠 말한다.
export function Headline({
  overview,
  map,
}: {
  overview: Overview;
  map: React.ReactNode;
}) {
  const { daily } = overview;
  const days = daily.length;
  const freshTokens = daily.reduce(
    (sum, d) => sum + d.inputTokens + d.outputTokens + d.cacheWriteTokens,
    0,
  );
  const cacheReadTokens = daily.reduce((sum, d) => sum + d.cacheReadTokens, 0);

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
    <section className="grid gap-5 py-4 break-keep sm:py-8">
      {days > 0 && (
        <p className="text-sm text-muted">
          {formatDateKeyShort(daily[0].date)}부터{" "}
          {formatDateKeyShort(daily[days - 1].date)}까지 {days}일 중{" "}
          {overview.activeDays}일 작업
        </p>
      )}
      {map}
      <h1 className="mt-4 max-w-[40ch] text-2xl leading-[1.3] font-medium tracking-[-0.03em] text-balance sm:text-3xl">
        <Figure>{overview.sessionCount.toLocaleString()}개</Figure> 세션에서
        새로 처리한 토큰은 <Figure>{formatTokens(freshTokens)}</Figure>,
        캐시에서 다시 읽은 토큰은{" "}
        <Figure>{formatTokens(cacheReadTokens)}</Figure>
        입니다.
      </h1>
      <p className="text-base text-muted sm:text-lg">
        API 단가로 치면{" "}
        <Figure>≈ {formatUsd(overview.estimatedCostUsd)}</Figure>
        {multiple !== null && (
          <>
            , 같은 기간 구독료의 <Figure>{multiple.toFixed(1)}배</Figure>
          </>
        )}
        입니다.
        {unpricedWithTokens.length > 0 && (
          <span className="mt-1 block text-sm text-warn">
            단가가 없어 비용에서 빠진 모델: {unpricedWithTokens.join(", ")}
          </span>
        )}
      </p>
      <ModelShare byModel={overview.byModel} />
    </section>
  );
}

import { formatPercent, formatTokens } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";
import { RankedBars } from "./Panel";

// 계획의 도넛 대신 가로 막대를 쓴다. 모델 수가 늘면 도넛 조각은 각도로 비교하기 어렵고,
// 모델마다 색을 새로 붙이면 토큰 4종 색과 의미가 겹친다.
export function ModelShare({ byModel }: { byModel: Overview["byModel"] }) {
  const models = byModel.filter((m) => m.totalTokens > 0);
  if (models.length === 0) {
    return <p className="text-sm text-muted">이 기간에는 데이터가 없습니다.</p>;
  }
  const total = models.reduce((sum, m) => sum + m.totalTokens, 0);
  return (
    <RankedBars
      rows={models.map((m) => ({
        key: m.model,
        label: <span className="font-mono text-xs">{m.model}</span>,
        value: m.totalTokens,
      }))}
      formatValue={(value) =>
        `${formatPercent(value / total)} · ${formatTokens(value)}`
      }
    />
  );
}

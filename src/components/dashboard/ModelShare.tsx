import { formatTokens } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";
import { RankedBars } from "./Panel";

// 모델마다 색을 붙이면 토큰 4종 색과 의미가 겹치므로, 프로젝트 막대와 같은 글자색 막대로 보여준다.
export function ModelShare({ byModel }: { byModel: Overview["byModel"] }) {
  const models = byModel.filter((m) => m.totalTokens > 0);
  if (models.length === 0) return null;
  const total = models.reduce((sum, m) => sum + m.totalTokens, 0);
  return (
    <RankedBars
      rows={models.map((m) => ({
        key: m.model,
        label: m.model,
        value: m.totalTokens,
      }))}
      formatValue={formatTokens}
      total={total}
    />
  );
}

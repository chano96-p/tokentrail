import { formatPercent, formatTokens } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";

// 모델은 보통 한두 개에 몰려 있어 패널 하나를 채우지 못한다. 헤드라인 아래 한 줄로 줄이고,
// 모델마다 색을 붙이면 토큰 4종 색과 의미가 겹치므로 막대는 글자색 한 색만 쓴다.
export function ModelShare({ byModel }: { byModel: Overview["byModel"] }) {
  const models = byModel.filter((m) => m.totalTokens > 0);
  if (models.length === 0) return null;
  const total = models.reduce((sum, m) => sum + m.totalTokens, 0);
  return (
    <ul
      aria-label="모델별 토큰 비율"
      className="flex flex-wrap gap-x-6 gap-y-2 text-sm"
    >
      {models.map((m) => {
        const ratio = m.totalTokens / total;
        return (
          <li
            key={m.model}
            className="flex items-center gap-2"
            title={`${m.model} ${formatTokens(m.totalTokens)}`}
          >
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-fill">
              <span
                className="block h-full rounded-full bg-fg"
                style={{ width: `${Math.max(ratio * 100, 2)}%` }}
              />
            </span>
            <span>{m.model}</span>
            <span className="text-muted tabular-nums">
              {formatPercent(ratio)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

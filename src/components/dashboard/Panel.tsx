import { formatPercent } from "@/lib/format";

// summary는 섹션의 결론 한 문장. 목록을 다 읽기 전에 무엇을 봐야 하는지 먼저 말해 준다.
export function Panel({
  title,
  summary,
  children,
  className = "",
}: {
  title: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="mb-5 grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {summary && <p className="text-sm text-muted">{summary}</p>}
      </div>
      {children}
    </section>
  );
}

// 한 계열을 값 큰 순으로 보여주는 가로 막대. 값과 이름을 막대 옆에 직접 적어 범례·hover 없이 읽힌다.
// 막대 길이는 1위 대비, 비율은 기간 전체(total) 대비라 둘을 함께 적는다.
export function RankedBars({
  rows,
  formatValue,
  total,
  className = "",
}: {
  rows: { key: string; label: React.ReactNode; value: number }[];
  formatValue: (value: number) => string;
  total: number;
  className?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className={`gap-x-12 ${className}`}>
      {rows.map((row) => (
        <li key={row.key} className="mb-4 grid break-inside-avoid gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="text-sm font-medium">
                {formatValue(row.value)}
              </span>
              <span className="w-10 text-right text-xs text-muted">
                {formatPercent(row.value / Math.max(total, 1))}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-fill">
            <div
              className="h-2 rounded-full bg-fg"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

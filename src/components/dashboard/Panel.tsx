import { formatPercent } from "@/lib/format";
import Link from "next/link";

// 대시보드의 카드 한 장. action은 제목 오른쪽(예: 전체 보기 링크), description은 제목 아래 한 줄 설명.
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="grid gap-0.5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {/* 같은 줄 카드끼리 높이가 맞춰질 때 남는 높이를 내용이 받도록 한다(예: 활동 지도가 늘어남). */}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function PanelLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:bg-fill hover:text-fg"
    >
      {children}
    </Link>
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
    <ul className={className}>
      {rows.map((row) => (
        <li
          key={row.key}
          className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-1.5"
        >
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

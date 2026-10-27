export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-line bg-surface p-4 ${className}`}
    >
      <h2 className="mb-3 text-sm font-medium text-muted">{title}</h2>
      {children}
    </section>
  );
}

// 한 계열을 값 큰 순으로 보여주는 가로 막대. 값과 이름을 막대 옆에 직접 적어 범례·hover 없이 읽힌다.
export function RankedBars({
  rows,
  formatValue,
}: {
  rows: { key: string; label: React.ReactNode; value: number }[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
              {formatValue(row.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-accent-soft">
            <div
              className="h-2 rounded-full bg-accent"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

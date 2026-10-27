"use client";

import { formatDateKeyShort, formatTokens } from "@/lib/format";
import type { DailyTokens } from "@/server/queries/overview";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

// 아래에서 위로 쌓는 순서. 맞닿는 색끼리 구분되도록 globals.css의 색과 함께 정했다.
const SERIES = [
  { key: "cacheReadTokens", label: "cache read", color: "var(--tok-cr)" },
  { key: "cacheWriteTokens", label: "cache write", color: "var(--tok-cw)" },
  { key: "inputTokens", label: "input", color: "var(--tok-in)" },
  { key: "outputTokens", label: "output", color: "var(--tok-out)" },
] as const;

function DailyTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload as DailyTokens;
  const total = SERIES.reduce((sum, s) => sum + day[s.key], 0);
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">
        {formatDateKeyShort(String(label))} · {formatTokens(total)}
      </div>
      {[...SERIES].reverse().map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <i
              className="inline-block size-2 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
          <span className="font-mono tabular-nums">
            {formatTokens(day[s.key])}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DailyTokensChart({ daily }: { daily: DailyTokens[] }) {
  return (
    <div>
      <div
        className="h-64"
        role="img"
        aria-label={`일별 토큰 누적 막대, ${daily.length}일 합계 ${formatTokens(
          daily.reduce(
            (sum, day) => sum + SERIES.reduce((s, x) => s + day[x.key], 0),
            0,
          ),
        )}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={daily}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateKeyShort}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis
              tickFormatter={formatTokens}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={DailyTooltip}
              cursor={{ fill: "var(--accent-soft)" }}
            />
            {SERIES.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="tokens"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={1}
                radius={index === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <i
              className="inline-block size-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

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

// cache read가 하루 토큰의 대부분이라 한 막대에 쌓으면 나머지 세 종류가 보이지 않는다.
// 같은 날짜 축을 공유하는 두 차트로 나누고, 각 차트는 자기 y축 하나만 쓴다.
const FRESH_SERIES = SERIES.slice(1);
const CACHE_SERIES = SERIES.slice(0, 1);

const Y_AXIS_WIDTH = 44;
const SYNC_ID = "daily-tokens";

function dayTotal(day: DailyTokens): number {
  return SERIES.reduce((sum, s) => sum + day[s.key], 0);
}

function DailyTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload as DailyTokens;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">
        {formatDateKeyShort(String(label))} 합계 {formatTokens(dayTotal(day))}
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
          <span className="tabular-nums">{formatTokens(day[s.key])}</span>
        </div>
      ))}
    </div>
  );
}

const axisTick = {
  fill: "var(--muted)",
  fontSize: 11,
  fontFeatureSettings: "'tnum'",
};

function Layer({
  daily,
  series,
  showXAxis,
  showTooltip,
}: {
  daily: DailyTokens[];
  series: readonly (typeof SERIES)[number][];
  showXAxis: boolean;
  showTooltip: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={daily}
        syncId={SYNC_ID}
        margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="date"
          hide={!showXAxis}
          tickFormatter={formatDateKeyShort}
          tick={axisTick}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
          minTickGap={8}
        />
        <YAxis
          tickFormatter={formatTokens}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={Y_AXIS_WIDTH}
          tickCount={showXAxis ? 2 : 3}
        />
        {/* 툴팁은 위 차트에만 띄우고, 아래 차트는 같은 날짜에 커서만 맞춘다. */}
        <Tooltip
          content={showTooltip ? DailyTooltip : () => null}
          cursor={{ fill: "var(--fill)" }}
        />
        {/* 조각 사이 2px 배경색 간격. output↔cache read처럼 색각 이상에서 가까운 쌍을 경계로 구분한다. */}
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="tokens"
            fill={s.color}
            stroke="var(--bg)"
            strokeWidth={2}
            radius={index === series.length - 1 ? [3, 3, 0, 0] : 0}
            maxBarSize={22}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyTokensChart({ daily }: { daily: DailyTokens[] }) {
  const total = daily.reduce((sum, day) => sum + dayTotal(day), 0);
  return (
    <div
      role="img"
      aria-label={`일별 토큰 막대, ${daily.length}일 합계 ${formatTokens(total)}. 위는 새로 처리한 토큰, 아래는 캐시에서 읽은 토큰`}
    >
      <p className="mb-1 text-xs text-muted">
        새로 처리한 토큰 (cache write + input + output)
      </p>
      <div className="h-56">
        <Layer
          daily={daily}
          series={FRESH_SERIES}
          showXAxis={false}
          showTooltip
        />
      </div>
      <p className="mt-4 mb-1 text-xs text-muted">캐시에서 읽은 토큰</p>
      <div className="h-24">
        <Layer
          daily={daily}
          series={CACHE_SERIES}
          showXAxis
          showTooltip={false}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {[...SERIES].reverse().map((s) => (
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

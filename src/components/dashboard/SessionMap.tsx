"use client";

import { formatDateKeyShort, formatTokens } from "@/lib/format";
import type { ActivityCell, Overview } from "@/server/queries/overview";
import Link from "next/link";
import { useMemo, useState } from "react";

const HOURS_PER_DAY = 24;
const HOUR_MARKS = [0, 6, 12, 18, 24];
// 한 색(글자색)의 진하기 4단계. 가장 옅은 단계도 배경과 구분되게 0.2부터 시작한다.
const LEVEL_OPACITY = [0.2, 0.42, 0.66, 0.9];

type ActivitySession = Overview["activitySessions"][number];

function cellKey(cell: Pick<ActivityCell, "date" | "hour">): string {
  return `${cell.date}|${cell.hour}`;
}

// 호출 수는 한두 시간에 몰리는 경우가 많아, 그대로 비례시키면 나머지 칸이 모두 옅은 단계에 몰린다.
// 제곱근으로 펴서 적게 일한 시간대도 단계가 나뉘게 한다.
function levelOf(calls: number, maxCalls: number): number {
  const ratio = Math.sqrt(calls / Math.max(maxCalls, 1));
  return Math.min(
    LEVEL_OPACITY.length - 1,
    Math.floor(ratio * LEVEL_OPACITY.length),
  );
}

function isWeekend(dayKey: string): boolean {
  const day = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function Readout({
  cell,
  session,
}: {
  cell: ActivityCell | undefined;
  session: ActivitySession | undefined;
}) {
  if (!cell) return <p className="h-5" />;
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-sm">
      <span className="text-muted tabular-nums">
        {formatDateKeyShort(cell.date)} {cell.hour}시
      </span>
      <span className="tabular-nums">호출 {cell.calls.toLocaleString()}회</span>
      <span className="tabular-nums">{formatTokens(cell.tokens)} 토큰</span>
      <span className="min-w-0 truncate font-medium">
        {session?.title ?? "제목 없음"}
      </span>
      {session?.projectName && (
        <span className="text-muted">{session.projectName}</span>
      )}
    </p>
  );
}

function Legend() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      적음
      {LEVEL_OPACITY.map((opacity) => (
        <i
          key={opacity}
          aria-hidden="true"
          className="inline-block size-2.5 rounded-xs bg-fg"
          style={{ opacity }}
        />
      ))}
      많음
    </span>
  );
}

// 세션 시작 시각이 아니라 실제 API 호출 시각으로 칸을 칠해, 며칠에 걸쳐 이어 쓴 세션도
// 일한 시간대마다 나타난다.
export function SessionMap({
  days,
  activity,
  sessions,
}: {
  days: string[];
  activity: ActivityCell[];
  sessions: ActivitySession[];
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const cellsByDay = useMemo(() => {
    const map = new Map<string, ActivityCell[]>();
    for (const cell of activity) {
      map.set(cell.date, [...(map.get(cell.date) ?? []), cell]);
    }
    return map;
  }, [activity]);
  const sessionById = useMemo(
    () => new Map(sessions.map((s) => [s.id, s])),
    [sessions],
  );
  const maxCalls = Math.max(0, ...activity.map((cell) => cell.calls));

  // 아무것도 가리키지 않을 때는 호출이 가장 많았던 칸을 보여 준다.
  const busiest = activity.reduce<ActivityCell | undefined>(
    (best, cell) => (!best || cell.calls > best.calls ? cell : best),
    undefined,
  );
  const active =
    activity.find((cell) => cellKey(cell) === activeKey) ?? busiest;

  // 기간 길이와 관계없이 라벨이 7개 안팎이 되게 해, 직접 선택으로 긴 기간을 골라도 겹치지 않게 한다.
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  return (
    <figure className="flex flex-1 flex-col gap-3">
      <div className="grid min-h-72 flex-1 grid-cols-[2.25rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-2 sm:min-h-96">
        <div className="relative text-[11px] text-muted tabular-nums">
          {HOUR_MARKS.map((hour) => (
            <span
              key={hour}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(hour / HOURS_PER_DAY) * 100}%` }}
            >
              {hour}시
            </span>
          ))}
        </div>
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          onMouseLeave={() => setActiveKey(null)}
        >
          {HOUR_MARKS.slice(1, -1).map((hour) => (
            <div
              key={hour}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t border-line"
              style={{ top: `${(hour / HOURS_PER_DAY) * 100}%` }}
            />
          ))}
          {days.map((dayKey) => (
            <div
              key={dayKey}
              className={`relative border-y border-line ${isWeekend(dayKey) ? "bg-fill/70" : ""}`}
            >
              {(cellsByDay.get(dayKey) ?? []).map((cell) => {
                const key = cellKey(cell);
                const isActive = activeKey === key;
                const session = sessionById.get(cell.topSessionId);
                return (
                  <Link
                    key={key}
                    href={`/sessions/${encodeURIComponent(cell.topSessionId)}`}
                    aria-label={`${formatDateKeyShort(cell.date)} ${cell.hour}시, 호출 ${cell.calls}회, ${formatTokens(cell.tokens)} 토큰, 대표 세션 ${session?.title ?? "제목 없음"}`}
                    onMouseEnter={() => setActiveKey(key)}
                    onFocus={() => setActiveKey(key)}
                    onBlur={() => setActiveKey(null)}
                    className={`absolute inset-x-px rounded-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg ${isActive ? "z-10 ring-2 ring-fg" : ""}`}
                    style={{
                      // 위아래 1px씩 비워 이웃한 칸끼리 붙어 보이지 않게 한다.
                      top: `calc(${(cell.hour / HOURS_PER_DAY) * 100}% + 1px)`,
                      height: `calc(${100 / HOURS_PER_DAY}% - 2px)`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xs bg-fg"
                      style={{
                        opacity: LEVEL_OPACITY[levelOf(cell.calls, maxCalls)],
                      }}
                    />
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div />
        <div
          className="grid pt-2 text-[11px] text-muted tabular-nums"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        >
          {days.map((dayKey, index) => (
            <span key={dayKey} className="text-center">
              {(days.length - 1 - index) % labelEvery === 0
                ? formatDateKeyShort(dayKey)
                : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="grid gap-1 pl-11">
        <Readout
          cell={active}
          session={active && sessionById.get(active.topSessionId)}
        />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            칸 하나가 한 시간입니다. 진할수록 API 호출이 많았고, 누르면 그
            시간에 토큰을 가장 많이 쓴 세션으로 갑니다.
          </span>
          <Legend />
        </p>
      </figcaption>
    </figure>
  );
}

"use client";

import { useTimeZone } from "@/app/providers";
import { addDays, startOfDayInZone, toDateKey } from "@/core/time";
import { api } from "@/lib/api";
import { formatDateKeyShort, formatDateTime, formatTokens } from "@/lib/format";
import type { SessionListItem } from "@/server/queries/sessions";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE_LIMIT = "50";
const HOUR_MARKS = [0, 6, 12, 18, 24];
const MIN_DOT_PX = 6;
const MAX_DOT_PX = 30;

type Dot = {
  session: SessionListItem;
  dayKey: string;
  top: number;
  size: number;
};

// 세션 목록 API는 페이지당 최대 50개라, 지도에는 기간 안의 세션 전부가 필요해 커서를 끝까지 따라간다.
async function fetchAllSessions(
  params: Record<string, string>,
): Promise<SessionListItem[]> {
  const items: SessionListItem[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.sessions({
      ...params,
      limit: PAGE_LIMIT,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

// 세션을 시작 시각 한 점으로 찍는다. endedAt은 마지막 기록 시각이라 며칠 뒤 이어서 쓴 세션은 수백 시간이 되어,
// 길이로 그리면 실제 작업 시간처럼 오해된다. 점 면적이 토큰에 비례하도록 지름은 제곱근으로 키운다.
function toDots(
  sessions: SessionListItem[],
  days: string[],
  timeZone: string,
): Dot[] {
  const daySet = new Set(days);
  const maxTokens = Math.max(...sessions.map((s) => s.totalTokens), 1);
  const dots: Dot[] = [];
  for (const session of sessions) {
    const started = new Date(session.startedAt);
    const dayKey = toDateKey(started, timeZone);
    if (!daySet.has(dayKey)) continue;
    const dayStart = startOfDayInZone(dayKey, timeZone).getTime();
    const dayEnd = startOfDayInZone(addDays(dayKey, 1), timeZone).getTime();
    dots.push({
      session,
      dayKey,
      top: ((started.getTime() - dayStart) / (dayEnd - dayStart)) * 100,
      size:
        MIN_DOT_PX +
        (MAX_DOT_PX - MIN_DOT_PX) * Math.sqrt(session.totalTokens / maxTokens),
    });
  }
  // 큰 점을 먼저 그려 작은 점이 위에 올라와 가려지지 않게 한다.
  return dots.sort((a, b) => b.size - a.size);
}

function isWeekend(dayKey: string): boolean {
  const day = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function Readout({ session }: { session: SessionListItem | undefined }) {
  const timeZone = useTimeZone();
  if (!session) return <p className="h-5" />;
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-sm">
      <span className="truncate font-medium">
        {session.title ?? "제목 없음"}
      </span>
      <span className="text-muted">{session.projectName}</span>
      <span className="text-muted tabular-nums">
        {formatDateTime(session.startedAt, timeZone)} 시작
      </span>
      <span className="tabular-nums">{formatTokens(session.totalTokens)}</span>
    </p>
  );
}

export function SessionMap({
  days,
  filters,
}: {
  days: string[];
  filters: Record<string, string>;
}) {
  const timeZone = useTimeZone();
  const params = useMemo(() => {
    const { range, from, to, project, model } = filters;
    return Object.fromEntries(
      Object.entries({ range, from, to, project, model }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    );
  }, [filters]);
  const sessions = useQuery({
    queryKey: ["sessionMap", params],
    queryFn: () => fetchAllSessions(params),
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const dots = useMemo(
    () => toDots(sessions.data ?? [], days, timeZone),
    [sessions.data, days, timeZone],
  );
  const dotsByDay = useMemo(() => {
    const map = new Map<string, Dot[]>();
    for (const dot of dots) {
      map.set(dot.dayKey, [...(map.get(dot.dayKey) ?? []), dot]);
    }
    return map;
  }, [dots]);

  // 아무것도 가리키지 않을 때는 토큰을 가장 많이 쓴 세션을 보여 준다.
  const largest = sessions.data?.reduce<SessionListItem | undefined>(
    (best, s) => (!best || s.totalTokens > best.totalTokens ? s : best),
    undefined,
  );
  const active =
    sessions.data?.find((s) => s.id === activeId) ?? largest ?? undefined;

  // 기간 길이와 관계없이 라벨이 7개 안팎이 되게 해, 직접 선택으로 긴 기간을 골라도 겹치지 않게 한다.
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  if (sessions.isError) {
    return (
      <p className="text-sm text-warn">
        세션 지도를 불러오지 못했습니다. 페이지를 새로 고치거나 Sync 후 다시
        확인하세요.
      </p>
    );
  }

  return (
    <figure className="grid gap-3">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
        <div className="relative h-72 text-[11px] text-muted tabular-nums sm:h-96">
          {HOUR_MARKS.map((hour) => (
            <span
              key={hour}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(hour / 24) * 100}%` }}
            >
              {hour}시
            </span>
          ))}
        </div>
        <div
          className="relative grid h-72 sm:h-96"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          onMouseLeave={() => setActiveId(null)}
          aria-busy={sessions.isPending}
        >
          {HOUR_MARKS.slice(1, -1).map((hour) => (
            <div
              key={hour}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t border-line"
              style={{ top: `${(hour / 24) * 100}%` }}
            />
          ))}
          {days.map((dayKey) => (
            <div
              key={dayKey}
              className={`relative border-y border-line ${isWeekend(dayKey) ? "bg-fill/70" : ""}`}
            >
              {(dotsByDay.get(dayKey) ?? []).map((dot) => {
                const { session } = dot;
                const isActive = activeId === session.id;
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${encodeURIComponent(session.id)}`}
                    aria-label={`${session.title ?? "제목 없음"}, ${formatTokens(session.totalTokens)} 토큰`}
                    onMouseEnter={() => setActiveId(session.id)}
                    onFocus={() => setActiveId(session.id)}
                    onBlur={() => setActiveId(null)}
                    className={`absolute left-1/2 aspect-square max-w-full -translate-1/2 rounded-full bg-fg ring-2 ring-bg transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg ${
                      activeId && !isActive ? "opacity-20" : "opacity-80"
                    } ${isActive ? "z-10 opacity-100" : ""}`}
                    style={{ top: `${dot.top}%`, width: dot.size }}
                  />
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
        <Readout session={active} />
        <p className="text-xs text-muted">
          점 하나가 세션 하나입니다. 위치는 시작 시각, 크기는 쓴 토큰입니다.
        </p>
      </figcaption>
    </figure>
  );
}

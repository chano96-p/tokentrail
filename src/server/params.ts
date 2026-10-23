import {
  addDays,
  endOfDayInZone,
  startOfDayInZone,
  toDateKey,
} from "@/core/time";
import type { OverviewParams } from "./queries/overview";
import type { SessionListParams } from "./queries/sessions";

const DAYS_BY_RANGE: Partial<Record<string, number>> = { "7d": 7, "30d": 30 };
const DEFAULT_RANGE_DAYS = 7;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 2026-02-31처럼 형식은 맞아도 없는 날짜는 Date.UTC가 다음 달로 넘기므로, 하루 더하기 0이 제자리인지로 거른다.
function isDateKey(value: string | null): value is string {
  return (
    value !== null &&
    DATE_KEY_PATTERN.test(value) &&
    addDays(value, 0) === value
  );
}

// from·to가 둘 다 올바른 날짜면 그 날짜들의 하루 시작·끝, 아니면 range(기본 7d)로 오늘 포함 N일.
// 잘못된 값은 sort·limit처럼 기본값으로 대체한다.
function parseDateRange(
  sp: URLSearchParams,
  now: Date,
  timeZone: string,
): { from: Date; to: Date } {
  const fromKey = sp.get("from");
  const toKey = sp.get("to");
  if (isDateKey(fromKey) && isDateKey(toKey)) {
    return {
      from: startOfDayInZone(fromKey, timeZone),
      to: endOfDayInZone(toKey, timeZone),
    };
  }

  const days = DAYS_BY_RANGE[sp.get("range") ?? ""] ?? DEFAULT_RANGE_DAYS;
  const todayKey = toDateKey(now, timeZone);
  return {
    from: startOfDayInZone(addDays(todayKey, -(days - 1)), timeZone),
    to: now,
  };
}

export function parseOverviewParams(
  sp: URLSearchParams,
  now: Date,
  timeZone: string,
): OverviewParams {
  return {
    ...parseDateRange(sp, now, timeZone),
    projectId: sp.get("project") ?? undefined,
    model: sp.get("model") ?? undefined,
  };
}

export function parseSessionListParams(
  sp: URLSearchParams,
  now: Date,
  timeZone: string,
): SessionListParams {
  const limit = Number(sp.get("limit"));
  return {
    ...parseDateRange(sp, now, timeZone),
    projectId: sp.get("project") ?? undefined,
    model: sp.get("model") ?? undefined,
    // 모르는 값은 기본값 recent로
    sort: sp.get("sort") === "tokens" ? "tokens" : "recent",
    cursor: sp.get("cursor") ?? undefined,
    limit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
  };
}

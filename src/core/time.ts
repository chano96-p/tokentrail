// import·집계에서 API 호출마다 불리므로 타임존별 formatter를 재사용한다.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const hourFormatters = new Map<string, Intl.DateTimeFormat>();

// 'YYYY-MM-DD'
export function toDateKey(d: Date, timeZone: string): string {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter.format(d);
}

// 0~23. h23이 없으면 엔진에 따라 자정이 24로 나온다.
export function toHourInZone(d: Date, timeZone: string): number {
  let formatter = hourFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    });
    hourFormatters.set(timeZone, formatter);
  }
  return Number(formatter.format(d));
}

// 양 끝 포함
export function dateKeysBetween(
  from: Date,
  to: Date,
  timeZone: string,
): string[] {
  const startKey = toDateKey(from, timeZone);
  const endKey = toDateKey(to, timeZone);

  const [y, m, d] = startKey.split("-").map(Number);

  const keys: string[] = [];
  for (let i = 0; ; i++) {
    const key = toDateKey(new Date(Date.UTC(y, m - 1, d + i)), "UTC");
    if (key > endKey) break;
    keys.push(key);
  }

  return keys;
}

// 그 순간 timeZone의 시계가 보여 주는 숫자를 UTC 시각인 것처럼 읽은 값(ms)
function wallClockAsUtc(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23", // 자정을 "24"가 아니라 "00"으로
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

// 'YYYY-MM-DD'에 날짜를 더한다. 음수면 이전 날짜. 월·연 경계는 Date.UTC가 넘겨 준다.
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toDateKey(new Date(Date.UTC(y, m - 1, d + days)), "UTC");
}

// dateKey('YYYY-MM-DD')의 timeZone 기준 0시
export function startOfDayInZone(dateKey: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guessMs = Date.UTC(y, m - 1, d);
  const firstMs =
    guessMs - (wallClockAsUtc(new Date(guessMs), timeZone) - guessMs);
  // 서머타임 전환일에는 guess 시점과 실제 0시의 오프셋이 달라 한 번 더 보정한다.
  // 0시가 아예 없는 날(전환이 자정)은 보정 결과가 전날로 넘어가므로 첫 값을 쓴다.
  const secondMs =
    guessMs - (wallClockAsUtc(new Date(firstMs), timeZone) - firstMs);
  return new Date(
    toDateKey(new Date(secondMs), timeZone) === dateKey ? secondMs : firstMs,
  );
}

// dateKey의 timeZone 기준 23:59:59.999. API의 to는 lte로 비교하므로 마지막 1ms까지 포함한다.
export function endOfDayInZone(dateKey: string, timeZone: string): Date {
  const nextDateKey = addDays(dateKey, 1);
  return new Date(startOfDayInZone(nextDateKey, timeZone).getTime() - 1);
}

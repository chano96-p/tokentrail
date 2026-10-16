// import·집계에서 API 호출마다 불리므로 타임존별 formatter를 재사용한다.
const formatters = new Map<string, Intl.DateTimeFormat>();

// 'YYYY-MM-DD'
export function toDateKey(d: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter.format(d);
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

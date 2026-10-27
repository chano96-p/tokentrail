const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// 1234567 → "1.2M"
export function formatTokens(value: number): string {
  return compactNumber.format(value);
}

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en", { maximumFractionDigits: value < 10 ? 2 : 0 })}`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;
}

const relativeTime = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

// "3분 전", "어제"
export function formatRelative(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= unitMs) {
      return relativeTime.format(Math.round(diffMs / unitMs), unit);
    }
  }
  return "방금";
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

// "10.23 14:05" (timeZone 기준)
export function formatDateTime(iso: string, timeZone: string): string {
  let formatter = dateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    dateTimeFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

// "1h 05m", "12m", "<1m"
export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.floor(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

// "2026-10-23" → "10.23"
export function formatDateKeyShort(dateKey: string): string {
  return dateKey.slice(5).replace("-", ".");
}

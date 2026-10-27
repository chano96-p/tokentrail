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

// "2026-10-23" → "10.23"
export function formatDateKeyShort(dateKey: string): string {
  return dateKey.slice(5).replace("-", ".");
}

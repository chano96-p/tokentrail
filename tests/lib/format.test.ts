import { formatDateTime, formatDuration } from "@/lib/format";
import { expect, test } from "vitest";

test("formatDuration은 분·시간 경계를 나눠 표시한다", () => {
  const start = "2026-10-12T00:00:00Z";
  expect(formatDuration(start, "2026-10-12T00:00:30Z")).toBe("<1m");
  expect(formatDuration(start, "2026-10-12T00:59:59Z")).toBe("59m");
  expect(formatDuration(start, "2026-10-12T01:00:00Z")).toBe("1h 00m");
  expect(formatDuration(start, "2026-10-13T01:05:00Z")).toBe("25h 05m");
});

test("formatDateTime은 지정 timezone 기준으로 날짜가 넘어간다", () => {
  // UTC로는 10/11 23:30, 서울은 10/12 08:30
  expect(formatDateTime("2026-10-11T23:30:00Z", "Asia/Seoul")).toBe(
    "10.12 08:30",
  );
  // 자정은 "24"가 아니라 "00"
  expect(formatDateTime("2026-10-11T15:00:00Z", "Asia/Seoul")).toBe(
    "10.12 00:00",
  );
});

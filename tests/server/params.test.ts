import { parseOverviewParams, parseSessionListParams } from "@/server/params";
import { expect, test } from "vitest";

test("range=7d는 오늘 포함 7일", () => {
  const p = parseOverviewParams(
    new URLSearchParams("range=7d"),
    new Date("2026-10-12T03:00:00Z"),
    "Asia/Seoul",
  );
  expect(p.from.toISOString()).toBe("2026-10-05T15:00:00.000Z");
  expect(p.to.toISOString()).toBe("2026-10-12T03:00:00.000Z");
});

test("from/to가 range보다 우선", () => {
  const p = parseOverviewParams(
    new URLSearchParams("range=30d&from=2026-10-01&to=2026-10-02"),
    new Date("2026-10-12T03:00:00Z"),
    "Asia/Seoul",
  );
  expect([p.from.toISOString(), p.to.toISOString()]).toEqual([
    "2026-09-30T15:00:00.000Z",
    "2026-10-02T14:59:59.999Z",
  ]);
});

test("parseSessionListParams는 모르는 sort·limit을 기본값으로", () => {
  const p = parseSessionListParams(
    new URLSearchParams("sort=abc&limit=xyz&range=30d"),
    new Date("2026-10-12T03:00:00Z"),
    "Asia/Seoul",
  );
  expect(p.sort).toBe("recent");
  expect(p.limit).toBeUndefined();
  expect(p.from!.toISOString()).toBe("2026-09-12T15:00:00.000Z");
});

test("from/to가 형식이 틀리거나 없는 날짜면 기본 range(7일)로", () => {
  const now = new Date("2026-10-12T03:00:00Z");
  for (const query of [
    "from=abc&to=xyz",
    "from=2026-10&to=2026-10-02",
    "from=2026-02-31&to=2026-02-31",
    "from=2026-10-01",
  ]) {
    const p = parseOverviewParams(
      new URLSearchParams(query),
      now,
      "Asia/Seoul",
    );
    expect(p.from.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-12T03:00:00.000Z");
  }
});

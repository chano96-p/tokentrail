import {
  dateKeysBetween,
  endOfDayInZone,
  startOfDayInZone,
  toDateKey,
} from "@/core/time";
import { expect, test } from "vitest";

test("toDateKey는 지정 TZ 기준", () => {
  expect(toDateKey(new Date("2026-10-11T16:30:00Z"), "Asia/Seoul")).toBe(
    "2026-10-12",
  );
  expect(toDateKey(new Date("2026-10-11T16:30:00Z"), "UTC")).toBe("2026-10-11");
});

test("dateKeysBetween은 양 끝 포함", () => {
  expect(
    dateKeysBetween(
      new Date("2026-10-10T00:00:00+09:00"),
      new Date("2026-10-12T23:59:59+09:00"),
      "Asia/Seoul",
    ),
  ).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
});

test("dateKeysBetween 경계", () => {
  const tz = "Asia/Seoul";
  const d = new Date("2026-10-10T12:00:00+09:00");
  expect(dateKeysBetween(d, d, tz)).toEqual(["2026-10-10"]);
  expect(dateKeysBetween(new Date("2026-10-12T00:00:00+09:00"), d, tz)).toEqual(
    [],
  );
  expect(
    dateKeysBetween(
      new Date("2026-12-31T00:00:00+09:00"),
      new Date("2027-01-01T00:00:00+09:00"),
      tz,
    ),
  ).toEqual(["2026-12-31", "2027-01-01"]);
});

test("dateKeysBetween은 서머타임 전환일도 하루씩 센다", () => {
  expect(
    dateKeysBetween(
      new Date("2026-03-07T12:00:00-05:00"),
      new Date("2026-03-09T12:00:00-04:00"),
      "America/New_York",
    ),
  ).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
});

test("startOfDayInZone·endOfDayInZone은 그 시간대의 하루 시작·끝", () => {
  expect(startOfDayInZone("2026-10-06", "Asia/Seoul").toISOString()).toBe(
    "2026-10-05T15:00:00.000Z",
  );
  expect(endOfDayInZone("2026-12-31", "Asia/Seoul").toISOString()).toBe(
    "2026-12-31T14:59:59.999Z",
  );
});

test("startOfDayInZone은 서머타임 전환일에도 현지 0시", () => {
  // 시드니: 10/4 서머타임 시작(+10 → +11), 4/5 종료(+11 → +10)
  expect(startOfDayInZone("2026-10-04", "Australia/Sydney").toISOString()).toBe(
    "2026-10-03T14:00:00.000Z",
  );
  expect(startOfDayInZone("2026-04-05", "Australia/Sydney").toISOString()).toBe(
    "2026-04-04T13:00:00.000Z",
  );
});

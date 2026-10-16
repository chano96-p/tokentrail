import { estimateCostUsd, totalTokens } from "@/core/pricing";
import { expect, test } from "vitest";

const pricing = {
  "claude-a": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6,
  },
  "claude-a-long": {
    input: 1,
    output: 1,
    cacheRead: 1,
    cacheWrite5m: 1,
    cacheWrite1h: 1,
  },
};

const M = 1_000_000;

test("백만 토큰 단가로 계산한다", () => {
  expect(
    estimateCostUsd(
      {
        inputTokens: M,
        outputTokens: M,
        cacheReadTokens: M,
        cacheWrite5mTokens: M,
        cacheWrite1hTokens: M,
      },
      "claude-a-2026",
      pricing,
    ),
  ).toBeCloseTo(28.05);
});

test("가장 긴 접두사가 이긴다", () => {
  expect(
    estimateCostUsd(
      {
        inputTokens: M,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
      },
      "claude-a-long-1",
      pricing,
    ),
  ).toBeCloseTo(1);
});

test("단가 없는 모델은 null", () => {
  expect(
    estimateCostUsd(
      {
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
      },
      "<synthetic>",
      pricing,
    ),
  ).toBeNull();
});

test("totalTokens는 다섯 값을 모두 더한다", () => {
  expect(
    totalTokens({
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheWrite5mTokens: 4,
      cacheWrite1hTokens: 5,
    }),
  ).toBe(15);
});

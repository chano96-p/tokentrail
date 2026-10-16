import type { DashboardConfig } from "@/core/config";

export const config: DashboardConfig = {
  timezone: "Asia/Seoul",
  subscriptionMonthlyUsd: 10,
  autoSyncOnLoad: false,
  // Anthropic 공식 요금 페이지(Model pricing), 2026-10-16 기준. USD / 1M tokens.
  // 접두사가 겹치는 모델(opus-5 / opus-5-5, fable-5 / fable-5-1, sonnet-5 / sonnet-5-5)은 단가가 달라 모두 둔다.
  // Haiku 5.5는 프롬프트 크기별 단가라 이 구조로 표현할 수 없어 뺐다(단가 없음으로 표시됨).
  pricing: {
    "claude-fable-5-1": {
      input: 10,
      output: 50,
      cacheRead: 0.25,
      cacheWrite5m: 12.5,
      cacheWrite1h: 20,
    },
    "claude-fable-5": {
      input: 10,
      output: 50,
      cacheRead: 1,
      cacheWrite5m: 12.5,
      cacheWrite1h: 20,
    },
    "claude-opus-5-5": {
      input: 4,
      output: 20,
      cacheRead: 0.2,
      cacheWrite5m: 5,
      cacheWrite1h: 8,
    },
    "claude-opus-5": {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
    },
    "claude-opus-4-8": {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
    },
    "claude-sonnet-5-5": {
      input: 2,
      output: 10,
      cacheRead: 0.1,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4,
    },
    "claude-sonnet-5": {
      input: 2,
      output: 10,
      cacheRead: 0.2,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4,
    },
    "claude-haiku-4-5": {
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheWrite5m: 1.25,
      cacheWrite1h: 2,
    },
  },
  demo: {
    projects: [],
    aliases: {},
  },
};

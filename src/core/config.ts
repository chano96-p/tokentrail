import { config } from "../../dashboard.config";

export type Rates = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}; // USD / 1M tokens

export type DashboardConfig = {
  timezone: string;
  subscriptionMonthlyUsd: number;
  autoSyncOnLoad: boolean;
  pricing: Record<string, Rates>; // key = 모델 id 접두사
  demo: { projects: string[]; aliases: Record<string, string> }; // cwd 목록, cwd → 별칭
};

export function loadConfig(): DashboardConfig {
  const raw = process.env.SUBSCRIPTION_MONTHLY_USD?.trim();
  if (!raw) {
    return config;
  }

  // parseFloat는 "25,000"을 25로 읽어 오타를 숨기므로 문자열 전체를 검사하는 Number를 쓴다.
  // 0 이하는 "구독료 대비 배수" 계산에서 0으로 나누거나 음수가 되므로 막는다.
  const subscriptionMonthlyUsd = Number(raw);
  if (!Number.isFinite(subscriptionMonthlyUsd) || subscriptionMonthlyUsd <= 0) {
    throw new Error("SUBSCRIPTION_MONTHLY_USD는 0보다 큰 숫자여야 합니다");
  }

  return {
    ...config,
    subscriptionMonthlyUsd,
  };
}

import { loadConfig } from "@/core/config";
import { expect, test, vi } from "vitest";
import { config } from "../../dashboard.config";

test("SUBSCRIPTION_MONTHLY_USD가 있으면 구독료를 덮어쓴다", () => {
  vi.stubEnv("SUBSCRIPTION_MONTHLY_USD", "25");
  expect(loadConfig().subscriptionMonthlyUsd).toBe(25);
});

test.each(["", " "])(
  "SUBSCRIPTION_MONTHLY_USD=%j이면 설정 파일 값을 쓴다",
  (value) => {
    vi.stubEnv("SUBSCRIPTION_MONTHLY_USD", value);
    expect(loadConfig().subscriptionMonthlyUsd).toBe(
      config.subscriptionMonthlyUsd,
    );
  },
);

test.each(["25usd", "25,000", "0", "-20"])(
  "SUBSCRIPTION_MONTHLY_USD=%j이면 throw한다",
  (value) => {
    vi.stubEnv("SUBSCRIPTION_MONTHLY_USD", value);
    expect(() => loadConfig()).toThrow();
  },
);

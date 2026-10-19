import { summarizeToolInput, truncate } from "@/core/parser/summarize";
import { expect, test } from "vitest";

test("목록에 없는 툴은 첫 문자열 값을 요약으로 쓴다", () => {
  expect(summarizeToolInput("Unknown", { a: 1, b: "x", c: "y" })).toBe("x");
});

test("문자열 값이 없거나 input이 객체가 아니면 null", () => {
  expect(summarizeToolInput("Unknown", { a: 1 })).toBeNull();
  expect(summarizeToolInput("Bash", null)).toBeNull();
  expect(summarizeToolInput("Bash", { command: 1 })).toBeNull();
});

test("truncate는 정확히 max자이면 그대로 두고, 넘으면 …를 붙인다", () => {
  expect(truncate("가".repeat(500), 500)).toBe("가".repeat(500));
  expect(truncate("가".repeat(501), 500)).toBe("가".repeat(500) + "…");
});

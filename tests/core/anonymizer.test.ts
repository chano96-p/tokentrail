import { redactText } from "@/core/anonymizer/redact";
import { buildSnapshot, parseDemoOptions } from "@/core/anonymizer/snapshot";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { seedFullSession } from "../helpers/seed";
import { createTestDb } from "../helpers/testDb";

const o = {
  homeDir: "/Users/me",
  username: "me",
  projectRoot: "/Users/me/Sites/app",
};

let db: PrismaClient;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
});

afterEach(async () => {
  await cleanup();
});

test.each([
  ["key sk-ant-abcdefghijklmnop1234", "key [REDACTED]"],
  ["token ghp_abcdefghijklmnopqrstuvwxyz", "token [REDACTED]"],
  ["Authorization: Bearer eyJhbGciOi.abc", "Authorization: [REDACTED]"],
  ["mail user@example.com", "mail [REDACTED]"],
  ["Read /Users/me/Sites/app/src/a.ts", "Read src/a.ts"],
  ["cd /Users/me/Desktop/other", "cd ~/Desktop/other"],
  ["whoami → me", "whoami → user"],
  // 접두사만 같은 다른 경로는 프로젝트·홈으로 치환하지 않는다.
  [
    "cat /Users/me/Sites/app2/x /Users/meow/y",
    "cat ~/Sites/app2/x /Users/meow/y",
  ],
  ["cd /Users/me/Sites/app && ls", "cd . && ls"],
  // 미리보기는 sync 때 이미 잘려 있어, 끝에 남은 경로·키 조각은 패턴에 걸리지 않는다.
  ["echo hi > /Users/m…", "echo hi > [REDACTED]…"],
  ["key sk-ant-abc…", "key [REDACTED]…"],
  ["see /tmp/a…", "see /tmp/a…"],
])("redactText(%s)", (input, expected) =>
  expect(redactText(input, o)).toBe(expected),
);

test.each([
  [
    "가장 많이 쓴 프로젝트는 acmecorp_official입니다",
    "가장 많이 쓴 프로젝트는 [REDACTED]_official입니다",
  ],
  [
    "body: JSON.stringify({ username: 'acme' })",
    "body: JSON.stringify({ username: '[REDACTED]' })",
  ],
  ["The ACME 메뉴", "The [REDACTED] 메뉴"],
  // 단어 일부로만 들어간 경우(myacme 안의 acme, skills 안의 ski)는 건드리지 않는다.
  ["myacme skills", "myacme skills"],
])("redactText(%s, words)", (input, expected) =>
  expect(redactText(input, { ...o, words: ["acmecorp", "acme", "ski"] })).toBe(
    expected,
  ),
);

test("allowlist가 비면 아무것도 내보내지 않는다", async () => {
  await seedFullSession(db, { cwd: "/Users/me/Sites/app" });
  const s = await buildSnapshot(db, { projects: [], aliases: {} }, o);
  expect(
    [s.projects, s.sessions, s.apiCalls, s.events].every((a) => a.length === 0),
  ).toBe(true);
});

// 손으로 고친 설정 파일에서 projects가 빠지면 Prisma가 `in: undefined`를 조건 없음으로 읽어 전체가 나간다.
test("allowlist가 배열이 아니면 아무것도 내보내지 않는다", async () => {
  await seedFullSession(db, { cwd: "/Users/me/Sites/app" });
  const s = await buildSnapshot(
    db,
    { aliases: {} } as unknown as Parameters<typeof buildSnapshot>[1],
    o,
  );
  expect(
    [s.projects, s.sessions, s.apiCalls, s.events].every((a) => a.length === 0),
  ).toBe(true);
});

test("redactWords에 적은 이름은 세션 텍스트에서 가린다", async () => {
  await seedFullSession(db, {
    cwd: "/Users/me/Sites/app",
    title: "acmecorp 정리",
    preview: "가장 많이 쓴 프로젝트는 acmecorp_official",
  });
  const s = await buildSnapshot(
    db,
    {
      projects: ["/Users/me/Sites/app"],
      aliases: {},
      redactWords: ["acmecorp"],
    },
    o,
  );
  expect(s.sessions[0].title).toBe("[REDACTED] 정리");
  expect(s.events[0].preview).toBe(
    "가장 많이 쓴 프로젝트는 [REDACTED]_official",
  );
});

test("allowlist 프로젝트만, 별칭과 마스킹 적용, 숫자 보존", async () => {
  await seedFullSession(db, {
    cwd: "/Users/me/Sites/app",
    preview: "sk-ant-abcdefghijklmnop1234 in /Users/me/Sites/app/x.ts",
    inputSummary: "cat /Users/me/Sites/app/.env && ls /Users/me/Desktop",
    gitBranch: "me/feature",
    input: 42,
  });
  await seedFullSession(db, { cwd: "/Users/me/work/secret", sessionId: "s2" });
  const s = await buildSnapshot(
    db,
    {
      projects: ["/Users/me/Sites/app"],
      aliases: { "/Users/me/Sites/app": "side-project-a" },
    },
    o,
  );
  expect(s.projects).toEqual([
    expect.objectContaining({ cwd: "side-project-a", name: "side-project-a" }),
  ]);
  expect(s.sessions.map((x) => x.id)).toEqual(["s1"]);
  expect(s.events[0].preview).toBe("[REDACTED] in x.ts");
  expect(s.events[0].inputSummary).toBe("cat .env && ls ~/Desktop");
  expect(s.sessions[0].gitBranch).toBe("user/feature");
  expect(s.apiCalls.map((a) => a.sessionId)).toEqual(["s1"]);
  expect(s.events.map((e) => e.sessionId)).toEqual(["s1"]);
  expect(s.apiCalls[0].inputTokens).toBe(42);
  expect(JSON.stringify(s)).not.toMatch(/\/Users\/me|secret|sourceFileId/);
});

test("별칭이 없으면 allowlist 순서대로 project-N을 붙이고, 세션 제목도 마스킹한다", async () => {
  await seedFullSession(db, {
    cwd: "/Users/me/Sites/app",
    title: "fix /Users/me/Sites/app/a.ts for me",
  });
  const s = await buildSnapshot(
    db,
    { projects: ["/Users/me/other", "/Users/me/Sites/app"], aliases: {} },
    o,
  );
  expect(s.projects).toEqual([
    expect.objectContaining({ cwd: "project-2", name: "project-2" }),
  ]);
  expect(s.sessions[0].title).toBe("fix a.ts for user");
});

test.each([
  ["projects 오타", { project: ["/a"], aliases: {} }],
  ["projects에 문자열이 아닌 값", { projects: ["/a", 1] }],
  ["aliases 값이 문자열이 아님", { projects: ["/a"], aliases: { "/a": 1 } }],
  ["redactWords가 배열이 아님", { projects: ["/a"], redactWords: "acme" }],
  ["최상위가 배열", [["/a"]]],
])("parseDemoOptions: %s면 거부한다", (_name, raw) => {
  expect(() => parseDemoOptions(raw)).toThrow("dashboard.demo.json");
});

test("parseDemoOptions: aliases·redactWords는 생략할 수 있다", () => {
  expect(parseDemoOptions({ projects: ["/a"] })).toEqual({
    projects: ["/a"],
    aliases: {},
    redactWords: [],
  });
});

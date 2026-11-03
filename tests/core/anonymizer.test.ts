import { redactText } from "@/core/anonymizer/redact";
import { buildSnapshot } from "@/core/anonymizer/snapshot";
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
  ["mail pco@example.com", "mail [REDACTED]"],
  ["Read /Users/me/Sites/app/src/a.ts", "Read src/a.ts"],
  ["cd /Users/me/Desktop/other", "cd ~/Desktop/other"],
  ["whoami → me", "whoami → user"],
  // 접두사만 같은 다른 경로는 프로젝트·홈으로 치환하지 않는다.
  [
    "cat /Users/me/Sites/app2/x /Users/meow/y",
    "cat ~/Sites/app2/x /Users/meow/y",
  ],
  ["cd /Users/me/Sites/app && ls", "cd . && ls"],
])("redactText(%s)", (input, expected) =>
  expect(redactText(input, o)).toBe(expected),
);

test("allowlist가 비면 아무것도 내보내지 않는다", async () => {
  await seedFullSession(db, { cwd: "/Users/me/Sites/app" });
  const s = await buildSnapshot(db, { projects: [], aliases: {} }, o);
  expect(
    [s.projects, s.sessions, s.apiCalls, s.events].every((a) => a.length === 0),
  ).toBe(true);
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

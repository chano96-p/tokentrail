import type { DashboardConfig } from "@/core/config";
import { getSessionDetail } from "@/server/queries/sessionDetail";
import { listSessions } from "@/server/queries/sessions";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { ev, seed, seedSessions, seedTimeline } from "../helpers/seed";
import { createTestDb } from "../helpers/testDb";

const config: DashboardConfig = {
  timezone: "Asia/Seoul",
  subscriptionMonthlyUsd: 100,
  autoSyncOnLoad: false,
  pricing: {},
  demo: { projects: [], aliases: {} },
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

test("커서 페이지네이션으로 겹치지 않게 넘긴다", async () => {
  await seedSessions(db, 25);
  const p1 = await listSessions(db, { sort: "recent" });
  const p2 = await listSessions(db, { sort: "recent", cursor: p1.nextCursor! });
  expect(p1.items).toHaveLength(20);
  expect(p2.items).toHaveLength(5);
  expect(p2.nextCursor).toBeNull();
  expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(25);
});

test("토큰순 정렬과 모델 필터", async () => {
  // s1이 늦게 시작해 recent 순서([s1, s2])와 tokens 순서([s2, s1])가 다르다.
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      model: "claude-a",
      at: "2026-10-22T01:00:00Z",
      input: 100,
    },
    {
      id: "m2",
      session: "s2",
      model: "claude-b",
      at: "2026-10-21T01:00:00Z",
      input: 300,
    },
  ]);
  // seed()는 Session 합계 캐시를 채우지 않는다.
  await db.session.update({ where: { id: "s1" }, data: { totalTokens: 100 } });
  await db.session.update({ where: { id: "s2" }, data: { totalTokens: 300 } });

  const byTokens = await listSessions(db, { sort: "tokens" });
  const filtered = await listSessions(db, {
    sort: "recent",
    model: "claude-a",
  });

  expect(byTokens.items.map((i) => i.id)).toEqual(["s2", "s1"]);
  expect(filtered.items.map((i) => i.id)).toEqual(["s1"]);
});

test("턴 묶기와 토큰 배지", async () => {
  await seedTimeline(
    db,
    "s1",
    [
      ev("e0", "system", "01:00"),
      ev("e1", "user", "01:01"),
      ev("e2", "thinking", "01:02", { apiCallId: "m1" }),
      ev("e3", "assistant_text", "01:02", { apiCallId: "m1" }),
      ev("e4", "tool_use", "01:03", { apiCallId: "m2", agentId: "x" }),
      ev("e5", "user", "01:04", { agentId: "x" }),
      ev("e6", "user", "01:05"),
    ],
    [
      { id: "m1", input: 10, cacheRead: 90, output: 5 },
      { id: "m2", input: 1, output: 1 },
    ],
  );
  const d = await getSessionDetail(db, "s1", config);
  expect(d!.turns.map((t) => [t.id, t.events.map((e) => e.uuid)])).toEqual([
    ["start", ["e0"]],
    ["e1", ["e1", "e2", "e3", "e4", "e5"]],
    ["e6", ["e6"]],
  ]);
  expect(d!.turns[1].events[1].tokens).toEqual({ input: 100, output: 5 });
  expect(d!.turns[1].events[2].tokens).toBeNull();
});

test("없는 세션은 null", async () => {
  expect(await getSessionDetail(db, "nope", config)).toBeNull();
});

test("토큰 동점이어도 id로 페이지가 겹치지 않는다", async () => {
  await seedSessions(db, 25); // totalTokens 모두 0
  const p1 = await listSessions(db, { sort: "tokens" });
  const p2 = await listSessions(db, { sort: "tokens", cursor: p1.nextCursor! });
  expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(25);
  expect(p1.items[0].id).toBe("s24");
});

test("상세 비용은 단가 있는 모델만 더하고 나머지는 unpricedModels로", async () => {
  await seedTimeline(
    db,
    "s1",
    [],
    [
      { id: "m1", input: 1_000_000 },
      { id: "m2", model: "<synthetic>", input: 5 },
    ],
  );
  const d = await getSessionDetail(db, "s1", {
    ...config,
    pricing: {
      "claude-a": {
        input: 3,
        output: 0,
        cacheRead: 0,
        cacheWrite5m: 0,
        cacheWrite1h: 0,
      },
    },
  });
  expect(d!.session.estimatedCostUsd).toBeCloseTo(3);
  expect(d!.session.unpricedModels).toEqual(["<synthetic>"]);
  expect(d!.turns).toEqual([]);
});

test("프로젝트와 기간(startedAt)으로 거른다", async () => {
  await seed(db, [
    { id: "m1", session: "s1", model: "claude-a", at: "2026-10-21T01:00:00Z" },
    {
      id: "m2",
      session: "s2",
      model: "claude-a",
      at: "2026-10-22T01:00:00Z",
      project: "p2",
    },
    { id: "m3", session: "s3", model: "claude-a", at: "2026-10-23T01:00:00Z" },
  ]);

  const byProject = await listSessions(db, { sort: "recent", projectId: "p1" });
  const byRange = await listSessions(db, {
    sort: "recent",
    from: new Date("2026-10-22T00:00:00Z"),
    to: new Date("2026-10-22T23:59:59Z"),
  });

  expect(byProject.items.map((i) => i.id)).toEqual(["s3", "s1"]);
  expect(byRange.items.map((i) => i.id)).toEqual(["s2"]);
});

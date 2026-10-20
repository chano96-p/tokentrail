import type { DashboardConfig } from "@/core/config";
import { getFilterOptions } from "@/server/queries/filters";
import { getOverview } from "@/server/queries/overview";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { seed } from "../helpers/seed";
import { createTestDb } from "../helpers/testDb";

const baseConfig: DashboardConfig = {
  timezone: "Asia/Seoul",
  subscriptionMonthlyUsd: 100,
  autoSyncOnLoad: false,
  pricing: {},
  demo: { projects: [], aliases: {} },
};

const range = {
  from: new Date("2026-10-12T00:00:00+09:00"),
  to: new Date("2026-10-12T23:59:59+09:00"),
};

const config = {
  ...baseConfig,
  timezone: "Asia/Seoul",
  pricing: {
    "claude-a": {
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
    },
  },
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

test("TZ 기준으로 날짜를 나눈다", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      model: "claude-a",
      at: "2026-10-11T16:30:00Z",
      input: 100,
    },
  ]);
  const o = await getOverview(
    db,
    {
      from: new Date("2026-10-11T00:00:00+09:00"),
      to: new Date("2026-10-12T23:59:59+09:00"),
    },
    config,
  );
  expect(o.daily).toEqual([
    {
      date: "2026-10-11",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    {
      date: "2026-10-12",
      inputTokens: 100,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  ]);
});

test("단가 없는 모델은 비용에서 빠지고 목록에 나온다", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 1_000_000,
    },
    {
      id: "m2",
      session: "s1",
      model: "<synthetic>",
      at: "2026-10-12T01:00:00Z",
      input: 5,
    },
  ]);
  const o = await getOverview(db, range, config);
  expect(o.estimatedCostUsd).toBeCloseTo(3);
  expect(o.unpricedModels).toEqual(["<synthetic>"]);
  expect(o.totalTokens).toBe(1_000_005);
});

test("세션 간 복사된 호출은 전체 집계에서 한 번만 센다", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 100,
    },
    {
      id: "m1",
      session: "s2",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 100,
    },
    {
      id: "m2",
      session: "s2",
      model: "claude-a",
      at: "2026-10-12T02:00:00Z",
      input: 10,
    },
  ]);
  const o = await getOverview(db, range, config);
  expect(o.totalTokens).toBe(110);
  expect(o.sessionCount).toBe(2);
  expect(o.topSessions.map((t) => [t.id, t.totalTokens])).toEqual([
    ["s2", 110],
    ["s1", 100],
  ]);
});

test("프로젝트·모델 필터", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      project: "p1",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 10,
    },
    {
      id: "m2",
      session: "s2",
      project: "p2",
      model: "claude-b",
      at: "2026-10-12T01:00:00Z",
      input: 20,
    },
  ]);

  const byProject = await getOverview(
    db,
    { ...range, projectId: "p1" },
    config,
  );
  expect(byProject.sessionCount).toBe(1);

  const byModel = await getOverview(
    db,
    { ...range, model: "claude-b" },
    config,
  );
  expect(byModel.byModel.map((m) => m.model)).toEqual(["claude-b"]);
});

test("빈 DB는 0과 빈 배열", async () => {
  const o = await getOverview(db, range, config);
  expect(o).toMatchObject({
    totalTokens: 0,
    sessionCount: 0,
    activeDays: 0,
    estimatedCostUsd: 0,
    byProject: [],
    topSessions: [],
  });
});

test("getFilterOptions", async () => {
  expect((await getFilterOptions(db)).lastImportedAt).toBeNull();

  await seed(db, [
    {
      id: "m1",
      session: "s1",
      project: "zeta",
      model: "claude-b",
      at: "2026-10-12T01:00:00Z",
    },
    {
      id: "m2",
      session: "s2",
      project: "alpha",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
    },
    {
      id: "m3",
      session: "s2",
      project: "alpha",
      model: "claude-a",
      at: "2026-10-12T02:00:00Z",
    },
  ]);
  const options = await getFilterOptions(db);

  expect(options.projects.map((p) => p.name)).toEqual(["alpha", "zeta"]);
  expect(options.models).toEqual(["claude-a", "claude-b"]);
  expect(options.lastImportedAt).not.toBeNull();
});

test("복사된 호출은 sessionId 사전순 첫 세션의 프로젝트에 귀속된다", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s2",
      project: "p2",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 100,
    },
    {
      id: "m1",
      session: "s1",
      project: "p1",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 100,
    },
  ]);
  const o = await getOverview(db, range, config);
  expect(o.byProject).toEqual([
    { projectId: "p1", name: "p1", totalTokens: 100 },
  ]);
});

test("byProject는 상위 8, topSessions는 상위 5까지", async () => {
  await seed(
    db,
    Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      session: `s${i}`,
      project: `p${i}`,
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: (i + 1) * 10,
    })),
  );
  const o = await getOverview(db, range, config);
  expect(o.byProject).toHaveLength(8);
  expect(o.byProject[0].projectId).toBe("p9");
  expect(o.topSessions.map((s) => s.id)).toEqual([
    "s9",
    "s8",
    "s7",
    "s6",
    "s5",
  ]);
});

test("프로젝트로 거르면 필터 없는 화면의 그 프로젝트 막대와 같은 합계가 나온다", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      project: "p1",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 100,
    },
    {
      id: "m1",
      session: "s2",
      project: "p2",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      input: 100,
    },
    {
      id: "m2",
      session: "s2",
      project: "p2",
      model: "claude-a",
      at: "2026-10-12T02:00:00Z",
      input: 10,
    },
  ]);
  const all = await getOverview(db, range, config);
  const p2 = await getOverview(db, { ...range, projectId: "p2" }, config);
  const p2Bar = all.byProject.find((p) => p.projectId === "p2");
  expect(p2.totalTokens).toBe(p2Bar?.totalTokens);
  expect(p2.totalTokens).toBe(10);
  expect(p2.sessionCount).toBe(1);
  expect(p2.topSessions).toEqual([
    { id: "s2", title: null, projectName: "p2", totalTokens: 110 },
  ]);
});

test("cache write는 5m·1h를 합쳐 일별에 넣고, 비용은 각각의 단가로 계산한다", async () => {
  await seed(db, [
    {
      id: "m1",
      session: "s1",
      model: "claude-a",
      at: "2026-10-11T01:00:00Z",
      cacheWrite5m: 1_000_000,
    },
    {
      id: "m2",
      session: "s1",
      model: "claude-a",
      at: "2026-10-12T01:00:00Z",
      cacheWrite1h: 1_000_000,
    },
  ]);
  const o = await getOverview(
    db,
    { from: new Date("2026-10-11T00:00:00+09:00"), to: range.to },
    config,
  );
  expect(o.daily.map((d) => d.cacheWriteTokens)).toEqual([
    1_000_000, 1_000_000,
  ]);
  expect(o.estimatedCostUsd).toBeCloseTo(3.75 + 6);
  expect(o.activeDays).toBe(2);
});

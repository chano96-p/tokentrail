import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pushSnapshot } from "@/core/anonymizer/push";
import { buildSnapshot, type DemoSnapshot } from "@/core/anonymizer/snapshot";
import type { DashboardConfig } from "@/core/config";
import { createDb } from "@/core/db/createDb";
import { getOverview } from "@/server/queries/overview";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { seedFullSession } from "../helpers/seed";
import { createTestDb } from "../helpers/testDb";

const config: DashboardConfig = {
  timezone: "Asia/Seoul",
  subscriptionMonthlyUsd: 100,
  autoSyncOnLoad: false,
  pricing: {},
  demo: { projects: [], aliases: {} },
};

const wideRange = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2026-12-31T23:59:59Z"),
};

let source: PrismaClient;
let target: PrismaClient | undefined;
let targetUrl: string;
let cleanup: () => Promise<void>;
let tmpDir: string;

beforeEach(async () => {
  const testDb = await createTestDb();
  source = testDb.db;
  cleanup = testDb.cleanup;
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "tokentrail-push-"));
  targetUrl = `file:${path.join(tmpDir, "demo.db")}`;
});

afterEach(async () => {
  await target?.$disconnect();
  target = undefined;
  await cleanup();
  await rm(tmpDir, { recursive: true, force: true });
});

// demo-snapshot.json을 거친 것처럼 날짜가 문자열인 스냅샷을 만든다.
async function snapshotFixture(): Promise<DemoSnapshot> {
  await seedFullSession(source, { cwd: "/a", sessionId: "s1", input: 30 });
  await seedFullSession(source, { cwd: "/b", sessionId: "s2", input: 12 });
  const snapshot = await buildSnapshot(
    source,
    { projects: ["/a", "/b"], aliases: {} },
    { homeDir: "/Users/me", username: "me" },
  );
  return JSON.parse(JSON.stringify(snapshot)) as DemoSnapshot;
}

test("push한 DB에서 집계가 스냅샷과 같다", async () => {
  const snapshot = await snapshotFixture();
  await pushSnapshot(targetUrl, undefined, snapshot);

  target = createDb(targetUrl);
  const o = await getOverview(target, wideRange, config);
  expect(o.totalTokens).toBe(42);
  expect(o.sessionCount).toBe(2);
  expect(await target.timelineEvent.count()).toBe(snapshot.events.length);
});

test.each([
  ["빈 projects", (s: DemoSnapshot) => ({ ...s, projects: [] })],
  ["다른 version", (s: DemoSnapshot) => ({ ...s, version: 2 })],
  ["빠진 events", (s: DemoSnapshot) => ({ ...s, events: undefined })],
])("%s 스냅샷은 기존 데이터를 지우지 않고 거부한다", async (_name, broken) => {
  const snapshot = await snapshotFixture();
  await pushSnapshot(targetUrl, undefined, snapshot);

  await expect(
    pushSnapshot(targetUrl, undefined, broken(snapshot) as DemoSnapshot),
  ).rejects.toThrow("demo-snapshot.json");

  target = createDb(targetUrl);
  expect(await target.project.count()).toBe(snapshot.projects.length);
});

test("두 번 push해도 중복이 없다", async () => {
  const snapshot = await snapshotFixture();
  await pushSnapshot(targetUrl, undefined, snapshot);
  await pushSnapshot(targetUrl, undefined, snapshot);

  target = createDb(targetUrl);
  expect(await target.apiCall.count()).toBe(snapshot.apiCalls.length);
  expect(await target.project.count()).toBe(snapshot.projects.length);
});

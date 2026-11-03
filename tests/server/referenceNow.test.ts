import { getReferenceNow } from "@/server/referenceNow";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { seed } from "../helpers/seed";
import { createTestDb } from "../helpers/testDb";

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

const now = new Date("2026-11-20T00:00:00Z");

test("local 모드는 현재 시각을 쓴다", async () => {
  await seed(db, [
    { id: "m1", session: "s1", model: "claude-a", at: "2026-11-03T05:00:00Z" },
  ]);
  expect(await getReferenceNow(db, "local", now)).toEqual(now);
});

test("demo 모드는 마지막 API 호출 시각을 쓴다", async () => {
  await seed(db, [
    { id: "m1", session: "s1", model: "claude-a", at: "2026-10-30T01:00:00Z" },
    { id: "m2", session: "s1", model: "claude-a", at: "2026-11-03T05:00:00Z" },
  ]);
  expect(await getReferenceNow(db, "demo", now)).toEqual(
    new Date("2026-11-03T05:00:00Z"),
  );
});

test("demo 모드에서 데이터가 없으면 현재 시각을 쓴다", async () => {
  expect(await getReferenceNow(db, "demo", now)).toEqual(now);
});

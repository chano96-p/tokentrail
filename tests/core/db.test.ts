import { test, expect } from "vitest";
import { createTestDb } from "../helpers/testDb";

test("createTestDb는 마이그레이션이 적용된 빈 DB를 만든다", async () => {
  const { db, cleanup } = await createTestDb();
  const p = await db.project.create({ data: { cwd: "/x", name: "x" } });
  expect(await db.project.count()).toBe(1);
  expect(p.cwd).toBe("/x");
  await cleanup();
});

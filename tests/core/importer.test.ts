import { beforeEach, afterEach, expect, test } from "vitest";
import { runSync } from "@/core/importer/sync";
import { createTestDb } from "../helpers/testDb";
import { assistantLine, userText } from "../helpers/fixtures";
import type { PrismaClient } from "@prisma/client";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let db: PrismaClient;
let dir: string;
let cleanup: () => Promise<void>;

function logPath(relativePath: string): string {
  return path.join(dir, "projects", relativePath);
}

function toJsonl(lines: unknown[]): string {
  return (
    lines
      .map((l) => (typeof l === "string" ? l : JSON.stringify(l)))
      .join("\n") + "\n"
  );
}

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  dir = await mkdtemp(path.join(os.tmpdir(), "tokentrail-"));
});

afterEach(async () => {
  await cleanup();
  await rm(dir, { recursive: true, force: true });
});

async function writeLog(relativePath: string, lines: unknown[]) {
  const filePath = logPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, toJsonl(lines));
}

async function appendLog(relativePath: string, lines: unknown[]) {
  const filePath = logPath(relativePath);
  await writeFile(filePath, toJsonl(lines), { flag: "a" });
}

test("중복 message.id는 한 번만 집계된다", async () => {
  await writeLog("p/s1.jsonl", [
    assistantLine({
      id: "m1",
      uuid: "u1",
      blocks: [{ type: "thinking", thinking: "x" }],
    }),
    assistantLine({
      id: "m1",
      uuid: "u2",
      blocks: [{ type: "text", text: "y" }],
    }),
  ]);
  await runSync(db, dir);
  expect(await db.apiCall.count()).toBe(1);
  expect(
    (await db.session.findUniqueOrThrow({ where: { id: "s1" } })).totalTokens,
  ).toBe(135);
  expect(await db.timelineEvent.count()).toBe(2);
});

test("두 번 sync해도 결과가 같다", async () => {
  await writeLog("p/s1.jsonl", [userText("hi"), assistantLine({ id: "m1" })]);
  await runSync(db, dir);
  const second = await runSync(db, dir);
  expect(second).toMatchObject({
    filesImported: 0,
    newApiCalls: 0,
    newEvents: 0,
  });
});

test("이어 쓴 줄만 새로 읽는다", async () => {
  await writeLog("p/s1.jsonl", [userText("hi")]);
  await runSync(db, dir);
  await appendLog("p/s1.jsonl", [assistantLine({ id: "m2" })]);
  expect(await runSync(db, dir)).toMatchObject({
    filesImported: 1,
    newApiCalls: 1,
  });
});

test("파일이 줄어들면 그 파일 데이터를 지우고 다시 읽는다", async () => {
  await writeLog("p/s1.jsonl", [
    assistantLine({ id: "m1" }),
    assistantLine({ id: "m2" }),
  ]);
  await runSync(db, dir);
  await writeLog("p/s1.jsonl", [assistantLine({ id: "m3" })]);
  await runSync(db, dir);
  expect((await db.apiCall.findMany()).map((a) => a.messageId)).toEqual(["m3"]);
});

test("다른 세션 파일에 복사된 호출은 세션마다 저장되고, 한쪽 재import가 다른 쪽을 지우지 않는다", async () => {
  await writeLog("p/s1.jsonl", [assistantLine({ id: "m1", uuid: "u1" })]);
  await writeLog("p/s2.jsonl", [
    { ...assistantLine({ id: "m1", uuid: "u1" }), sessionId: "s2" },
    { ...assistantLine({ id: "m2", uuid: "u2" }), sessionId: "s2" },
  ]);
  await runSync(db, dir);
  expect(await db.apiCall.count()).toBe(3);
  expect(await db.timelineEvent.count({ where: { uuid: "u1" } })).toBe(2);
  expect(
    (await db.session.findUniqueOrThrow({ where: { id: "s2" } })).totalTokens,
  ).toBe(270);
  await writeLog("p/s2.jsonl", [
    { ...assistantLine({ id: "m3", uuid: "u3" }), sessionId: "s2" },
  ]);
  await runSync(db, dir);
  expect(
    (await db.apiCall.findMany({ where: { sessionId: "s1" } })).map(
      (a) => a.messageId,
    ),
  ).toEqual(["m1"]);
});

test("깨진 줄은 건너뛰고 센다", async () => {
  await writeLog("p/s1.jsonl", ['{"type":', userText("ok")]);
  expect((await runSync(db, dir)).skippedLines).toBe(1);
});

test("서브에이전트 파일이 먼저 import돼도 세션 하나로 합쳐진다", async () => {
  await writeLog("p/a/s1/subagents/agent-x.jsonl", [
    { ...assistantLine({ id: "m9" }), agentId: "x", gitBranch: null },
  ]);
  await writeLog("p/z/s1.jsonl", [
    { type: "ai-title", aiTitle: "제목", sessionId: "s1" },
    assistantLine({ id: "m1" }),
  ]);
  await runSync(db, dir);
  const s = await db.session.findUniqueOrThrow({ where: { id: "s1" } });
  expect(await db.session.count()).toBe(1);
  expect(s).toMatchObject({
    title: "제목",
    gitBranch: "main",
    subagentCount: 1,
    totalTokens: 270,
  });
});

test("세션 도중 cwd가 바뀌어도 첫 프로젝트에 남는다", async () => {
  await writeLog("p/s1.jsonl", [
    userText("a"),
    { ...userText("b"), uuid: "u-b", cwd: "/Users/me/other" },
  ]);
  await runSync(db, dir);
  expect(await db.session.count()).toBe(1);
  expect(
    (await db.session.findFirstOrThrow({ include: { project: true } })).project
      .cwd,
  ).toBe("/Users/me/proj");
});

test("ai-title은 custom-title로 정한 제목을 덮어쓰지 않고, 이어 쓴 custom-title은 반영된다", async () => {
  await writeLog("p/s1.jsonl", [
    userText("a"),
    { type: "custom-title", customTitle: "내 제목", sessionId: "s1" },
  ]);
  await runSync(db, dir);
  await appendLog("p/s1.jsonl", [
    { type: "ai-title", aiTitle: "AI 제목", sessionId: "s1" },
  ]);
  await runSync(db, dir);
  expect(
    await db.session.findUniqueOrThrow({ where: { id: "s1" } }),
  ).toMatchObject({
    title: "내 제목",
    titleSource: "custom",
  });
  await appendLog("p/s1.jsonl", [
    { type: "custom-title", customTitle: "바꾼 제목", sessionId: "s1" },
  ]);
  await runSync(db, dir);
  expect(
    (await db.session.findUniqueOrThrow({ where: { id: "s1" } })).title,
  ).toBe("바꾼 제목");
});

test("세션이 생기기 전에 들어온 제목도 나중에 반영된다", async () => {
  await writeLog("p/s1.jsonl", [
    { type: "custom-title", customTitle: "먼저 온 제목", sessionId: "s1" },
  ]);
  await runSync(db, dir);
  await appendLog("p/s1.jsonl", [userText("a")]);
  await runSync(db, dir);
  expect(
    (await db.session.findUniqueOrThrow({ where: { id: "s1" } })).title,
  ).toBe("먼저 온 제목");
});

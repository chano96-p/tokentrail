import { scanLogFiles } from "@/core/importer/scan";
import os from "node:os";
import path from "node:path";
import { expect, test, vi } from "vitest";
import { tmpTree } from "../helpers/fs";

test("scanLogFiles는 서브에이전트 파일까지 찾는다", async () => {
  const dir = await tmpTree({
    "projects/p/s1.jsonl": "",
    "projects/p/s1/subagents/agent-x.jsonl": "",
    "projects/p/s1/subagents/agent-x.meta.json": "{}",
  });
  expect(
    (await scanLogFiles(dir)).map((f) => path.relative(dir, f.path)),
  ).toEqual(["projects/p/s1.jsonl", "projects/p/s1/subagents/agent-x.jsonl"]);
});

test("claudeDir의 ~는 홈 디렉터리로 확장한다", async () => {
  const dir = await tmpTree({ "projects/p/s1.jsonl": "" });
  vi.spyOn(os, "homedir").mockReturnValue(dir);
  expect(
    (await scanLogFiles("~")).map((f) => path.relative(dir, f.path)),
  ).toEqual(["projects/p/s1.jsonl"]);
});

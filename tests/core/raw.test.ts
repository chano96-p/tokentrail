import { readRawLine } from "@/core/importer/raw";
import { expect, test } from "vitest";
import { tmpFile } from "../helpers/fs";

test("readRawLine은 #접미사를 떼고 원본 줄을 찾는다", async () => {
  const p = await tmpFile(
    [
      JSON.stringify({ uuid: "u0" }),
      JSON.stringify({ uuid: "u1", message: { content: "전체" } }),
    ].join("\n") + "\n",
  );
  expect(await readRawLine(p, "u1#2")).toEqual({
    uuid: "u1",
    message: { content: "전체" },
  });
  expect(await readRawLine(p, "zz")).toBeNull();
});

test("readRawLine은 parentUuid로만 언급된 줄이 아니라 uuid가 같은 줄을 돌려준다", async () => {
  const p = await tmpFile(
    [
      JSON.stringify({ uuid: "u2", parentUuid: "u1" }),
      JSON.stringify({ uuid: "u1", message: { content: "원본" } }),
    ].join("\n") + "\n",
  );
  expect(await readRawLine(p, "u1")).toEqual({
    uuid: "u1",
    message: { content: "원본" },
  });
});

test("readRawLine은 파일이 없으면 null", async () => {
  const p = await tmpFile("");
  expect(await readRawLine(p + ".missing", "u1")).toBeNull();
});

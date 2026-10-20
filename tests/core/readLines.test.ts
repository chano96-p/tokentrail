import { readCompleteLines } from "@/core/importer/readLines";
import { expect, test } from "vitest";
import { tmpFile } from "../helpers/fs";

test("마지막 개행까지만 읽고 바이트 offset을 돌려준다", async () => {
  const p = await tmpFile('{"a":"한글"}\n{"b":1}\n{"c":"쓰는');
  const r = await readCompleteLines(p, 0);
  expect(r.lines).toEqual(['{"a":"한글"}', '{"b":1}']);
  expect(r.nextOffset).toBe(Buffer.byteLength('{"a":"한글"}\n{"b":1}\n'));
});

test("offset 이후만 읽는다", async () => {
  const p = await tmpFile('{"a":1}\n{"b":2}\n');
  expect(
    (await readCompleteLines(p, Buffer.byteLength('{"a":1}\n'))).lines,
  ).toEqual(['{"b":2}']);
});

test("개행이 없으면 아무것도 읽지 않고 offset 유지", async () => {
  expect(await readCompleteLines(await tmpFile('{"a":'), 0)).toEqual({
    lines: [],
    nextOffset: 0,
  });
});

test("빈 줄은 버린다", async () => {
  const p = await tmpFile('{"a":1}\n\n{"b":2}\n');
  expect((await readCompleteLines(p, 0)).lines).toEqual(['{"a":1}', '{"b":2}']);
});

test("offset이 파일 끝이면 빈 결과와 같은 offset", async () => {
  const p = await tmpFile('{"a":1}\n');
  const size = Buffer.byteLength('{"a":1}\n');
  expect(await readCompleteLines(p, size)).toEqual({
    lines: [],
    nextOffset: size,
  });
});

test("offset이 파일 크기보다 크면 throw", async () => {
  await expect(readCompleteLines(await tmpFile("a\n"), 100)).rejects.toThrow();
});

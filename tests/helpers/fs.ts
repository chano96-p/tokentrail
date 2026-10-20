import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";

async function makeTmpDir(): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "tokentrail-"));
  onTestFinished(() => rm(tmpDir, { recursive: true, force: true }));
  return tmpDir;
}

// 임시 폴더에 파일 하나를 만들고 그 파일 경로를 반환
export async function tmpFile(content: string): Promise<string> {
  const tmpDir = await makeTmpDir();
  const filePath = path.join(tmpDir, "log.jsonl");

  await writeFile(filePath, content);

  return filePath;
}

// { "projects/p/s1.jsonl": "", ... } 를 받아 임시 폴더 아래에 그대로 만들고, 그 폴더 경로를 반환
export async function tmpTree(files: Record<string, string>): Promise<string> {
  const tmpDir = await makeTmpDir();

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(tmpDir, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  return tmpDir;
}

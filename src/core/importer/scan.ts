import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type ScannedFile = { path: string; size: number; mtimeMs: number };

export async function scanLogFiles(claudeDir: string): Promise<ScannedFile[]> {
  const baseDir =
    claudeDir === "~" || claudeDir.startsWith("~/")
      ? path.join(os.homedir(), claudeDir.slice(1))
      : claudeDir;

  const projectsDir = path.join(baseDir, "projects");
  const relativePaths = await readdir(projectsDir, {
    recursive: true,
    withFileTypes: true,
  });

  const files: ScannedFile[] = [];
  for (const relativePath of relativePaths) {
    if (!relativePath.isFile() || !relativePath.name.endsWith(".jsonl"))
      continue;

    const filePath = path.join(relativePath.parentPath, relativePath.name);
    const { size, mtimeMs } = await stat(filePath);
    files.push({ path: filePath, size, mtimeMs });
  }

  return files.sort((a, b) => (a.path < b.path ? -1 : 1));
}

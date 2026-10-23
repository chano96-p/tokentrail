import type { PrismaClient } from "@prisma/client";
import { importFile } from "./importFile";
import { scanLogFiles } from "./scan";

export type SyncSummary = {
  filesScanned: number;
  filesImported: number;
  newApiCalls: number;
  newEvents: number;
  skippedLines: number;
};

// sync 스크립트와 API가 같은 기본값을 쓰도록 한 곳에 둔다.
export function getClaudeDir(): string {
  return process.env.CLAUDE_DIR || "~/.claude";
}

export async function runSync(
  db: PrismaClient,
  claudeDir: string,
): Promise<SyncSummary> {
  const files = await scanLogFiles(claudeDir);

  const summary: SyncSummary = {
    filesScanned: files.length,
    filesImported: 0,
    newApiCalls: 0,
    newEvents: 0,
    skippedLines: 0,
  };

  for (const file of files) {
    const result = await importFile(db, file);
    if (result.status !== "unchanged") {
      summary.filesImported += 1;
    }
    summary.newApiCalls += result.newApiCalls;
    summary.newEvents += result.newEvents;
    summary.skippedLines += result.skippedLines;
  }

  return summary;
}

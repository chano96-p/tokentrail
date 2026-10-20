import type { PrismaClient } from "@prisma/client";

export type SeedRow = {
  id: string; // messageId
  session: string; // sessionId
  model: string;
  at: string; // ISO 시각 문자열
  project?: string; // 기본 "p1"
  input?: number; // 아래 토큰들은 기본 0
  output?: number;
  cacheRead?: number;
  cacheWrite5m?: number;
  cacheWrite1h?: number;
};

const SEED_FILE_PATH = "seed";

export async function seed(db: PrismaClient, rows: SeedRow[]): Promise<void> {
  const sourceFile = await db.importedFile.upsert({
    where: { path: SEED_FILE_PATH },
    create: { path: SEED_FILE_PATH, size: 0, mtimeMs: 0, byteOffset: 0 },
    update: {},
  });

  for (const row of rows) {
    const projectId = row.project ?? "p1";
    const at = new Date(row.at);

    await db.project.upsert({
      where: { id: projectId },
      create: { id: projectId, cwd: "/" + projectId, name: projectId },
      update: {},
    });

    await db.session.upsert({
      where: { id: row.session },
      create: {
        id: row.session,
        projectId,
        startedAt: at,
        endedAt: at,
      },
      update: {},
    });

    await db.apiCall.create({
      data: {
        sessionId: row.session,
        messageId: row.id,
        sourceFileId: sourceFile.id,
        model: row.model,
        timestamp: at,
        inputTokens: row.input ?? 0,
        outputTokens: row.output ?? 0,
        cacheReadTokens: row.cacheRead ?? 0,
        cacheWrite5mTokens: row.cacheWrite5m ?? 0,
        cacheWrite1hTokens: row.cacheWrite1h ?? 0,
      },
    });
  }
}

import type { EventKind, TimelineEventRecord } from "@/core/parser/types";
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

function getSeedFile(db: PrismaClient) {
  return db.importedFile.upsert({
    where: { path: SEED_FILE_PATH },
    create: { path: SEED_FILE_PATH, size: 0, mtimeMs: 0, byteOffset: 0 },
    update: {},
  });
}

function upsertProject(db: PrismaClient, projectId: string) {
  return db.project.upsert({
    where: { id: projectId },
    create: { id: projectId, cwd: "/" + projectId, name: projectId },
    update: {},
  });
}

export async function seed(db: PrismaClient, rows: SeedRow[]): Promise<void> {
  const sourceFile = await getSeedFile(db);

  for (const row of rows) {
    const projectId = row.project ?? "p1";
    const at = new Date(row.at);

    await upsertProject(db, projectId);

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

// 세션 i는 i분에 시작한다. id를 두 자리로 맞춰 문자열 정렬과 숫자 순서가 같다.
export async function seedSessions(
  db: PrismaClient,
  count: number,
): Promise<void> {
  await upsertProject(db, "p1");

  for (let i = 0; i < count; i++) {
    const at = new Date(Date.UTC(2026, 9, 12, 0, i));
    await db.session.create({
      data: {
        id: `s${String(i).padStart(2, "0")}`,
        projectId: "p1",
        startedAt: at,
        endedAt: at,
      },
    });
  }
}

export type SeedEvent = Omit<TimelineEventRecord, "sessionId">;

// time은 "HH:MM" (2026-10-12 UTC)
export function ev(
  uuid: string,
  kind: EventKind,
  time: string,
  overrides: Partial<SeedEvent> = {},
): SeedEvent {
  return {
    uuid,
    agentId: null,
    parentUuid: null,
    apiCallId: null,
    timestamp: new Date(`2026-10-12T${time}:00Z`),
    kind,
    toolName: null,
    inputSummary: null,
    isError: false,
    contentLength: 0,
    preview: null,
    ...overrides,
  };
}

export type SeedApiCall = Omit<SeedRow, "session" | "model" | "at"> & {
  model?: string; // 기본 "claude-a"
};

const SEED_TIMELINE_AT = "2026-10-12T01:00:00Z";

export async function seedTimeline(
  db: PrismaClient,
  sessionId: string,
  events: SeedEvent[],
  apiCalls: SeedApiCall[],
): Promise<void> {
  // ApiCall이 없어도 이벤트가 붙을 세션은 있어야 한다.
  await upsertProject(db, "p1");
  await db.session.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      projectId: "p1",
      startedAt: new Date(SEED_TIMELINE_AT),
      endedAt: new Date(SEED_TIMELINE_AT),
    },
    update: {},
  });
  await seed(
    db,
    apiCalls.map((call) => ({
      ...call,
      session: sessionId,
      model: call.model ?? "claude-a",
      at: SEED_TIMELINE_AT,
    })),
  );

  const sourceFile = await getSeedFile(db);
  await db.timelineEvent.createMany({
    data: events.map((event) => ({
      ...event,
      sessionId,
      sourceFileId: sourceFile.id,
    })),
  });
}

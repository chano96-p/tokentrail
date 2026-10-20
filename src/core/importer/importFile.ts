import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { parseLine } from "../parser/parseLine";
import type {
  ApiCallRecord,
  LineContext,
  TimelineEventRecord,
  TitleSource,
} from "../parser/types";
import { totalTokens } from "../pricing";
import { readCompleteLines } from "./readLines";
import type { ScannedFile } from "./scan";

export type FileImportResult = {
  status: "new" | "appended" | "reimported" | "unchanged";
  newApiCalls: number;
  newEvents: number;
  skippedLines: number;
};

type Tx = Prisma.TransactionClient;

type SessionDraft = {
  context: LineContext | null;
  gitBranch: string | null;
  cliVersion: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  title: string | null;
  titleSource: TitleSource | null;
  apiCalls: Map<string, ApiCallRecord>;
  events: Map<string, TimelineEventRecord>;
};

// 수십 MB짜리 세션 파일은 한 트랜잭션에서 수만 행을 넣는다. Prisma 기본값(5초)으로는 부족하다.
const TRANSACTION_TIMEOUT_MS = 120_000;
// SQLite가 한 쿼리에 받는 바인딩 변수 수에 한도가 있어 IN 조건을 나눠 보낸다.
const IN_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function emptyDraft(): SessionDraft {
  return {
    context: null,
    gitBranch: null,
    cliVersion: null,
    startedAt: null,
    endedAt: null,
    title: null,
    titleSource: null,
    apiCalls: new Map(),
    events: new Map(),
  };
}

// custom-title은 사용자가 직접 붙인 제목이라 ai-title이 덮어쓰지 못한다.
function shouldReplaceTitle(
  current: TitleSource | null,
  incoming: TitleSource,
): boolean {
  return incoming === "custom" || current !== "custom";
}

function collectDrafts(lines: string[]) {
  const drafts = new Map<string, SessionDraft>();
  let skippedLines = 0;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed.status === "malformed") {
      skippedLines++;
      continue;
    }
    if (parsed.status === "ignored") continue;

    let draft = drafts.get(parsed.sessionId);
    if (!draft) {
      draft = emptyDraft();
      drafts.set(parsed.sessionId, draft);
    }

    const { context } = parsed;
    if (context) {
      // 세션 도중 cwd가 바뀌어도 처음 본 프로젝트에 남긴다.
      draft.context ??= context;
      draft.gitBranch ??= context.gitBranch;
      draft.cliVersion ??= context.cliVersion;
      if (!draft.startedAt || context.timestamp < draft.startedAt) {
        draft.startedAt = context.timestamp;
      }
      if (!draft.endedAt || context.timestamp > draft.endedAt) {
        draft.endedAt = context.timestamp;
      }
    }

    if (
      parsed.title !== null &&
      parsed.titleSource !== null &&
      shouldReplaceTitle(draft.titleSource, parsed.titleSource)
    ) {
      draft.title = parsed.title;
      draft.titleSource = parsed.titleSource;
    }

    // 같은 message.id가 블록마다 여러 줄로 나뉘어 있어 처음 들어온 값만 남긴다.
    if (parsed.apiCall && !draft.apiCalls.has(parsed.apiCall.messageId)) {
      draft.apiCalls.set(parsed.apiCall.messageId, parsed.apiCall);
    }
    for (const event of parsed.events) {
      if (!draft.events.has(event.uuid)) draft.events.set(event.uuid, event);
    }
  }

  return { drafts, skippedLines };
}

async function upsertSession(tx: Tx, sessionId: string, draft: SessionDraft) {
  const existing = await tx.session.findUnique({ where: { id: sessionId } });

  if (!existing) {
    // 제목 줄만 새로 들어온 경우처럼 context가 없으면 세션을 만들 수 없다.
    if (!draft.context || !draft.startedAt || !draft.endedAt) return null;

    const project = await tx.project.upsert({
      where: { cwd: draft.context.cwd },
      create: {
        cwd: draft.context.cwd,
        name: path.basename(draft.context.cwd),
      },
      update: {},
    });
    return tx.session.create({
      data: {
        id: sessionId,
        projectId: project.id,
        title: draft.title,
        titleSource: draft.titleSource,
        gitBranch: draft.gitBranch,
        cliVersion: draft.cliVersion,
        startedAt: draft.startedAt,
        endedAt: draft.endedAt,
      },
    });
  }

  const replaceTitle =
    draft.title !== null &&
    draft.titleSource !== null &&
    shouldReplaceTitle(
      existing.titleSource as TitleSource | null,
      draft.titleSource,
    );

  return tx.session.update({
    where: { id: sessionId },
    data: {
      startedAt:
        draft.startedAt && draft.startedAt < existing.startedAt
          ? draft.startedAt
          : existing.startedAt,
      endedAt:
        draft.endedAt && draft.endedAt > existing.endedAt
          ? draft.endedAt
          : existing.endedAt,
      ...(replaceTitle
        ? { title: draft.title, titleSource: draft.titleSource }
        : {}),
      gitBranch: existing.gitBranch ?? draft.gitBranch,
      cliVersion: existing.cliVersion ?? draft.cliVersion,
    },
  });
}

// 이어 읽기에서는 같은 message.id의 뒤쪽 블록 줄이 다음 sync에 들어올 수 있어, 이미 저장된 키는 뺀다.
async function insertNewApiCalls(
  tx: Tx,
  sessionId: string,
  records: ApiCallRecord[],
  sourceFileId: string,
): Promise<number> {
  const existing = new Set<string>();
  for (const ids of chunk(
    records.map((r) => r.messageId),
    IN_CHUNK_SIZE,
  )) {
    const rows = await tx.apiCall.findMany({
      where: { sessionId, messageId: { in: ids } },
      select: { messageId: true },
    });
    for (const row of rows) existing.add(row.messageId);
  }

  const data = records
    .filter((r) => !existing.has(r.messageId))
    .map((r) => ({ ...r, sourceFileId }));
  if (data.length > 0) await tx.apiCall.createMany({ data });
  return data.length;
}

async function insertNewEvents(
  tx: Tx,
  sessionId: string,
  records: TimelineEventRecord[],
  sourceFileId: string,
): Promise<number> {
  const existing = new Set<string>();
  for (const uuids of chunk(
    records.map((r) => r.uuid),
    IN_CHUNK_SIZE,
  )) {
    const rows = await tx.timelineEvent.findMany({
      where: { sessionId, uuid: { in: uuids } },
      select: { uuid: true },
    });
    for (const row of rows) existing.add(row.uuid);
  }

  const data = records
    .filter((r) => !existing.has(r.uuid))
    .map((r) => ({ ...r, sourceFileId }));
  if (data.length > 0) await tx.timelineEvent.createMany({ data });
  return data.length;
}

async function recomputeSessionTotals(tx: Tx, sessionId: string) {
  const { _sum } = await tx.apiCall.aggregate({
    where: { sessionId },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWrite5mTokens: true,
      cacheWrite1hTokens: true,
    },
  });
  const tokens = {
    inputTokens: _sum.inputTokens ?? 0,
    outputTokens: _sum.outputTokens ?? 0,
    cacheReadTokens: _sum.cacheReadTokens ?? 0,
    cacheWrite5mTokens: _sum.cacheWrite5mTokens ?? 0,
    cacheWrite1hTokens: _sum.cacheWrite1hTokens ?? 0,
  };
  // findMany의 distinct는 SQLite에서 행을 모두 불러와 메모리에서 거르므로 groupBy로 DB에서 묶는다.
  const agents = await tx.timelineEvent.groupBy({
    by: ["agentId"],
    where: { sessionId, agentId: { not: null } },
  });

  await tx.session.update({
    where: { id: sessionId },
    data: {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cacheReadTokens: tokens.cacheReadTokens,
      cacheWriteTokens: tokens.cacheWrite5mTokens + tokens.cacheWrite1hTokens,
      totalTokens: totalTokens(tokens),
      subagentCount: agents.length,
    },
  });
}

export async function importFile(
  db: PrismaClient,
  file: ScannedFile,
): Promise<FileImportResult> {
  const existing = await db.importedFile.findUnique({
    where: { path: file.path },
  });

  let status: FileImportResult["status"];
  let fromOffset: number;
  if (!existing) {
    status = "new";
    fromOffset = 0;
  } else if (file.size < existing.byteOffset) {
    status = "reimported";
    fromOffset = 0;
  } else if (file.size === existing.byteOffset) {
    return {
      status: "unchanged",
      newApiCalls: 0,
      newEvents: 0,
      skippedLines: 0,
    };
  } else {
    status = "appended";
    fromOffset = existing.byteOffset;
  }

  const { lines, nextOffset } = await readCompleteLines(file.path, fromOffset);
  // 쓰는 중인 마지막 줄만 늘어난 경우다. 매번 빈 트랜잭션과 합계 재계산을 돌리지 않는다.
  if (status === "appended" && lines.length === 0) {
    return {
      status: "unchanged",
      newApiCalls: 0,
      newEvents: 0,
      skippedLines: 0,
    };
  }
  const { drafts, skippedLines } = collectDrafts(lines);

  const counts = await db.$transaction(
    async (tx) => {
      const affectedSessionIds = new Set(drafts.keys());

      if (status === "reimported" && existing) {
        const where = { sourceFileId: existing.id };
        const previous = [
          ...(await tx.apiCall.groupBy({ by: ["sessionId"], where })),
          ...(await tx.timelineEvent.groupBy({ by: ["sessionId"], where })),
        ];
        for (const row of previous) affectedSessionIds.add(row.sessionId);
        await tx.apiCall.deleteMany({ where });
        await tx.timelineEvent.deleteMany({ where });
      }

      const importedFile = await tx.importedFile.upsert({
        where: { path: file.path },
        create: {
          path: file.path,
          size: file.size,
          mtimeMs: file.mtimeMs,
          byteOffset: nextOffset,
        },
        update: {
          size: file.size,
          mtimeMs: file.mtimeMs,
          byteOffset: nextOffset,
        },
      });

      let newApiCalls = 0;
      let newEvents = 0;
      let hasPendingSession = false;
      for (const [sessionId, draft] of drafts) {
        const session = await upsertSession(tx, sessionId, draft);
        if (!session) {
          hasPendingSession = true;
          continue;
        }
        newApiCalls += await insertNewApiCalls(
          tx,
          sessionId,
          [...draft.apiCalls.values()],
          importedFile.id,
        );
        newEvents += await insertNewEvents(
          tx,
          sessionId,
          [...draft.events.values()],
          importedFile.id,
        );
      }

      // 세션이 생기기 전에 들어온 제목 줄을 잃지 않도록 offset을 그대로 두고 다음 sync에서 이 구간을 다시 읽는다.
      // 이미 저장한 행은 키로 걸러지므로 다시 읽어도 결과가 같다.
      if (hasPendingSession) {
        await tx.importedFile.update({
          where: { id: importedFile.id },
          data: { byteOffset: fromOffset },
        });
      }

      const sessions = await tx.session.findMany({
        where: { id: { in: [...affectedSessionIds] } },
        select: { id: true },
      });
      for (const { id } of sessions) await recomputeSessionTotals(tx, id);

      return { newApiCalls, newEvents };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );

  return { status, ...counts, skippedLines };
}

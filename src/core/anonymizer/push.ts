import { createClient } from "@libsql/client";
import { applyMigrations, createDb } from "@/core/db/createDb";
import type { DemoSnapshot } from "./snapshot";

const DEMO_FILE_ID = "demo";
const CHUNK_SIZE = 500;

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    result.push(items.slice(i, i + CHUNK_SIZE));
  }
  return result;
}

// demo-snapshot.json을 거치면 날짜가 ISO 문자열이 되므로 Date로 되살린다.
const toDate = (value: Date | string) => new Date(value);

// 공개 DB를 스냅샷 내용으로 통째로 바꾼다. 테이블을 지우고 다시 만들어 여러 번 push해도 중복이 없다.
export async function pushSnapshot(
  url: string,
  authToken: string | undefined,
  s: DemoSnapshot,
): Promise<void> {
  // DROP은 되돌릴 수 없어, 잘못된 스냅샷이면 공개 DB를 건드리기 전에 멈춘다.
  if (
    s.version !== 1 ||
    ![s.projects, s.sessions, s.apiCalls, s.events].every(Array.isArray) ||
    s.projects.length === 0
  ) {
    throw new Error(
      "demo-snapshot.json 형식이 올바르지 않거나 비어 있습니다. demo:export를 다시 실행하세요.",
    );
  }

  const client = createClient({ url, authToken });
  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    await client.executeMultiple(
      [
        "PRAGMA foreign_keys = OFF;",
        ...tables.rows.map((row) => `DROP TABLE IF EXISTS "${row.name}";`),
        "PRAGMA foreign_keys = ON;",
      ].join("\n"),
    );
    await applyMigrations(client);
  } finally {
    client.close();
  }

  const db = createDb(url, authToken);
  try {
    await db.importedFile.create({
      data: {
        id: DEMO_FILE_ID,
        path: DEMO_FILE_ID,
        size: 0,
        mtimeMs: 0,
        byteOffset: 0,
      },
    });
    for (const data of chunks(s.projects)) {
      await db.project.createMany({ data });
    }
    for (const data of chunks(s.sessions)) {
      await db.session.createMany({
        data: data.map((x) => ({
          ...x,
          startedAt: toDate(x.startedAt),
          endedAt: toDate(x.endedAt),
        })),
      });
    }
    for (const data of chunks(s.apiCalls)) {
      await db.apiCall.createMany({
        data: data.map((x) => ({
          ...x,
          timestamp: toDate(x.timestamp),
          sourceFileId: DEMO_FILE_ID,
        })),
      });
    }
    for (const data of chunks(s.events)) {
      await db.timelineEvent.createMany({
        data: data.map((x) => ({
          ...x,
          timestamp: toDate(x.timestamp),
          sourceFileId: DEMO_FILE_ID,
        })),
      });
    }
  } finally {
    await db.$disconnect();
  }
}

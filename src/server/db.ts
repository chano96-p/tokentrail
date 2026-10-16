import type { PrismaClient } from "@prisma/client";
import { createDb } from "@/core/db/createDb";
import { getAppMode } from "./mode";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  if (getAppMode() === "local") {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL을 .env에 설정해야 합니다. .env.example을 참고하세요.",
      );
    }

    globalForDb.db = createDb(url);
  } else {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        "TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN을 .env에 설정해야 합니다.",
      );
    }

    globalForDb.db = createDb(url, authToken);
  }

  return globalForDb.db;
}

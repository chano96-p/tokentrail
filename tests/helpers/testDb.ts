import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";
import { applyMigrations, createDb } from "@/core/db/createDb";

export async function createTestDb(): Promise<{
  db: PrismaClient;
  url: string;
  cleanup: () => Promise<void>;
}> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "tokentrail-"));
  const url = `file:${path.join(tmpDir, "test.db")}`;

  const client = createClient({ url });
  await applyMigrations(client);
  client.close();

  const db = createDb(url);

  const cleanup = async () => {
    await db.$disconnect();
    await rm(tmpDir, { recursive: true, force: true });
  };

  return { db, url, cleanup };
}

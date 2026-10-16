import type { Client } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export function createDb(url: string, authToken?: string): PrismaClient {
  const adapter = new PrismaLibSQL({ url, authToken });
  return new PrismaClient({ adapter });
}

export async function applyMigrations(client: Client): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

  const items = await readdir(migrationsDir, { withFileTypes: true });

  const migrationFolders = items
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort();

  for (const folder of migrationFolders) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    const sql = await readFile(sqlPath, "utf-8");
    await client.executeMultiple(sql);
  }
}

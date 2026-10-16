/*
  Warnings:

  - You are about to drop the column `cacheWriteTokens` on the `ApiCall` table. All the data in the column will be lost.
  - Added the required column `cacheWrite1hTokens` to the `ApiCall` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cacheWrite5mTokens` to the `ApiCall` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiCall" (
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "agentId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "cacheWrite5mTokens" INTEGER NOT NULL,
    "cacheWrite1hTokens" INTEGER NOT NULL,
    "stopReason" TEXT,
    "skill" TEXT,
    "plugin" TEXT,

    PRIMARY KEY ("sessionId", "messageId"),
    CONSTRAINT "ApiCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiCall_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ImportedFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiCall" ("agentId", "cacheReadTokens", "inputTokens", "messageId", "model", "outputTokens", "plugin", "sessionId", "skill", "sourceFileId", "stopReason", "timestamp") SELECT "agentId", "cacheReadTokens", "inputTokens", "messageId", "model", "outputTokens", "plugin", "sessionId", "skill", "sourceFileId", "stopReason", "timestamp" FROM "ApiCall";
DROP TABLE "ApiCall";
ALTER TABLE "new_ApiCall" RENAME TO "ApiCall";
CREATE INDEX "ApiCall_timestamp_idx" ON "ApiCall"("timestamp");
CREATE INDEX "ApiCall_messageId_idx" ON "ApiCall"("messageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

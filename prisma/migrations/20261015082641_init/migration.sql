-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cwd" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "gitBranch" TEXT,
    "cliVersion" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "subagentCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiCall" (
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "agentId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "cacheWriteTokens" INTEGER NOT NULL,
    "stopReason" TEXT,
    "skill" TEXT,
    "plugin" TEXT,

    PRIMARY KEY ("sessionId", "messageId"),
    CONSTRAINT "ApiCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiCall_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ImportedFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "uuid" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT,
    "parentUuid" TEXT,
    "apiCallId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "toolName" TEXT,
    "inputSummary" TEXT,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "contentLength" INTEGER NOT NULL DEFAULT 0,
    "preview" TEXT,

    PRIMARY KEY ("sessionId", "uuid"),
    CONSTRAINT "TimelineEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineEvent_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ImportedFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mtimeMs" REAL NOT NULL,
    "byteOffset" INTEGER NOT NULL,
    "importedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_cwd_key" ON "Project"("cwd");

-- CreateIndex
CREATE INDEX "Session_startedAt_idx" ON "Session"("startedAt");

-- CreateIndex
CREATE INDEX "Session_totalTokens_idx" ON "Session"("totalTokens");

-- CreateIndex
CREATE INDEX "ApiCall_timestamp_idx" ON "ApiCall"("timestamp");

-- CreateIndex
CREATE INDEX "ApiCall_messageId_idx" ON "ApiCall"("messageId");

-- CreateIndex
CREATE INDEX "TimelineEvent_sessionId_timestamp_idx" ON "TimelineEvent"("sessionId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedFile_path_key" ON "ImportedFile"("path");

import { getClaudeDir, runSync } from "@/core/importer/sync";
import { getDb } from "@/server/db";
import { getAppMode } from "@/server/mode";

async function main() {
  // demo 모드의 DB는 공개 Turso라 익명화하지 않은 로그가 올라가면 안 된다.
  if (getAppMode() === "demo") {
    throw new Error(
      "demo 모드에서는 sync를 실행할 수 없습니다. APP_MODE를 확인하세요.",
    );
  }

  const db = getDb();

  try {
    const startedAt = Date.now();
    const summary = await runSync(db, getClaudeDir());
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(
      `sync 완료: 파일 ${summary.filesImported}/${summary.filesScanned}개 반영 · ` +
        `API 호출 ${summary.newApiCalls}개 · 이벤트 ${summary.newEvents}개 · 건너뛴 줄 ${summary.skippedLines}개 (${elapsedSeconds}초)`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("sync 실패:", error);
  process.exitCode = 1;
});

import { writeFile } from "node:fs/promises";
import os from "node:os";
import { buildSnapshot } from "@/core/anonymizer/snapshot";
import { loadConfig } from "@/core/config";
import { getDb } from "@/server/db";
import { getAppMode } from "@/server/mode";

const OUTPUT_PATH = "demo-snapshot.json";

async function main() {
  // export 원본은 로컬 DB여야 한다. demo 모드의 getDb()는 공개 Turso를 가리킨다.
  if (getAppMode() === "demo") {
    throw new Error(
      "demo 모드에서는 demo:export를 실행할 수 없습니다. APP_MODE를 확인하세요.",
    );
  }

  const db = getDb();

  try {
    const snapshot = await buildSnapshot(db, loadConfig().demo, {
      homeDir: os.homedir(),
      username: os.userInfo().username,
    });

    if (snapshot.projects.length === 0) {
      console.error(
        "dashboard.config.ts의 demo.projects에 공개할 프로젝트 cwd를 추가하세요",
      );
      process.exitCode = 1;
      return;
    }

    await writeFile(OUTPUT_PATH, JSON.stringify(snapshot, null, 2));
    console.log(
      `${OUTPUT_PATH} 저장: 프로젝트 ${snapshot.projects.length}개 · ` +
        `세션 ${snapshot.sessions.length}개 · 이벤트 ${snapshot.events.length}개`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("demo export 실패:", error);
  process.exitCode = 1;
});

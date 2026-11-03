import { readFile } from "node:fs/promises";
import { pushSnapshot } from "@/core/anonymizer/push";
import type { DemoSnapshot } from "@/core/anonymizer/snapshot";

const SNAPSHOT_PATH = "demo-snapshot.json";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN을 .env에 설정해야 합니다.",
    );
  }

  // pushSnapshot은 대상 DB를 통째로 비운다. 로컬 DB를 가리키면 원본 집계가 사라진다.
  if (url.startsWith("file:") || url === process.env.DATABASE_URL) {
    throw new Error("demo:push 대상은 Turso(libsql://)여야 합니다.");
  }

  // 날짜 필드는 아직 문자열이다. 형태 검사와 Date 복원은 pushSnapshot이 한다.
  const snapshot = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf-8"),
  ) as DemoSnapshot;
  await pushSnapshot(url, authToken, snapshot);
  console.log(
    `demo push 완료: 프로젝트 ${snapshot.projects.length}개 · ` +
      `세션 ${snapshot.sessions.length}개 · 이벤트 ${snapshot.events.length}개`,
  );
}

main().catch((error) => {
  console.error("demo push 실패:", error);
  process.exitCode = 1;
});

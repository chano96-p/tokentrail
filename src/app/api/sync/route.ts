import { getClaudeDir, runSync } from "@/core/importer/sync";
import { getDb } from "@/server/db";
import { getAppMode } from "@/server/mode";

export async function POST() {
  if (getAppMode() === "demo") {
    return Response.json(
      { error: "데모에서는 sync를 사용할 수 없습니다." },
      { status: 403 },
    );
  }
  return Response.json(await runSync(getDb(), getClaudeDir()));
}

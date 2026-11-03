import type { PrismaClient } from "@prisma/client";
import type { AppMode } from "./mode";

// 데모 데이터는 push한 시점에 멈춰 있어, 오늘 기준으로 "최근 7일"을 잡으면 시간이 지날수록 화면이 빈다.
// demo 모드에서는 마지막 API 호출 시각을 오늘처럼 쓴다.
export async function getReferenceNow(
  db: PrismaClient,
  mode: AppMode,
  now: Date,
): Promise<Date> {
  if (mode === "local") return now;
  const latest = await db.apiCall.aggregate({ _max: { timestamp: true } });
  return latest._max.timestamp ?? now;
}

import { getDb } from "@/server/db";
import { getFilterOptions } from "@/server/queries/filters";
import { connection } from "next/server";

export async function GET() {
  // 요청 객체를 읽지 않는 GET은 빌드 때 미리 실행될 수 있어 요청 시점으로 미룬다.
  await connection();
  return Response.json(await getFilterOptions(getDb()));
}

import { loadConfig } from "@/core/config";
import { getDb } from "@/server/db";
import { getAppMode } from "@/server/mode";
import { parseSessionListParams } from "@/server/params";
import { listSessions } from "@/server/queries/sessions";
import { getReferenceNow } from "@/server/referenceNow";

export async function GET(request: Request) {
  const config = loadConfig();
  const db = getDb();
  const sp = new URL(request.url).searchParams;
  const now = await getReferenceNow(db, getAppMode(), new Date());
  const params = parseSessionListParams(sp, now, config.timezone);
  return Response.json(await listSessions(db, params));
}

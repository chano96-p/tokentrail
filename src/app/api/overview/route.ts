import { loadConfig } from "@/core/config";
import { getDb } from "@/server/db";
import { getAppMode } from "@/server/mode";
import { parseOverviewParams } from "@/server/params";
import { getOverview } from "@/server/queries/overview";
import { getReferenceNow } from "@/server/referenceNow";

export async function GET(request: Request) {
  const config = loadConfig();
  const db = getDb();
  const sp = new URL(request.url).searchParams;
  const now = await getReferenceNow(db, getAppMode(), new Date());
  const params = parseOverviewParams(sp, now, config.timezone);
  return Response.json(await getOverview(db, params, config));
}

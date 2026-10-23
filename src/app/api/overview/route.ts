import { loadConfig } from "@/core/config";
import { getDb } from "@/server/db";
import { parseOverviewParams } from "@/server/params";
import { getOverview } from "@/server/queries/overview";

export async function GET(request: Request) {
  const config = loadConfig();
  const sp = new URL(request.url).searchParams;
  const params = parseOverviewParams(sp, new Date(), config.timezone);
  return Response.json(await getOverview(getDb(), params, config));
}
